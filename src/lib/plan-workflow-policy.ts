import type { DevelopmentPlan, DevelopmentPlanItem } from "./domain";
import type { MessageKey } from "./i18n";

export type PlanStatus = DevelopmentPlan["status"];

export interface PlanActorReach {
  readonly actsForProfessional: boolean;
  readonly isLeadOfProfessional: boolean;
  readonly isAssignedTechLead: boolean;
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

  get canReopen(): boolean {
    return this.status === "Completed" && this.reach.isAssignedTechLead;
  }

  get ownerSeesLockedMessage(): boolean {
    return (
      this.status === "Completed" &&
      this.reach.actsForProfessional &&
      !this.reach.isAssignedTechLead
    );
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
