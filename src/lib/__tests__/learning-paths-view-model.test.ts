import { describe, expect, it, vi } from "vitest";

import type { Architect, LearningPath, LearningPathItem } from "../domain";
import {
  LearningPathsViewModel,
  type LearningPathService,
} from "../view-models/learning-paths-view-model";
import { fixtureAdminUser } from "./fixtures";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — sexto ViewModel de tela desta fase, testado direto com um
 * `LearningPathService` falso (sem montar `useStore()`/React), mesmo
 * espírito de `team-view-model.test.ts`/`development-plans-view-model.
 * test.ts`/`competency-matrix-view-model.test.ts`: a cobertura de
 * componente já existente da rota (`learning-paths.test.ts`) cobre
 * `canEdit`/data/ordenação; este cobre a classe isolada.
 */
function fakeService(): LearningPathService & {
  addLearningPath: ReturnType<typeof vi.fn>;
  updateLearningPath: ReturnType<typeof vi.fn>;
  removeLearningPath: ReturnType<typeof vi.fn>;
  addLearningPathItem: ReturnType<typeof vi.fn>;
  removeLearningPathItem: ReturnType<typeof vi.fn>;
  updateLearningItemProgress: ReturnType<typeof vi.fn>;
} {
  return {
    addLearningPath: vi.fn(async (p: LearningPath) => ({ ...p, id: "trilha-nova" })),
    updateLearningPath: vi.fn(),
    removeLearningPath: vi.fn(),
    addLearningPathItem: vi.fn(),
    removeLearningPathItem: vi.fn(),
    updateLearningItemProgress: vi.fn(),
  };
}

function makeVm(service = fakeService()) {
  return { vm: new LearningPathsViewModel(service), service };
}

function path(overrides: Partial<LearningPath> = {}): LearningPath {
  return {
    id: "trilha-1",
    name: "Cloud Native",
    description: "Trilha de arquitetura em nuvem",
    competencyIds: ["cloud-k8s"],
    assignedTo: ["ana"],
    items: [{ id: "item-1", title: "Curso de Kubernetes", type: "Curso", hours: 8 }],
    progress: [],
    createdBy: "lead@company.com",
    createdByUserId: "user-lead",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function architect(overrides: Partial<Architect> = {}): Architect {
  return {
    id: "ana",
    name: "Ana Martins",
    role: "member",
    yearsAsArchitect: 3,
    active: true,
    ...overrides,
  } as Architect;
}

describe("LearningPathsViewModel", () => {
  describe("createPath", () => {
    it("monta o payload com id vazio, nomes cortados, sem itens/progresso, autoria da sessão atual", async () => {
      const { vm, service } = makeVm();
      await vm.createPath(
        fixtureAdminUser,
        { name: "  Cloud Native  ", description: "  trilha de nuvem  " },
        ["cloud-k8s"],
        ["ana"],
      );
      expect(service.addLearningPath).toHaveBeenCalledWith({
        id: "",
        name: "Cloud Native",
        description: "trilha de nuvem",
        competencyIds: ["cloud-k8s"],
        assignedTo: ["ana"],
        items: [],
        progress: [],
        createdBy: fixtureAdminUser.email,
        createdByUserId: fixtureAdminUser.id,
        createdAt: expect.any(String),
      });
    });

    it("propaga o erro do serviço — quem chama decide o toast", async () => {
      const service = fakeService();
      service.addLearningPath.mockRejectedValueOnce(new Error("403"));
      const { vm } = makeVm(service);
      await expect(
        vm.createPath(fixtureAdminUser, { name: "X", description: "" }, [], []),
      ).rejects.toThrow("403");
    });
  });

  describe("updateDetails", () => {
    it("corta o nome e cai para o nome atual quando o rascunho é só espaço", () => {
      const { vm, service } = makeVm();
      vm.updateDetails(path(), { name: "   ", description: "nova descrição" });
      expect(service.updateLearningPath).toHaveBeenCalledWith("trilha-1", {
        name: "Cloud Native",
        description: "nova descrição",
      });
    });

    it("nunca corta a descrição — mesmo comportamento que já existia inline", () => {
      const { vm, service } = makeVm();
      vm.updateDetails(path(), { name: "Cloud Native II", description: "  com espaço  " });
      expect(service.updateLearningPath).toHaveBeenCalledWith("trilha-1", {
        name: "Cloud Native II",
        description: "  com espaço  ",
      });
    });
  });

  describe("toggleCompetency / toggleAssignment", () => {
    it("toggleCompetency adiciona quando ausente", () => {
      const { vm, service } = makeVm();
      vm.toggleCompetency(path({ competencyIds: ["cloud-k8s"] }), "cloud-terraform");
      expect(service.updateLearningPath).toHaveBeenCalledWith("trilha-1", {
        competencyIds: ["cloud-k8s", "cloud-terraform"],
      });
    });

    it("toggleCompetency remove quando já presente", () => {
      const { vm, service } = makeVm();
      vm.toggleCompetency(path({ competencyIds: ["cloud-k8s", "cloud-terraform"] }), "cloud-k8s");
      expect(service.updateLearningPath).toHaveBeenCalledWith("trilha-1", {
        competencyIds: ["cloud-terraform"],
      });
    });

    it("toggleAssignment adiciona/remove sem afetar competencyIds", () => {
      const { vm, service } = makeVm();
      vm.toggleAssignment(path({ assignedTo: ["ana"] }), "bruno");
      expect(service.updateLearningPath).toHaveBeenCalledWith("trilha-1", {
        assignedTo: ["ana", "bruno"],
      });

      vm.toggleAssignment(path({ assignedTo: ["ana", "bruno"] }), "ana");
      expect(service.updateLearningPath).toHaveBeenCalledWith("trilha-1", {
        assignedTo: ["bruno"],
      });
    });
  });

  describe("assignableArchitects", () => {
    it("AUDITORIA-TERCEIRA-RODADA, EPIC E: inclui ativos e quem já está atribuído mesmo inativo", () => {
      const { vm } = makeVm();
      const architects = [
        architect({ id: "ana", active: true }),
        architect({ id: "bruno", active: false }),
        architect({ id: "carla", active: false }),
      ];
      const result = vm.assignableArchitects(architects, ["bruno"]);
      expect(result.map((a) => a.id)).toEqual(["ana", "bruno"]);
    });

    it("sem ninguém já atribuído (trilha nova), equivale a filtrar só por `active`", () => {
      const { vm } = makeVm();
      const architects = [
        architect({ id: "ana", active: true }),
        architect({ id: "bruno", active: false }),
      ];
      const result = vm.assignableArchitects(architects, []);
      expect(result.map((a) => a.id)).toEqual(["ana"]);
    });
  });

  describe("addItem", () => {
    it("gera id no cliente (lpi-*), corta o título, hora inválida cai para 1", () => {
      const { vm, service } = makeVm();
      vm.addItem("trilha-1", "  Curso de Terraform  ", "Curso", "abc");
      expect(service.addLearningPathItem).toHaveBeenCalledWith(
        "trilha-1",
        expect.objectContaining({
          title: "Curso de Terraform",
          type: "Curso",
          hours: 1,
        }),
      );
      const [, item] = service.addLearningPathItem.mock.calls[0] as [string, LearningPathItem];
      expect(item.id).toMatch(/^lpi-\d+$/);
    });

    it("hora numérica válida é preservada", () => {
      const { vm, service } = makeVm();
      vm.addItem("trilha-1", "Laboratório de Redis", "Laboratório", "6");
      expect(service.addLearningPathItem).toHaveBeenCalledWith(
        "trilha-1",
        expect.objectContaining({ hours: 6 }),
      );
    });
  });

  describe("updateItem", () => {
    it("recomputa só o item alvo, mantendo os demais intactos", () => {
      const { vm, service } = makeVm();
      const p = path({
        items: [
          { id: "item-1", title: "Curso A", type: "Curso", hours: 4 },
          { id: "item-2", title: "Curso B", type: "Curso", hours: 8 },
        ],
      });
      vm.updateItem(p, "item-1", { hours: 10 });
      expect(service.updateLearningPath).toHaveBeenCalledWith("trilha-1", {
        items: [
          { id: "item-1", title: "Curso A", type: "Curso", hours: 10 },
          { id: "item-2", title: "Curso B", type: "Curso", hours: 8 },
        ],
      });
    });
  });

  describe("removeItem / removePath", () => {
    it("removeItem delega 1:1 para o serviço", () => {
      const { vm, service } = makeVm();
      vm.removeItem("trilha-1", "item-1");
      expect(service.removeLearningPathItem).toHaveBeenCalledWith("trilha-1", "item-1");
    });

    it("removePath delega 1:1 para o serviço", () => {
      const { vm, service } = makeVm();
      vm.removePath("trilha-1");
      expect(service.removeLearningPath).toHaveBeenCalledWith("trilha-1");
    });
  });

  describe("progresso (OO3-11l/D-4)", () => {
    const paths = {
      comProgresso: {
        items: [{ id: "i1" }, { id: "i2" }] as never,
        assignedTo: ["ana", "bruno"],
        progress: [
          { architectId: "ana", itemId: "i1", status: "Completed", progress: 100 },
          { architectId: "ana", itemId: "i2", status: "In Progress", progress: 51 },
        ] as never,
      },
      semItem: { items: [] as never, assignedTo: ["ana"], progress: [] as never },
      semPessoa: { items: [{ id: "i1" }] as never, assignedTo: [], progress: [] as never },
    };

    it("progressFor devolve o registro da pessoa, ou o zero explícito se ainda não tocou", () => {
      const { vm } = makeVm();
      expect(vm.progressFor(paths.comProgresso, "ana", "i1").progress).toBe(100);
      expect(vm.progressFor(paths.comProgresso, "bruno", "i1")).toEqual({
        architectId: "bruno",
        itemId: "i1",
        status: "Not Started",
        progress: 0,
      });
    });

    it("progressPercentFor arredonda só no nível externo; teamProgressPercent faz média das médias cruas", () => {
      const { vm } = makeVm();
      // ana: (100+51)/2 = 75.5 → 76; bruno: 0.
      expect(vm.progressPercentFor(paths.comProgresso, "ana")).toBe(76);
      // time: (75.5 + 0)/2 = 37.75 → 38 (médias por pessoa CRUAS, round só no total).
      expect(vm.teamProgressPercent(paths.comProgresso)).toBe(38);
    });

    it("trilha sem item = 0 e trilha sem pessoa atribuída = 0 — nunca NaN", () => {
      const { vm } = makeVm();
      expect(vm.progressPercentFor(paths.semItem, "ana")).toBe(0);
      expect(vm.teamProgressPercent(paths.semPessoa)).toBe(0);
    });
  });

  describe("recordProgress", () => {
    it("delega (pathId, architectId, itemId, progress) 1:1 para o serviço", () => {
      const { vm, service } = makeVm();
      vm.recordProgress("trilha-1", "ana", "item-1", 70);
      expect(service.updateLearningItemProgress).toHaveBeenCalledWith(
        "trilha-1",
        "ana",
        "item-1",
        70,
      );
    });
  });
});
