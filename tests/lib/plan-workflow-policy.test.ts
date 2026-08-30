import { describe, expect, it } from "vitest";

import type { DevelopmentPlan, DevelopmentPlanItem } from "@/lib/domain";
import { PlanWorkflowPolicy, type PlanActorReach } from "@/lib/plan-workflow-policy";

/**
 * R4 (varredura-oo-ddd-2026-08-29, §2c) — a matriz de permissão do fluxo do
 * PDI vivia inline em `development-plans.tsx:258-267`. Estes casos são o
 * espelho literal daquelas linhas: mesma condição, mesmo resultado. Se
 * algum deles mudar, o comportamento da tela mudou.
 */
const reach = (parcial: Partial<PlanActorReach> = {}): PlanActorReach => ({
  actsForArchitect: false,
  isLeadOfArchitect: false,
  isAssignedTechLead: false,
  ...parcial,
});

const item = (status: DevelopmentPlanItem["status"]): DevelopmentPlanItem =>
  ({ id: `item-${status}`, status }) as DevelopmentPlanItem;

const STATUSES: DevelopmentPlan["status"][] = ["Draft", "Approved", "Completed"];

describe("PlanWorkflowPolicy", () => {
  describe("aprovar", () => {
    it("o líder aprova o plano em Draft, e só nele", () => {
      for (const status of STATUSES) {
        const policy = new PlanWorkflowPolicy(status, reach({ isLeadOfArchitect: true }));
        expect(policy.canApprove).toBe(status === "Draft");
      }
    });

    it("quem não é líder não aprova nem em Draft", () => {
      const policy = new PlanWorkflowPolicy("Draft", reach({ actsForArchitect: true }));
      expect(policy.canApprove).toBe(false);
    });
  });

  describe("devolver para rascunho", () => {
    it("o líder devolve o plano Approved, e só ele", () => {
      for (const status of STATUSES) {
        const policy = new PlanWorkflowPolicy(status, reach({ isLeadOfArchitect: true }));
        expect(policy.canReturnToDraft).toBe(status === "Approved");
      }
    });

    it("quem só age pelo arquiteto não devolve o plano aprovado", () => {
      const policy = new PlanWorkflowPolicy("Approved", reach({ actsForArchitect: true }));
      expect(policy.canReturnToDraft).toBe(false);
    });
  });

  describe("concluir", () => {
    it("quem age pelo arquiteto conclui o plano Approved, e só ele", () => {
      for (const status of STATUSES) {
        const policy = new PlanWorkflowPolicy(status, reach({ actsForArchitect: true }));
        expect(policy.canComplete).toBe(status === "Approved");
      }
    });

    it("líder que não age pelo arquiteto não conclui", () => {
      const policy = new PlanWorkflowPolicy("Approved", reach({ isLeadOfArchitect: true }));
      expect(policy.canComplete).toBe(false);
    });
  });

  describe("reabrir", () => {
    it("o tech lead atribuído reabre o plano Completed, e só nele", () => {
      for (const status of STATUSES) {
        const policy = new PlanWorkflowPolicy(status, reach({ isAssignedTechLead: true }));
        expect(policy.canReopen).toBe(status === "Completed");
      }
    });

    it("o dono do plano concluído não o reabre — vê a mensagem de travado", () => {
      const policy = new PlanWorkflowPolicy("Completed", reach({ actsForArchitect: true }));
      expect(policy.canReopen).toBe(false);
      expect(policy.ownerSeesLockedMessage).toBe(true);
    });

    it("o tech lead atribuído que também age pelo arquiteto não vê a mensagem de travado", () => {
      const policy = new PlanWorkflowPolicy(
        "Completed",
        reach({ actsForArchitect: true, isAssignedTechLead: true }),
      );
      expect(policy.ownerSeesLockedMessage).toBe(false);
    });

    it("plano não concluído não mostra mensagem de travado a ninguém", () => {
      const policy = new PlanWorkflowPolicy("Approved", reach({ actsForArchitect: true }));
      expect(policy.ownerSeesLockedMessage).toBe(false);
    });
  });

  describe("edição do diagnóstico e da execução", () => {
    it("o diagnóstico só se edita em Draft, e só por quem age pelo arquiteto", () => {
      for (const status of STATUSES) {
        expect(
          new PlanWorkflowPolicy(status, reach({ actsForArchitect: true })).canEditDiagnostic,
        ).toBe(status === "Draft");
        expect(
          new PlanWorkflowPolicy(status, reach({ isLeadOfArchitect: true })).canEditDiagnostic,
        ).toBe(false);
      }
    });

    it("a execução se edita até o plano ser concluído", () => {
      for (const status of STATUSES) {
        expect(
          new PlanWorkflowPolicy(status, reach({ actsForArchitect: true })).canEditExecution,
        ).toBe(status !== "Completed");
      }
    });

    it("remarcar item exige plano Approved e edição de execução liberada", () => {
      for (const status of STATUSES) {
        expect(
          new PlanWorkflowPolicy(status, reach({ actsForArchitect: true })).canRescheduleItems,
        ).toBe(status === "Approved");
      }
      expect(
        new PlanWorkflowPolicy("Approved", reach({ isLeadOfArchitect: true })).canRescheduleItems,
      ).toBe(false);
    });
  });

  describe("o que impede a conclusão", () => {
    const policy = new PlanWorkflowPolicy("Approved", reach({ actsForArchitect: true }));

    it("plano sem item nenhum: não há o que concluir", () => {
      expect(policy.completionBlockedReasonKey([])).toBe("pdi.plan.incomplete.noItems");
    });

    it("item não iniciado impede a conclusão", () => {
      expect(policy.completionBlockedReasonKey([item("Not Started"), item("Completed")])).toBe(
        "pdi.plan.incomplete.notStarted",
      );
    });

    it("item bloqueado não impede — só o não iniciado", () => {
      expect(
        policy.completionBlockedReasonKey([item("Blocked"), item("Completed")]),
      ).toBeUndefined();
    });

    it("nada impede quando todos os itens saíram do Not Started", () => {
      expect(
        policy.completionBlockedReasonKey([item("In Progress"), item("Completed")]),
      ).toBeUndefined();
    });
  });
});
