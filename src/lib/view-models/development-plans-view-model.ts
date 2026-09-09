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

  /**
   * Otimista, com a MESMA régua do `removeItem`: `onConfirmed` roda quando o
   * serviço confirma. O selo "Salvo" do campo é uma afirmação à pessoa, e
   * afirmação sem confirmação é mentira — antes ele acendia no gesto, e o
   * PATCH recusado não apagava nada.
   */
  saveActionPlan(
    planId: string,
    itemId: string,
    actionPlan: string,
    onConfirmed?: () => void,
  ): void {
    this.service.updatePlanItem(planId, itemId, { actionPlan }, onConfirmed);
  }

  setItemTargetDate(planId: string, itemId: string, targetDate: string): void {
    this.service.updatePlanItem(planId, itemId, { targetDate });
  }

  defineSmartGoal(planId: string, itemId: string, smart: SmartGoal): void {
    this.service.updatePlanItem(planId, itemId, { smart });
  }

  /** Otimista: `onConfirmed` roda quando o serviço confirma — o aviso de sucesso vai lá, não no clique. */
  removeItem(planId: string, itemId: string, onConfirmed?: () => void): void {
    this.service.removePlanItem(planId, itemId, onConfirmed);
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
    professionalId: string,
    gap: Gap,
    draft: NewPlanItemDraft,
    ownerName: string,
  ): Promise<DevelopmentPlan> {
    return createPlanItemFromGap(this.service, professionalId, {
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
