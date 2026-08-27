import type { DevelopmentPlan, DevelopmentPlanItem } from "../domain";
import type { Api } from "../store";
import { defaultDateFormatter } from "../text";

type PlanItemFromGapService = Pick<Api, "createPlanItemFromGap">;

interface PlanItemFromGapDraft {
  assessmentId: string;
  competencyId: string;
  objective: string;
  actionType: DevelopmentPlanItem["actionType"];
  actionPlan: string;
  targetDate: string;
  owner: string;

  dedicationHoursPerWeek?: number | null;
}

export function createPlanItemFromGap(
  service: PlanItemFromGapService,
  architectId: string,
  draft: PlanItemFromGapDraft,
): Promise<DevelopmentPlan> {
  return service.createPlanItemFromGap(architectId, {
    id: `pdi-${architectId}-${draft.competencyId}-${Date.now()}`,
    assessmentId: draft.assessmentId,
    competencyId: draft.competencyId,
    objective: draft.objective,
    actionType: draft.actionType,
    actionPlan: draft.actionPlan,
    startDate: defaultDateFormatter.todayIso(),
    targetDate: draft.targetDate,
    owner: draft.owner,
    ...(draft.dedicationHoursPerWeek !== undefined
      ? { dedicationHoursPerWeek: draft.dedicationHoursPerWeek }
      : {}),
  });
}
