import type { DevelopmentPlan, DevelopmentPlanItem } from "./domain";
import type { MessageKey } from "./i18n";

export type PlanStatus = DevelopmentPlan["status"];

export interface PlanActorReach {
  readonly actsForProfessional: boolean;
  readonly isLeadOfProfessional: boolean;
}

export class PlanWorkflowPolicy {
  constructor(
    private readonly status: PlanStatus,
    private readonly reach: PlanActorReach,
  ) {}

  static forPlan(plan: DevelopmentPlan | undefined, reach: PlanActorReach): PlanWorkflowPolicy {
    return new PlanWorkflowPolicy(plan?.status ?? "Draft", reach);
  }

  get canApprove(): boolean {
    return this.status === "Draft" && this.reach.isLeadOfProfessional;
  }

  get canReturnToDraft(): boolean {
    return this.status === "Approved" && this.reach.isLeadOfProfessional;
  }

  get canComplete(): boolean {
    return this.status === "Approved" && this.reach.actsForProfessional;
  }

  /**
   * Fatia PRAZOS, item 4 — reabrir é de QUEM LIDERA a pessoa (gerente ou tech
   * lead) e do administrador: a mesma liderança que conclui, e a mesma
   * pergunta que o backend faz (`reopensDevelopmentPlanOf`). Perguntava pelo
   * vínculo estrito de tech lead e recusava o gerente numa ação que a régua
   * lhe dá (`papeis-2026-09-06.md` §3).
   */
  get canReopen(): boolean {
    return this.status === "Completed" && this.reach.actsForProfessional;
  }

  /** Quem lê um PDI concluído sem poder reabri-lo merece saber quem reabre. */
  get seesCompletedWithoutReopen(): boolean {
    return this.status === "Completed" && !this.canReopen;
  }

  get canEditDiagnostic(): boolean {
    return this.reach.actsForProfessional && this.status === "Draft";
  }

  get canEditExecution(): boolean {
    return this.reach.actsForProfessional && this.status !== "Completed";
  }

  get canRescheduleItems(): boolean {
    return this.canEditExecution && this.status === "Approved";
  }

  get newActionBlockedReasonKey(): MessageKey | undefined {
    if (this.canEditDiagnostic) return undefined;
    if (!this.reach.actsForProfessional) return "pdi.newAction.blocked.notYours";
    if (this.status === "Completed") return "pdi.newAction.blocked.completed";
    return "pdi.newAction.blocked.approved";
  }

  completionBlockedReasonKey(items: readonly DevelopmentPlanItem[]): MessageKey | undefined {
    if (items.length === 0) return "pdi.plan.incomplete.noItems";
    if (items.some((item) => item.status === "Not Started")) {
      return "pdi.plan.incomplete.notStarted";
    }
    return undefined;
  }
}
