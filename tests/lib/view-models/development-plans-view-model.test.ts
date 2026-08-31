import { describe, expect, it, vi } from "vitest";

import type { DevelopmentPlan, SmartGoal } from "@/lib/domain";
import type { Gap } from "@/lib/selectors";
import { TextTemplateRenderer } from "@/lib/text-templates";
import { DevelopmentPlansViewModel, type DevelopmentPlanService } from "@/lib/view-models";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 60) — segundo ViewModel de tela desta fase, testado direto com um
 * `DevelopmentPlanService` falso (sem montar `useStore()`/React) — os
 * testes de componente existentes (`pdi-lifecycle.test.tsx`) já cobrem o
 * fim a fim via UI; estes cobrem a classe isolada.
 */
function fakeService(): DevelopmentPlanService & {
  updatePlanStatus: ReturnType<typeof vi.fn>;
  reopenPlan: ReturnType<typeof vi.fn>;
  updatePlanItem: ReturnType<typeof vi.fn>;
  removePlanItem: ReturnType<typeof vi.fn>;
  reschedulePlanItem: ReturnType<typeof vi.fn>;
  addPlanItemCheckin: ReturnType<typeof vi.fn>;
  createPlanItemFromGap: ReturnType<typeof vi.fn>;
} {
  return {
    updatePlanStatus: vi.fn(
      async (planId: string, status: DevelopmentPlan["status"]) =>
        ({ id: planId, status }) as DevelopmentPlan,
    ),
    reopenPlan: vi.fn(
      async (planId: string) => ({ id: planId, status: "Approved" }) as DevelopmentPlan,
    ),
    updatePlanItem: vi.fn(),
    removePlanItem: vi.fn(),
    reschedulePlanItem: vi.fn(async (planId: string) => ({ id: planId }) as DevelopmentPlan),
    addPlanItemCheckin: vi.fn(async (planId: string) => ({ id: planId }) as DevelopmentPlan),
    createPlanItemFromGap: vi.fn(
      async (architectId: string) => ({ id: architectId }) as DevelopmentPlan,
    ),
  };
}

const gap = (competencyId: string, value: number): Gap =>
  ({
    competency: { id: competencyId, name: competencyId } as Gap["competency"],
    item: { competencyId } as Gap["item"],
    gap: value,
    assessmentId: "assessment-1",
    targetSemantics: "NEXT_ROLE",
  }) as Gap;

describe("DevelopmentPlansViewModel", () => {
  describe("status do plano do ciclo", () => {
    it("arquiteto sem plano no ciclo conta como rascunho", () => {
      const vm = new DevelopmentPlansViewModel(fakeService());
      expect(vm.statusOf(undefined)).toBe("Draft");
    });

    it("com plano, o status é o do próprio plano", () => {
      const vm = new DevelopmentPlansViewModel(fakeService());
      expect(vm.statusOf({ status: "Completed" } as DevelopmentPlan)).toBe("Completed");
    });
  });

  describe("fluxo do plano", () => {
    it("sem plano, o fluxo é o de um rascunho — o líder pode aprovar", () => {
      const vm = new DevelopmentPlansViewModel(fakeService());
      const workflow = vm.workflowFor(undefined, {
        actsForArchitect: true,
        isLeadOfArchitect: true,
        isAssignedTechLead: false,
      });
      expect(workflow.canApprove).toBe(true);
      expect(workflow.canEditDiagnostic).toBe(true);
    });

    it("com plano concluído, o fluxo trava a edição de execução", () => {
      const vm = new DevelopmentPlansViewModel(fakeService());
      const workflow = vm.workflowFor({ status: "Completed" } as DevelopmentPlan, {
        actsForArchitect: true,
        isLeadOfArchitect: true,
        isAssignedTechLead: false,
      });
      expect(workflow.canEditExecution).toBe(false);
      expect(workflow.ownerSeesLockedMessage).toBe(true);
    });
  });

  describe("approve / complete / returnToDraft", () => {
    it("approve chama updatePlanStatus(planId, 'Approved')", async () => {
      const service = fakeService();
      const vm = new DevelopmentPlansViewModel(service);
      await vm.approve("plano-1");
      expect(service.updatePlanStatus).toHaveBeenCalledWith("plano-1", "Approved");
    });

    it("complete chama updatePlanStatus(planId, 'Completed')", async () => {
      const service = fakeService();
      const vm = new DevelopmentPlansViewModel(service);
      await vm.complete("plano-1");
      expect(service.updatePlanStatus).toHaveBeenCalledWith("plano-1", "Completed");
    });

    it("returnToDraft chama updatePlanStatus(planId, 'Draft')", async () => {
      const service = fakeService();
      const vm = new DevelopmentPlansViewModel(service);
      await vm.returnToDraft("plano-1");
      expect(service.updatePlanStatus).toHaveBeenCalledWith("plano-1", "Draft");
    });

    it("propaga o erro do serviço — quem chama decide toast/mensagem", async () => {
      const service = fakeService();
      service.updatePlanStatus.mockRejectedValueOnce(new Error("409 conflito de versão"));
      const vm = new DevelopmentPlansViewModel(service);
      await expect(vm.approve("plano-1")).rejects.toThrow("409 conflito de versão");
    });
  });

  describe("reopen", () => {
    it("chama reopenPlan(planId, reason) e nunca updatePlanStatus", async () => {
      const service = fakeService();
      const vm = new DevelopmentPlansViewModel(service);
      await vm.reopen("plano-1", "Encontrado erro na avaliação original");
      expect(service.reopenPlan).toHaveBeenCalledWith(
        "plano-1",
        "Encontrado erro na avaliação original",
      );
      expect(service.updatePlanStatus).not.toHaveBeenCalled();
    });
  });

  describe("suggestions", () => {
    const vm = new DevelopmentPlansViewModel(fakeService());

    it("exclui gaps que já viraram item do plano", () => {
      const gaps = [gap("a", 2), gap("b", 1)];
      const plan = { items: [{ competencyId: "a" }] } as unknown as DevelopmentPlan;
      expect(vm.suggestions(gaps, plan).map((g) => g.item.competencyId)).toEqual(["b"]);
    });

    it("sem plano (nenhum item ainda criado), nenhum gap é excluído", () => {
      const gaps = [gap("a", 2), gap("b", 1)];
      expect(vm.suggestions(gaps, undefined)).toHaveLength(2);
    });

    it("limita a 5 sugestões mesmo com mais gaps disponíveis", () => {
      const gaps = Array.from({ length: 8 }, (_, i) => gap(`c${i}`, 8 - i));
      expect(vm.suggestions(gaps, undefined)).toHaveLength(5);
    });
  });

  // ---- Comandos de item (OO3-10b) ----

  describe("comandos de campo do item (updatePlanItem)", () => {
    it("setItemActionType envia só { actionType }", () => {
      const service = fakeService();
      new DevelopmentPlansViewModel(service).setItemActionType("plano-1", "item-1", "Teach");
      expect(service.updatePlanItem).toHaveBeenCalledWith("plano-1", "item-1", {
        actionType: "Teach",
      });
    });

    it("setItemStatus envia só { status }", () => {
      const service = fakeService();
      new DevelopmentPlansViewModel(service).setItemStatus("plano-1", "item-1", "In Progress");
      expect(service.updatePlanItem).toHaveBeenCalledWith("plano-1", "item-1", {
        status: "In Progress",
      });
    });

    it("saveActionPlan envia só { actionPlan }", () => {
      const service = fakeService();
      new DevelopmentPlansViewModel(service).saveActionPlan("plano-1", "item-1", "Ler o RFC 9110");
      expect(service.updatePlanItem).toHaveBeenCalledWith("plano-1", "item-1", {
        actionPlan: "Ler o RFC 9110",
      });
    });

    it("setItemTargetDate envia só { targetDate } (PATCH genérico, só em Draft)", () => {
      const service = fakeService();
      new DevelopmentPlansViewModel(service).setItemTargetDate("plano-1", "item-1", "2026-12-01");
      expect(service.updatePlanItem).toHaveBeenCalledWith("plano-1", "item-1", {
        targetDate: "2026-12-01",
      });
    });

    it("defineSmartGoal envia o objeto SMART completo como { smart }", () => {
      const service = fakeService();
      const smart: SmartGoal = {
        specific: "s",
        measurable: "m",
        achievable: "a",
        relevant: "r",
        timeBound: "t",
        statement: "frase",
      };
      new DevelopmentPlansViewModel(service).defineSmartGoal("plano-1", "item-1", smart);
      expect(service.updatePlanItem).toHaveBeenCalledWith("plano-1", "item-1", { smart });
    });
  });

  describe("removeItem", () => {
    it("delega para removePlanItem(planId, itemId)", () => {
      const service = fakeService();
      new DevelopmentPlansViewModel(service).removeItem("plano-1", "item-1");
      expect(service.removePlanItem).toHaveBeenCalledWith("plano-1", "item-1");
    });
  });

  describe("reschedule", () => {
    it("corta espaços do motivo antes de delegar (comando dedicado, ENT-09-010)", async () => {
      const service = fakeService();
      const vm = new DevelopmentPlansViewModel(service);
      await vm.reschedule("plano-1", "item-1", "2026-12-01", "  cliente adiou a entrega  ");
      expect(service.reschedulePlanItem).toHaveBeenCalledWith(
        "plano-1",
        "item-1",
        "2026-12-01",
        "cliente adiou a entrega",
      );
    });

    it("propaga o erro do serviço — o diálogo decide a mensagem", async () => {
      const service = fakeService();
      service.reschedulePlanItem.mockRejectedValueOnce(new Error("409 conflito de versão"));
      const vm = new DevelopmentPlansViewModel(service);
      await expect(vm.reschedule("plano-1", "item-1", "2026-12-01", "motivo")).rejects.toThrow(
        "409 conflito de versão",
      );
    });
  });

  describe("addCheckin", () => {
    it("corta espaços do texto antes de delegar", async () => {
      const service = fakeService();
      await new DevelopmentPlansViewModel(service).addCheckin(
        "plano-1",
        "item-1",
        "  primeira semana concluída  ",
      );
      expect(service.addPlanItemCheckin).toHaveBeenCalledWith(
        "plano-1",
        "item-1",
        "primeira semana concluída",
      );
    });
  });

  describe("createItemFromGap", () => {
    const officialGap = {
      competency: { id: "cloud-k8s", name: "Kubernetes" },
      item: { competencyId: "cloud-k8s", final: 1, target: 2 },
      gap: 1,
      assessmentId: "assessment-1",
      targetSemantics: "NEXT_ROLE",
    } as unknown as Gap;

    const draft = {
      actionType: "Learn" as const,
      actionPlan: "Curso CKA",
      targetDate: "2026-12-01",
      dedicationHoursPerWeek: 4,
    };

    it("monta o payload: id de cliente pdi-*, objetivo pt-BR derivado do gap, níveis nunca enviados", async () => {
      const service = fakeService();
      const vm = new DevelopmentPlansViewModel(service);
      await vm.createItemFromGap("ana", officialGap, draft, "Ana Martins");
      expect(service.createPlanItemFromGap).toHaveBeenCalledWith(
        "ana",
        expect.objectContaining({
          assessmentId: "assessment-1",
          competencyId: "cloud-k8s",
          objective: "Evoluir Kubernetes do nível 1 para o nível 2",
          actionType: "Learn",
          actionPlan: "Curso CKA",
          targetDate: "2026-12-01",
          owner: "Ana Martins",
          dedicationHoursPerWeek: 4,
        }),
      );
      const [, item] = service.createPlanItemFromGap.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(item["id"]).toMatch(/^pdi-ana-cloud-k8s-\d+$/);
      // O servidor deriva currentLevel/targetLevel/priority do assessment — nunca vão no corpo.
      expect(item).not.toHaveProperty("currentLevel");
      expect(item).not.toHaveProperty("targetLevel");
      expect(item).not.toHaveProperty("priority");
    });

    it("dedicação em branco (null) vai como null — a chave não some do corpo", async () => {
      const service = fakeService();
      const vm = new DevelopmentPlansViewModel(service);
      await vm.createItemFromGap(
        "ana",
        officialGap,
        { ...draft, dedicationHoursPerWeek: null },
        "Ana Martins",
      );
      const [, item] = service.createPlanItemFromGap.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(item).toHaveProperty("dedicationHoursPerWeek", null);
    });

    // CFG-03 — o objetivo passa a vir do template de `text_templates` no
    // locale ativo, injetado no construtor. Sem injeção (testes acima), o
    // default = seed em pt, byte-idêntico ao literal antigo.

    it("app em en: objetivo persistido em inglês (era o bug — texto sempre pt)", async () => {
      const service = fakeService();
      const vm = new DevelopmentPlansViewModel(
        service,
        TextTemplateRenderer.fromLoaded(undefined, "en").objectiveFromGap,
      );
      await vm.createItemFromGap("ana", officialGap, draft, "Ana Martins");
      expect(service.createPlanItemFromGap).toHaveBeenCalledWith(
        "ana",
        expect.objectContaining({ objective: "Evolve Kubernetes from level 1 to level 2" }),
      );
    });

    it("guard rail: template alterado pelo admin (PUT) muda o objetivo gerado sem deploy", async () => {
      const service = fakeService();
      const vm = new DevelopmentPlansViewModel(
        service,
        TextTemplateRenderer.fromLoaded(
          {
            "pdi.objective.fromGap": { pt: "Levar {competencia} ao nível {alvo} (hoje {atual})" },
          },
          "pt",
        ).objectiveFromGap,
      );
      await vm.createItemFromGap("ana", officialGap, draft, "Ana Martins");
      expect(service.createPlanItemFromGap).toHaveBeenCalledWith(
        "ana",
        expect.objectContaining({ objective: "Levar Kubernetes ao nível 2 (hoje 1)" }),
      );
    });

    it("propaga o erro do serviço (gap inválido, capacidade não confirmada) — o diálogo decide a mensagem", async () => {
      const service = fakeService();
      service.createPlanItemFromGap.mockRejectedValueOnce(new Error("400 gap não elegível"));
      const vm = new DevelopmentPlansViewModel(service);
      await expect(vm.createItemFromGap("ana", officialGap, draft, "Ana Martins")).rejects.toThrow(
        "400 gap não elegível",
      );
    });
  });
});
