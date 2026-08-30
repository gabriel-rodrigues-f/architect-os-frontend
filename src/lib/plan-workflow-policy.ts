import type { DevelopmentPlan, DevelopmentPlanItem } from "./domain";
import type { MessageKey } from "./i18n";

export type PlanStatus = DevelopmentPlan["status"];

export interface PlanActorReach {
  readonly actsForArchitect: boolean;
  readonly isLeadOfArchitect: boolean;
  readonly isAssignedTechLead: boolean;
}

export class PlanWorkflowPolicy {
  constructor(
    private readonly status: PlanStatus,
    private readonly reach: PlanActorReach,
  ) {}

  get canApprove(): boolean {
    return this.status === "Draft" && this.reach.isLeadOfArchitect;
  }

  get canReturnToDraft(): boolean {
    return this.status === "Approved" && this.reach.isLeadOfArchitect;
  }

  get canComplete(): boolean {
    return this.status === "Approved" && this.reach.actsForArchitect;
  }

  get canReopen(): boolean {
    return this.status === "Completed" && this.reach.isAssignedTechLead;
  }

  get ownerSeesLockedMessage(): boolean {
    return (
      this.status === "Completed" && this.reach.actsForArchitect && !this.reach.isAssignedTechLead
    );
  }

  get canEditDiagnostic(): boolean {
    return this.reach.actsForArchitect && this.status === "Draft";
  }

  get canEditExecution(): boolean {
    return this.reach.actsForArchitect && this.status !== "Completed";
  }

  get canRescheduleItems(): boolean {
    return this.canEditExecution && this.status === "Approved";
  }

  completionBlockedReasonKey(items: readonly DevelopmentPlanItem[]): MessageKey | undefined {
    if (items.length === 0) return "pdi.plan.incomplete.noItems";
    if (items.some((item) => item.status === "Not Started")) {
      return "pdi.plan.incomplete.notStarted";
    }
    return undefined;
  }
}
