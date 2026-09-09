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
  actsForProfessional: false,
  isLeadOfProfessional: false,
  ...parcial,
});

const item = (status: DevelopmentPlanItem["status"]): DevelopmentPlanItem =>
  ({ id: `item-${status}`, status }) as DevelopmentPlanItem;

const STATUSES: DevelopmentPlan["status"][] = ["Draft", "Approved", "Completed"];

describe("PlanWorkflowPolicy", () => {
  describe("aprovar", () => {
    it("o líder aprova o plano em Draft, e só nele", () => {
      for (const status of STATUSES) {
        const policy = new PlanWorkflowPolicy(status, reach({ isLeadOfProfessional: true }));
        expect(policy.canApprove).toBe(status === "Draft");
      }
    });

    it("quem não é líder não aprova nem em Draft", () => {
      const policy = new PlanWorkflowPolicy("Draft", reach({ actsForProfessional: true }));
      expect(policy.canApprove).toBe(false);
    });
  });

  describe("devolver para rascunho", () => {
    it("o líder devolve o plano Approved, e só ele", () => {
      for (const status of STATUSES) {
        const policy = new PlanWorkflowPolicy(status, reach({ isLeadOfProfessional: true }));
        expect(policy.canReturnToDraft).toBe(status === "Approved");
      }
    });

    it("quem só age pelo profissional não devolve o plano aprovado", () => {
      const policy = new PlanWorkflowPolicy("Approved", reach({ actsForProfessional: true }));
      expect(policy.canReturnToDraft).toBe(false);
    });
  });

  describe("concluir", () => {
    it("quem age pelo profissional conclui o plano Approved, e só ele", () => {
      for (const status of STATUSES) {
        const policy = new PlanWorkflowPolicy(status, reach({ actsForProfessional: true }));
        expect(policy.canComplete).toBe(status === "Approved");
      }
    });

    it("líder que não age pelo profissional não conclui", () => {
      const policy = new PlanWorkflowPolicy("Approved", reach({ isLeadOfProfessional: true }));
      expect(policy.canComplete).toBe(false);
    });
  });

  /**
   * FATIA PRAZOS, item 4 — reabrir é de QUEM LIDERA (gerente ou tech lead) e
   * do administrador, a mesma liderança que conclui. A tela dizia "Somente o
   * Tech Lead responsável pode reabri-lo", e dizia a verdade sobre o backend
   * de então: os dois perguntavam pelo vínculo estrito de tech lead e
   * recusavam o gerente numa ação que a régua lhe dá.
   */
  describe("reabrir", () => {
    it("quem age pela pessoa reabre o plano Completed, e só nele — gerente, tech lead ou administrador", () => {
      for (const status of STATUSES) {
        const policy = new PlanWorkflowPolicy(status, reach({ actsForProfessional: true }));
        expect(policy.canReopen).toBe(status === "Completed");
      }
    });

    it("reabrir e concluir respondem à MESMA liderança", () => {
      const lideranca = new PlanWorkflowPolicy("Completed", reach({ actsForProfessional: true }));
      const semAlcance = new PlanWorkflowPolicy("Completed", reach());

      expect(lideranca.canReopen).toBe(true);
      expect(semAlcance.canReopen).toBe(false);
    });

    it("quem não age pela pessoa lê o plano concluído e a tela explica quem reabre", () => {
      const policy = new PlanWorkflowPolicy("Completed", reach());

      expect(policy.canReopen).toBe(false);
      expect(policy.seesCompletedWithoutReopen).toBe(true);
    });

    it("quem PODE reabrir não vê o aviso — ele tem o botão", () => {
      const policy = new PlanWorkflowPolicy("Completed", reach({ actsForProfessional: true }));

      expect(policy.seesCompletedWithoutReopen).toBe(false);
    });

    it("plano não concluído não mostra o aviso a ninguém", () => {
      for (const status of ["Draft", "Approved"] as const) {
        expect(new PlanWorkflowPolicy(status, reach()).seesCompletedWithoutReopen).toBe(false);
      }
    });
  });

  describe("edição do diagnóstico e da execução", () => {
    it("o diagnóstico só se edita em Draft, e só por quem age pelo profissional", () => {
      for (const status of STATUSES) {
        expect(
          new PlanWorkflowPolicy(status, reach({ actsForProfessional: true })).canEditDiagnostic,
        ).toBe(status === "Draft");
        expect(
          new PlanWorkflowPolicy(status, reach({ isLeadOfProfessional: true })).canEditDiagnostic,
        ).toBe(false);
      }
    });

    it("a execução se edita até o plano ser concluído", () => {
      for (const status of STATUSES) {
        expect(
          new PlanWorkflowPolicy(status, reach({ actsForProfessional: true })).canEditExecution,
        ).toBe(status !== "Completed");
      }
    });

    it("remarcar item exige plano Approved e edição de execução liberada", () => {
      for (const status of STATUSES) {
        expect(
          new PlanWorkflowPolicy(status, reach({ actsForProfessional: true })).canRescheduleItems,
        ).toBe(status === "Approved");
      }
      expect(
        new PlanWorkflowPolicy("Approved", reach({ isLeadOfProfessional: true }))
          .canRescheduleItems,
      ).toBe(false);
    });
  });

  describe("o que impede a conclusão", () => {
    const policy = new PlanWorkflowPolicy("Approved", reach({ actsForProfessional: true }));

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
