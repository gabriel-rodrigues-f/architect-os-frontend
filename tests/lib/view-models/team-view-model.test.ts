import { describe, expect, it, vi } from "vitest";

import type { Architect } from "@/lib/domain";
import { UiAuthorizationPolicy } from "@/lib/scope";
import {
  emptyArchitectForm,
  TeamViewModel,
  type ArchitectFormValues,
  type TeamRosterService,
} from "@/lib/view-models/team-view-model";
import { fixtureAdminUser, fixtureMemberUser } from "../../helpers/fixtures";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — primeiro ViewModel de tela desta fase. Testado direto
 * com um `TeamRosterService` falso (sem montar `useStore()`/React), como o
 * brief pede: a classe não sabe que existe um `store.tsx` por trás — só
 * conhece a forma estreita da interface.
 */
function fakeService(): TeamRosterService & {
  addArchitect: ReturnType<typeof vi.fn>;
  updateArchitect: ReturnType<typeof vi.fn>;
  transitionCareerLevel: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
} {
  return {
    addArchitect: vi.fn(async (input) => ({ ...input, id: "novo-id", version: 1 }) as Architect),
    updateArchitect: vi.fn(),
    transitionCareerLevel: vi.fn(async () => ({ id: "ana" }) as Architect),
    deactivate: vi.fn(async () => ({ id: "ana" }) as Architect),
  };
}

const baseForm: ArchitectFormValues = {
  name: "Carla Nogueira",
  role: "Arquiteto de Soluções I",
  specialization: "",
  primarySpecializationCompetencyId: null,
  years: "2",
  email: "carla@company.com",
  leadUserId: "",
};

describe("TeamViewModel", () => {
  describe("isAdmin", () => {
    it("delega para a UiAuthorizationPolicy injetada", () => {
      const vm = new TeamViewModel(fakeService(), new UiAuthorizationPolicy());
      expect(vm.isAdmin(fixtureAdminUser)).toBe(true);
      expect(vm.isAdmin(fixtureMemberUser)).toBe(false);
    });
  });

  describe("validate", () => {
    const vm = new TeamViewModel(fakeService(), new UiAuthorizationPolicy());

    it("aceita um formulário com nome, e-mail com @ e anos inteiros >= 0", () => {
      expect(vm.validate(baseForm)).toEqual({ yearsValid: true, canSubmit: true });
    });

    it("recusa sem nome", () => {
      expect(vm.validate({ ...baseForm, name: "   " }).canSubmit).toBe(false);
    });

    it("recusa e-mail sem @", () => {
      expect(vm.validate({ ...baseForm, email: "carla-sem-arroba" }).canSubmit).toBe(false);
    });

    it("recusa anos vazio, negativo, ou não inteiro", () => {
      expect(vm.validate({ ...baseForm, years: "" }).yearsValid).toBe(false);
      expect(vm.validate({ ...baseForm, years: "-1" }).yearsValid).toBe(false);
      expect(vm.validate({ ...baseForm, years: "2.5" }).yearsValid).toBe(false);
    });

    it("aceita zero anos — gente no primeiro dia é um dado real, não um valor inválido", () => {
      expect(vm.validate({ ...baseForm, years: "0" }).yearsValid).toBe(true);
    });
  });

  describe("submit — criação (editingId null)", () => {
    it("chama addArchitect sem o campo legado, com role e active:true, e nunca chama updateArchitect", async () => {
      const service = fakeService();
      const vm = new TeamViewModel(service, new UiAuthorizationPolicy());

      await vm.submit(baseForm, null);

      expect(service.updateArchitect).not.toHaveBeenCalled();
      expect(service.addArchitect).toHaveBeenCalledWith({
        name: "Carla Nogueira",
        yearsAsArchitect: 2,
        primarySpecializationCompetencyId: null,
        email: "carla@company.com",
        leadUserId: null,
        specialization: "",
        role: "Arquiteto de Soluções I",
        active: true,
      });
    });

    it("também cria quando editingId é string vazia (convenção de 'diálogo aberto para criar')", async () => {
      const service = fakeService();
      const vm = new TeamViewModel(service, new UiAuthorizationPolicy());

      await vm.submit(baseForm, "");

      expect(service.addArchitect).toHaveBeenCalledTimes(1);
      expect(service.updateArchitect).not.toHaveBeenCalled();
    });

    it("nome e e-mail são gravados sem espaço nas pontas (trim)", async () => {
      const service = fakeService();
      const vm = new TeamViewModel(service, new UiAuthorizationPolicy());

      await vm.submit(
        { ...baseForm, name: "  Carla Nogueira  ", email: " carla@company.com " },
        null,
      );

      expect(service.addArchitect).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Carla Nogueira", email: "carla@company.com" }),
      );
    });

    it("leadUserId vazio vira null, nunca string vazia", async () => {
      const service = fakeService();
      const vm = new TeamViewModel(service, new UiAuthorizationPolicy());

      await vm.submit({ ...baseForm, leadUserId: "" }, null);

      expect(service.addArchitect).toHaveBeenCalledWith(
        expect.objectContaining({ leadUserId: null }),
      );
    });

    it("propaga o erro do serviço — quem chama decide o toast (ViewModel não lida com UI)", async () => {
      const service = fakeService();
      service.addArchitect.mockRejectedValueOnce(new Error("e-mail já cadastrado"));
      const vm = new TeamViewModel(service, new UiAuthorizationPolicy());

      await expect(vm.submit(baseForm, null)).rejects.toThrow("e-mail já cadastrado");
    });
  });

  describe("submit — edição (editingId presente)", () => {
    it("chama updateArchitect com o payload, nunca addArchitect, e NUNCA envia role (ENT-CAR-017)", async () => {
      const service = fakeService();
      const vm = new TeamViewModel(service, new UiAuthorizationPolicy());

      await vm.submit(baseForm, "ana");

      expect(service.addArchitect).not.toHaveBeenCalled();
      expect(service.updateArchitect).toHaveBeenCalledWith("ana", {
        name: "Carla Nogueira",
        yearsAsArchitect: 2,
        primarySpecializationCompetencyId: null,
        email: "carla@company.com",
        leadUserId: null,
      });
      const [, patch] = service.updateArchitect.mock.calls[0]!;
      expect(patch).not.toHaveProperty("role");
      expect(patch).not.toHaveProperty("specialization");
    });
  });

  describe("reactivate", () => {
    it("chama updateArchitect(id, { active: true }) — mesmo comando que o PATCH genérico usava antes do dedicado de desativação", () => {
      const service = fakeService();
      const vm = new TeamViewModel(service, new UiAuthorizationPolicy());
      const architect = { id: "bruno" } as Architect;

      vm.reactivate(architect);

      expect(service.updateArchitect).toHaveBeenCalledWith("bruno", { active: true });
    });
  });

  describe("transitionCareerLevel / deactivate (OO3-11c)", () => {
    it("delegam ao serviço com os argumentos exatos", async () => {
      const service = fakeService();
      const vm = new TeamViewModel(service, new UiAuthorizationPolicy());

      await vm.transitionCareerLevel("ana", "Arquiteto de Soluções III", "promoção do ciclo");
      await vm.deactivate("ana", "saiu da empresa");

      expect(service.transitionCareerLevel).toHaveBeenCalledWith(
        "ana",
        "Arquiteto de Soluções III",
        "promoção do ciclo",
      );
      expect(service.deactivate).toHaveBeenCalledWith("ana", "saiu da empresa");
    });

    it("propagam a rejeição sem engolir — o 409 precisa chegar ao diálogo", async () => {
      const service = fakeService();
      service.transitionCareerLevel.mockRejectedValueOnce(new Error("conflito"));
      service.deactivate.mockRejectedValueOnce(new Error("conflito"));
      const vm = new TeamViewModel(service, new UiAuthorizationPolicy());

      await expect(
        vm.transitionCareerLevel("ana", "Arquiteto de Soluções III", "x"),
      ).rejects.toThrow("conflito");
      await expect(vm.deactivate("ana", "x")).rejects.toThrow("conflito");
    });
  });
});

describe("emptyArchitectForm", () => {
  it("nasce vazio, com o role padrão recebido e sem fallback nenhum preenchido", () => {
    expect(emptyArchitectForm("Arquiteto de Soluções I")).toEqual({
      name: "",
      role: "Arquiteto de Soluções I",
      specialization: "",
      primarySpecializationCompetencyId: null,
      years: "",
      email: "",
      leadUserId: "",
    });
  });
});
