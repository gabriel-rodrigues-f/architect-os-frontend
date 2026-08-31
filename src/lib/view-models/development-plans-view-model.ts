import type { ActionType, DevelopmentPlan, PdiStatus, SmartGoal } from "../domain";
import { PlanWorkflowPolicy, type PlanActorReach, type PlanStatus } from "../plan-workflow-policy";
import type { Gap } from "../selectors";
import type { Api } from "../store";
import { defaultObjectiveFromGap, type RenderObjectiveFromGap } from "../text-templates";
import { createPlanItemFromGap } from "./plan-item-from-gap";

export type DevelopmentPlanService = Pick<
  Api,
  | "updatePlanStatus"
  | "reopenPlan"
  | "updatePlanItem"
  | "removePlanItem"
  | "reschedulePlanItem"
  | "addPlanItemCheckin"
  | "createPlanItemFromGap"
>;

interface NewPlanItemDraft {
  actionType: ActionType;
  actionPlan: string;
  targetDate: string;
  dedicationHoursPerWeek: number | null;
}

export class DevelopmentPlansViewModel {
  constructor(
    private readonly service: DevelopmentPlanService,
    private readonly objectiveFromGap: RenderObjectiveFromGap = defaultObjectiveFromGap,
  ) {}

  statusOf(plan: DevelopmentPlan | undefined): PlanStatus {
    return plan?.status ?? "Draft";
  }

  workflowFor(plan: DevelopmentPlan | undefined, reach: PlanActorReach): PlanWorkflowPolicy {
    return PlanWorkflowPolicy.forPlan(plan, reach);
  }

  async approve(planId: string): Promise<DevelopmentPlan> {
    return this.service.updatePlanStatus(planId, "Approved");
  }

  async complete(planId: string): Promise<DevelopmentPlan> {
    return this.service.updatePlanStatus(planId, "Completed");
  }

  async returnToDraft(planId: string): Promise<DevelopmentPlan> {
    return this.service.updatePlanStatus(planId, "Draft");
  }

  async reopen(planId: string, reason: string): Promise<DevelopmentPlan> {
    return this.service.reopenPlan(planId, reason);
  }

  suggestions(positiveGaps: readonly Gap[], plan: DevelopmentPlan | undefined): Gap[] {
    return positiveGaps.filter(this.untreated(plan)).slice(0, 5);
  }

  treatableGap(
    positiveGaps: readonly Gap[],
    plan: DevelopmentPlan | undefined,
    competencyId: string,
  ): Gap | undefined {
    return positiveGaps
      .filter(this.untreated(plan))
      .find((g) => g.item.competencyId === competencyId);
  }

  private untreated(plan: DevelopmentPlan | undefined): (gap: Gap) => boolean {
    return (gap) => !plan?.items.some((item) => item.competencyId === gap.item.competencyId);
  }

  setItemActionType(planId: string, itemId: string, actionType: ActionType): void {
    this.service.updatePlanItem(planId, itemId, { actionType });
  }

  setItemStatus(planId: string, itemId: string, status: PdiStatus): void {
    this.service.updatePlanItem(planId, itemId, { status });
  }

  saveActionPlan(planId: string, itemId: string, actionPlan: string): void {
    this.service.updatePlanItem(planId, itemId, { actionPlan });
  }

  setItemTargetDate(planId: string, itemId: string, targetDate: string): void {
    this.service.updatePlanItem(planId, itemId, { targetDate });
  }

  defineSmartGoal(planId: string, itemId: string, smart: SmartGoal): void {
    this.service.updatePlanItem(planId, itemId, { smart });
  }

  removeItem(planId: string, itemId: string): void {
    this.service.removePlanItem(planId, itemId);
  }

  reschedule(
    planId: string,
    itemId: string,
    targetDate: string,
    reason: string,
  ): Promise<DevelopmentPlan> {
    return this.service.reschedulePlanItem(planId, itemId, targetDate, reason.trim());
  }

  addCheckin(planId: string, itemId: string, text: string): Promise<DevelopmentPlan> {
    return this.service.addPlanItemCheckin(planId, itemId, text.trim());
  }

  createItemFromGap(
    architectId: string,
    gap: Gap,
    draft: NewPlanItemDraft,
    ownerName: string,
  ): Promise<DevelopmentPlan> {
    return createPlanItemFromGap(this.service, architectId, {
      assessmentId: gap.assessmentId,
      competencyId: gap.item.competencyId,

      objective: this.objectiveFromGap({
        competencia: `${gap.competency?.name}`,
        atual: gap.item.final,
        alvo: gap.item.target,
      }),
      actionType: draft.actionType,
      actionPlan: draft.actionPlan,
      targetDate: draft.targetDate,
      owner: ownerName,
      dedicationHoursPerWeek: draft.dedicationHoursPerWeek,
    });
  }
}
