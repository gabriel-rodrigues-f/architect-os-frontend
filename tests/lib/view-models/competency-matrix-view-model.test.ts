import { describe, expect, it, vi } from "vitest";

import type { Capability, Competency } from "@/lib/domain";
import { UiAuthorizationPolicy } from "@/lib/scope";
import { CompetencyMatrixViewModel, type CatalogService } from "@/lib/view-models";
import { fixtureAdminUser, fixtureMemberUser } from "../../helpers/fixtures";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — quinto ViewModel de tela desta fase, testado direto com um
 * `CatalogService` falso (sem montar `useStore()`/React), mesmo espírito de
 * `team-view-model.test.ts`/`development-plans-view-model.test.ts`/
 * `assessment-view-model.test.ts`: a cobertura de componente da própria
 * rota (se existir) já exercita o fim a fim via UI; este cobre a classe
 * isolada.
 *
 * Fase 2 (backend ADRs 0032-0034) — o catálogo global virou definição pura:
 * `requirementType`/`expected` saíram do payload de escrita (o backend
 * responde 400 a campo extra, `additionalProperties: false`), o swap de
 * obrigatoriedade migrou para a régua do time e a contagem por tipo morreu
 * junto com o teto-que-bloqueava (o teto virou sinal). Estes testes provam
 * que a tela NÃO envia mais os campos mortos.
 */
function fakeService(): CatalogService & {
  addCapability: ReturnType<typeof vi.fn>;
  updateCapability: ReturnType<typeof vi.fn>;
  removeCapability: ReturnType<typeof vi.fn>;
  addCompetency: ReturnType<typeof vi.fn>;
  updateCompetency: ReturnType<typeof vi.fn>;
  removeCompetency: ReturnType<typeof vi.fn>;
  removeCompetencies: ReturnType<typeof vi.fn>;
} {
  return {
    addCapability: vi.fn(async (input) => ({ ...input, id: "nova-capacidade" }) as Capability),
    updateCapability: vi.fn(),
    removeCapability: vi.fn(async () => ({ archived: false, competenciesRemoved: 0 })),
    addCompetency: vi.fn(async (input) => ({ ...input, id: "nova-competencia" }) as Competency),
    updateCompetency: vi.fn(),
    removeCompetency: vi.fn(async () => ({ archived: false })),
    removeCompetencies: vi.fn(async () => ({ outcomes: [] })),
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
      status: "REQUIRES_CURATION",
    },
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
    it("o máximo por capacidade é o da política — 4 por default (onda 36, ADR-0081)", () => {
      const { vm } = makeVm();
      expect(
        vm.isCapabilityAtCapacity(
          capability({ curation: { ...capability().curation, activeCompetencyCount: 3 } }),
        ),
      ).toBe(false);
      expect(
        vm.isCapabilityAtCapacity(
          capability({ curation: { ...capability().curation, activeCompetencyCount: 4 } }),
        ),
      ).toBe(true);
    });
  });

  describe("createCompetency", () => {
    it("monta o payload SÓ com nome cortado, capacidade e active:true — sem requirementType/expected (contrato Fase 2)", async () => {
      const { vm, service } = makeVm();
      await vm.createCompetency("cloud", "  Kubernetes  ");
      expect(service.addCompetency).toHaveBeenCalledWith({
        name: "Kubernetes",
        capabilityId: "cloud",
        active: true,
      });
    });
  });

  describe("canCreateCompetency", () => {
    const { vm } = makeVm();

    it("recusa nome vazio", () => {
      expect(vm.canCreateCompetency("   ")).toBe(false);
    });

    it("aceita nome preenchido — níveis exigidos não são mais pré-condição (moram na régua do time)", () => {
      expect(vm.canCreateCompetency("Kubernetes")).toBe(true);
    });
  });

  describe("updateCompetency", () => {
    it("envia só o nome cortado — nunca capabilityId, requirementType ou expected", () => {
      const { vm, service } = makeVm();
      vm.updateCompetency("cloud-k8s", "  Kubernetes Avançado  ");
      expect(service.updateCompetency).toHaveBeenCalledWith("cloud-k8s", {
        name: "Kubernetes Avançado",
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

  /**
   * CFG-04 — os limites deixaram de ser literais: a política injetada segue
   * alimentando o teto-sinal (isCapabilityAtCapacity) e os textos da rota.
   */
  describe("política de curadoria injetada (CFG-04)", () => {
    const policyMax3 = { maxActiveCompetencies: 3 };
    const vmMax3 = new CompetencyMatrixViewModel(
      fakeService(),
      new UiAuthorizationPolicy(),
      policyMax3,
    );

    it("isCapabilityAtCapacity respeita maxActiveCompetencies=3", () => {
      const at = (n: number) =>
        vmMax3.isCapabilityAtCapacity(
          capability({ curation: { ...capability().curation, activeCompetencyCount: n } }),
        );
      expect(at(2)).toBe(false);
      expect(at(3)).toBe(true);
    });

    it("limits expõe a política injetada para os textos da rota", () => {
      expect(vmMax3.limits).toEqual(policyMax3);
      expect(makeVm().vm.limits).toEqual({ maxActiveCompetencies: 4 });
    });
  });
});
