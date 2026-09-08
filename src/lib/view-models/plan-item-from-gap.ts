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
  professionalId: string,
  draft: PlanItemFromGapDraft,
): Promise<DevelopmentPlan> {
  return service.createPlanItemFromGap(professionalId, {
    id: `pdi-${professionalId}-${draft.competencyId}-${Date.now()}`,
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
  private readonly professionalByCompetency: ReadonlyMap<string, string>;

  constructor(
    professionals: readonly { id: string }[],
    gapsFor: (professionalId: string) => readonly Gap[],
  ) {
    const furthest = new Map<string, { professionalId: string; distance: number }>();
    for (const professional of professionals) {
      for (const gap of gapsFor(professional.id)) {
        if (gap.gap <= 0 || !gap.competency) continue;
        const known = furthest.get(gap.competency.id);
        if (!known || gap.gap > known.distance) {
          furthest.set(gap.competency.id, { professionalId: professional.id, distance: gap.gap });
        }
      }
    }
    this.professionalByCompetency = new Map(
      [...furthest].map(([competencyId, who]) => [competencyId, who.professionalId]),
    );
  }

  professionalFor(competencyId: string): string | undefined {
    return this.professionalByCompetency.get(competencyId);
  }
}
