import { describe, expect, it, vi } from "vitest";

import type { Architect } from "@/lib/domain";
import { UiAuthorizationPolicy } from "@/lib/scope";
import { TeamViewModel, type TeamRosterService } from "@/lib/view-models";
import { fixtureAdminUser, fixtureMemberUser } from "../../helpers/fixtures";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — primeiro ViewModel de tela desta fase. Testado direto
 * com um `TeamRosterService` falso (sem montar `useStore()`/React), como o
 * brief pede: a classe não sabe que existe um `store.tsx` por trás — só
 * conhece a forma estreita da interface.
 */
function fakeService(): TeamRosterService & {
  reactivateArchitect: ReturnType<typeof vi.fn>;
  transitionCareerLevel: ReturnType<typeof vi.fn>;
  allocateArchitectToTeam: ReturnType<typeof vi.fn>;
  releaseArchitectFromTeam: ReturnType<typeof vi.fn>;
} {
  return {
    reactivateArchitect: vi.fn(),
    transitionCareerLevel: vi.fn(async () => ({ id: "ana" }) as Architect),
    allocateArchitectToTeam: vi.fn(async () => ({ id: "ana" }) as Architect),
    releaseArchitectFromTeam: vi.fn(async () => ({ id: "ana" }) as Architect),
  };
}

describe("TeamViewModel", () => {
  describe("isAdmin", () => {
    it("delega para a UiAuthorizationPolicy injetada", () => {
      const vm = new TeamViewModel(fakeService(), new UiAuthorizationPolicy());
      expect(vm.isAdmin(fixtureAdminUser)).toBe(true);
      expect(vm.isAdmin(fixtureMemberUser)).toBe(false);
    });
  });

  /**
   * ONDA 37 — `validate`/`submit`/`emptyArchitectForm` e `deactivate` saíram
   * da classe com o formulário: cadastrar, editar e desativar são de
   * Usuários agora, e a régua de lá é `PersonAdmission`
   * (`tests/lib/person-admission.test.ts`). O que sobrou aqui é o que /team
   * ainda faz: mudar time ou nível, e reativar.
   */
  describe("reactivate", () => {
    it("chama reactivateArchitect(id, version) — o mesmo ato da desativação, de volta (profissional E conta), com a trava de versão", () => {
      const service = fakeService();
      const vm = new TeamViewModel(service, new UiAuthorizationPolicy());
      const architect = { id: "bruno", version: 3 } as Architect;

      vm.reactivate(architect);

      expect(service.reactivateArchitect).toHaveBeenCalledWith("bruno", 3);
    });
  });

  describe("transitionCareerLevel (OO3-11c)", () => {
    it("delega ao serviço com os argumentos exatos", async () => {
      const service = fakeService();
      const vm = new TeamViewModel(service, new UiAuthorizationPolicy());

      await vm.transitionCareerLevel("ana", "Sênior", "promoção do ciclo");

      expect(service.transitionCareerLevel).toHaveBeenCalledWith(
        "ana",
        "Sênior",
        "promoção do ciclo",
      );
    });

    it("propaga a rejeição sem engolir — o 409 precisa chegar ao diálogo", async () => {
      const service = fakeService();
      service.transitionCareerLevel.mockRejectedValueOnce(new Error("conflito"));
      const vm = new TeamViewModel(service, new UiAuthorizationPolicy());

      await expect(vm.transitionCareerLevel("ana", "Sênior", "x")).rejects.toThrow("conflito");
    });
  });
});
