import type { DevelopmentPlan, DevelopmentPlanItem } from "../domain";
import type { Gap } from "../selectors";
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

export class FurthestFromTarget {
  private readonly architectByCompetency: ReadonlyMap<string, string>;

  constructor(
    architects: readonly { id: string }[],
    gapsFor: (architectId: string) => readonly Gap[],
  ) {
    const furthest = new Map<string, { architectId: string; distance: number }>();
    for (const architect of architects) {
      for (const gap of gapsFor(architect.id)) {
        if (gap.gap <= 0 || !gap.competency) continue;
        const known = furthest.get(gap.competency.id);
        if (!known || gap.gap > known.distance) {
          furthest.set(gap.competency.id, { architectId: architect.id, distance: gap.gap });
        }
      }
    }
    this.architectByCompetency = new Map(
      [...furthest].map(([competencyId, who]) => [competencyId, who.architectId]),
    );
  }

  architectFor(competencyId: string): string | undefined {
    return this.architectByCompetency.get(competencyId);
  }
}
