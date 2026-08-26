import { describe, expect, it, vi } from "vitest";

import type { Capability, Competency } from "../domain";
import { UiAuthorizationPolicy } from "../scope";
import {
  CompetencyMatrixViewModel,
  type CatalogService,
} from "../view-models/competency-matrix-view-model";
import { fixtureAdminUser, fixtureCareerLevels, fixtureMemberUser } from "./fixtures";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — quinto ViewModel de tela desta fase, testado direto com um
 * `CatalogService` falso (sem montar `useStore()`/React), mesmo espírito de
 * `team-view-model.test.ts`/`development-plans-view-model.test.ts`/
 * `assessment-view-model.test.ts`: a cobertura de componente da própria
 * rota (se existir) já exercita o fim a fim via UI; este cobre a classe
 * isolada.
 */
function fakeService(): CatalogService & {
  addCapability: ReturnType<typeof vi.fn>;
  updateCapability: ReturnType<typeof vi.fn>;
  removeCapability: ReturnType<typeof vi.fn>;
  addCompetency: ReturnType<typeof vi.fn>;
  updateCompetency: ReturnType<typeof vi.fn>;
  removeCompetency: ReturnType<typeof vi.fn>;
  swapCompetencyRequirement: ReturnType<typeof vi.fn>;
} {
  return {
    addCapability: vi.fn(async (input) => ({ ...input, id: "nova-capacidade" }) as Capability),
    updateCapability: vi.fn(),
    removeCapability: vi.fn(async () => ({ archived: false, competenciesRemoved: 0 })),
    addCompetency: vi.fn(async (input) => ({ ...input, id: "nova-competencia" }) as Competency),
    updateCompetency: vi.fn(),
    removeCompetency: vi.fn(async () => ({ archived: false })),
    swapCompetencyRequirement: vi.fn(async () => undefined),
  };
}

function makeVm(service = fakeService()) {
  return { vm: new CompetencyMatrixViewModel(service, new UiAuthorizationPolicy()), service };
}

function capability(overrides: Partial<Capability> = {}): Capability {
  return {
    id: "cloud",
    name: "Cloud Architecture",
    short: "Cloud",
    active: true,
    curation: {
      activeCompetencyCount: 2,
      restrictiveCompetencyCount: 0,
      nonRestrictiveCompetencyCount: 2,
      status: "REQUIRES_CURATION",
    },
    ...overrides,
  };
}

function competency(overrides: Partial<Competency> = {}): Competency {
  return {
    id: "cloud-k8s",
    name: "Kubernetes",
    capabilityId: "cloud",
    requirementType: "NON_RESTRICTIVE",
    expected: { "arquiteto-de-solucoes-i": 3 },
    active: true,
    ...overrides,
  };
}

describe("CompetencyMatrixViewModel", () => {
  describe("isAdmin", () => {
    it("delega para a UiAuthorizationPolicy injetada", () => {
      const { vm } = makeVm();
      expect(vm.isAdmin(fixtureAdminUser)).toBe(true);
      expect(vm.isAdmin(fixtureMemberUser)).toBe(false);
    });
  });

  describe("createCapability", () => {
    it("envia o nome cortado (trim) com active:true, sem `short`", async () => {
      const { vm, service } = makeVm();
      await vm.createCapability("  Cloud Architecture  ");
      expect(service.addCapability).toHaveBeenCalledWith({
        name: "Cloud Architecture",
        active: true,
      });
    });
  });

  describe("renameCapability", () => {
    it("envia só o nome cortado — nunca `short` (backend regenera a sigla)", () => {
      const { vm, service } = makeVm();
      vm.renameCapability("cloud", "  Nuvem  ");
      expect(service.updateCapability).toHaveBeenCalledWith("cloud", { name: "Nuvem" });
    });
  });

  describe("removeCapability / restoreCapability", () => {
    it("removeCapability delega 1:1 para o serviço", async () => {
      const { vm, service } = makeVm();
      await vm.removeCapability("cloud");
      expect(service.removeCapability).toHaveBeenCalledWith("cloud");
    });

    it("restoreCapability reativa via updateCapability(id, { active: true })", () => {
      const { vm, service } = makeVm();
      vm.restoreCapability("cloud");
      expect(service.updateCapability).toHaveBeenCalledWith("cloud", { active: true });
    });
  });

  describe("isCapabilityAtCapacity", () => {
    it("máximo de 6 competências ativas por capacidade (ENT-CAR-011)", () => {
      const { vm } = makeVm();
      expect(
        vm.isCapabilityAtCapacity(
          capability({ curation: { ...capability().curation, activeCompetencyCount: 5 } }),
        ),
      ).toBe(false);
      expect(
        vm.isCapabilityAtCapacity(
          capability({ curation: { ...capability().curation, activeCompetencyCount: 6 } }),
        ),
      ).toBe(true);
    });
  });

  describe("createCompetency", () => {
    it("monta o payload com nome cortado, expected e active:true", async () => {
      const { vm, service } = makeVm();
      await vm.createCompetency(
        "cloud",
        "  Kubernetes  ",
        { "arquiteto-de-solucoes-i": 3 },
        "NON_RESTRICTIVE",
      );
      expect(service.addCompetency).toHaveBeenCalledWith({
        name: "Kubernetes",
        capabilityId: "cloud",
        requirementType: "NON_RESTRICTIVE",
        expected: { "arquiteto-de-solucoes-i": 3 },
        active: true,
      });
    });
  });

  describe("canCreateCompetency", () => {
    const { vm } = makeVm();

    it("recusa nome vazio mesmo com todos os níveis preenchidos", () => {
      const levels = Object.fromEntries(fixtureCareerLevels.map((cl) => [cl.id, 3] as const));
      expect(vm.canCreateCompetency("   ", levels, fixtureCareerLevels)).toBe(false);
    });

    it("recusa quando falta nível de QUALQUER nível de carreira — sem fallback fabricado (Seção 39)", () => {
      const levels = Object.fromEntries(
        fixtureCareerLevels.slice(0, -1).map((cl) => [cl.id, 3] as const),
      );
      expect(vm.canCreateCompetency("Kubernetes", levels, fixtureCareerLevels)).toBe(false);
    });

    it("aceita nome preenchido com todos os níveis de carreira definidos", () => {
      const levels = Object.fromEntries(fixtureCareerLevels.map((cl) => [cl.id, 3] as const));
      expect(vm.canCreateCompetency("Kubernetes", levels, fixtureCareerLevels)).toBe(true);
    });
  });

  describe("updateCompetency", () => {
    it("envia nome cortado, expected e requirementType — nunca capabilityId (trocar de capacidade fica fora desta tela)", () => {
      const { vm, service } = makeVm();
      vm.updateCompetency(
        "cloud-k8s",
        "  Kubernetes Avançado  ",
        { "arquiteto-de-solucoes-i": 4 },
        "RESTRICTIVE",
      );
      expect(service.updateCompetency).toHaveBeenCalledWith("cloud-k8s", {
        name: "Kubernetes Avançado",
        expected: { "arquiteto-de-solucoes-i": 4 },
        requirementType: "RESTRICTIVE",
      });
    });
  });

  describe("removeCompetency / restoreCompetency", () => {
    it("removeCompetency delega 1:1 para o serviço", async () => {
      const { vm, service } = makeVm();
      await vm.removeCompetency("cloud-k8s");
      expect(service.removeCompetency).toHaveBeenCalledWith("cloud-k8s");
    });

    it("restoreCompetency reativa via updateCompetency(id, { active: true })", () => {
      const { vm, service } = makeVm();
      vm.restoreCompetency("cloud-k8s");
      expect(service.updateCompetency).toHaveBeenCalledWith("cloud-k8s", { active: true });
    });
  });

  describe("swapRequirementType", () => {
    it("delega para swapCompetencyRequirement e propaga erro — quem chama decide o banner (swapError)", async () => {
      const { vm, service } = makeVm();
      await vm.swapRequirementType("cloud-k8s", "cloud-serverless");
      expect(service.swapCompetencyRequirement).toHaveBeenCalledWith(
        "cloud-k8s",
        "cloud-serverless",
      );

      const service2 = fakeService();
      service2.swapCompetencyRequirement.mockRejectedValueOnce(new Error("409 conflito"));
      const { vm: vm2 } = makeVm(service2);
      await expect(vm2.swapRequirementType("a", "b")).rejects.toThrow("409 conflito");
    });
  });

  describe("isRequirementTypeFull", () => {
    it("sem `excluding`: cheio quando a contagem do tipo já é 3", () => {
      const { vm } = makeVm();
      const full = capability({
        curation: {
          activeCompetencyCount: 3,
          restrictiveCompetencyCount: 3,
          nonRestrictiveCompetencyCount: 0,
          status: "REQUIRES_CURATION",
        },
      });
      expect(vm.isRequirementTypeFull(full, "RESTRICTIVE")).toBe(true);
      expect(vm.isRequirementTypeFull(full, "NON_RESTRICTIVE")).toBe(false);
    });

    it("com `excluding` do MESMO tipo: desconta a própria competência (ela já ocupa uma vaga)", () => {
      const { vm } = makeVm();
      const full = capability({
        curation: {
          activeCompetencyCount: 3,
          restrictiveCompetencyCount: 3,
          nonRestrictiveCompetencyCount: 0,
          status: "REQUIRES_CURATION",
        },
      });
      const self = competency({ requirementType: "RESTRICTIVE" });
      expect(vm.isRequirementTypeFull(full, "RESTRICTIVE", self)).toBe(false);
    });

    it("com `excluding` de tipo DIFERENTE: não desconta nada", () => {
      const { vm } = makeVm();
      const full = capability({
        curation: {
          activeCompetencyCount: 3,
          restrictiveCompetencyCount: 3,
          nonRestrictiveCompetencyCount: 0,
          status: "REQUIRES_CURATION",
        },
      });
      const self = competency({ requirementType: "NON_RESTRICTIVE" });
      expect(vm.isRequirementTypeFull(full, "RESTRICTIVE", self)).toBe(true);
    });

    it("capacidade `undefined` (ainda não resolvida) nunca trava a UI num loading transitório", () => {
      const { vm } = makeVm();
      expect(vm.isRequirementTypeFull(undefined, "RESTRICTIVE")).toBe(false);
    });
  });

  describe("swapCandidates", () => {
    const pool: Competency[] = [
      competency({ id: "a", capabilityId: "cloud", requirementType: "RESTRICTIVE", active: true }),
      competency({ id: "b", capabilityId: "cloud", requirementType: "RESTRICTIVE", active: true }),
      competency({
        id: "c",
        capabilityId: "cloud",
        requirementType: "NON_RESTRICTIVE",
        active: true,
      }),
      competency({
        id: "d",
        capabilityId: "security",
        requirementType: "RESTRICTIVE",
        active: true,
      }),
      competency({
        id: "e",
        capabilityId: "cloud",
        requirementType: "RESTRICTIVE",
        active: false,
      }),
    ];

    it("só a mesma capacidade, ativa, do tipo pedido, excluindo a própria competência", () => {
      const { vm } = makeVm();
      const result = vm.swapCandidates(pool, "cloud", "RESTRICTIVE", "a");
      expect(result.map((c) => c.id)).toEqual(["b"]);
    });
  });
});
