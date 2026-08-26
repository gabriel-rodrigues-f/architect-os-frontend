import type { AppState } from "../api";
import type { Architect, DevelopmentPlan, LearningPath } from "../domain";
import { defaultGapSeverityRuler } from "../scoring-bands";
import type { Gap, Selectors } from "../selectors";

export interface AssessmentCoverage {
  completed: number;
  inReview: number;
  draft: number;
  notStarted: number;
}

export interface GapWithArchitect extends Gap {
  architect: Architect;
}

export const CRITICAL_GAP_THRESHOLD = defaultGapSeverityRuler.criticalThreshold;

export class DashboardPresenter {
  constructor(
    private readonly state: Pick<AppState, "plans" | "learningPaths" | "activeCycleId">,
    private readonly sel: Pick<Selectors, "progressionGapsFor" | "assessmentFor">,
    private readonly criticalGapThreshold: number = CRITICAL_GAP_THRESHOLD,
  ) {}

  gapsOf(population: readonly Architect[]): GapWithArchitect[] {
    return population.flatMap((a) =>
      this.sel.progressionGapsFor(a.id).map((g) => ({ ...g, architect: a })),
    );
  }

  criticalGapCount(population: readonly Architect[]): number {
    return this.gapsOf(population).filter((g) => g.gap >= this.criticalGapThreshold).length;
  }

  topGaps(population: readonly Architect[], limit = 6): GapWithArchitect[] {
    return [...this.gapsOf(population)].sort((a, b) => b.gap - a.gap).slice(0, limit);
  }

  activePlans(): DevelopmentPlan[] {
    return this.state.plans.filter((p) => p.cycleId === this.state.activeCycleId);
  }

  private get activePlanItems() {
    return this.activePlans().flatMap((p) => p.items);
  }

  get goalsInProgress(): number {
    return this.activePlanItems.filter((i) => i.status === "In Progress").length;
  }

  get goalsDone(): number {
    return this.activePlanItems.filter((i) => i.status === "Completed").length;
  }

  get pathsInProgress(): number {
    return this.state.learningPaths.filter((p) =>
      p.progress.some((entry) => entry.status === "In Progress"),
    ).length;
  }

  assessmentCoverage(population: readonly Architect[]): AssessmentCoverage {
    return population.reduce(
      (acc, a) => {
        const status = this.sel.assessmentFor(a.id)?.status;
        if (status === "Completed") acc.completed += 1;
        else if (status === "In Review") acc.inReview += 1;
        else if (status === "Draft") acc.draft += 1;
        else acc.notStarted += 1;
        return acc;
      },
      { completed: 0, inReview: 0, draft: 0, notStarted: 0 },
    );
  }
}

export interface PlanItemCounts {
  notStarted: number;
  inProgress: number;
  blocked: number;
  completed: number;
}

export class PersonalDashboardPresenter {
  constructor(
    private readonly state: Pick<AppState, "learningPaths" | "evidences">,
    private readonly sel: Pick<Selectors, "progressionGapsFor" | "planFor">,
  ) {}

  openGaps(architectId: string): Gap[] {
    return this.sel.progressionGapsFor(architectId).filter((g) => g.gap > 0);
  }

  planItemCounts(architectId: string): PlanItemCounts {
    const items = this.sel.planFor(architectId)?.items ?? [];
    return {
      notStarted: items.filter((i) => i.status === "Not Started").length,
      inProgress: items.filter((i) => i.status === "In Progress").length,
      blocked: items.filter((i) => i.status === "Blocked").length,
      completed: items.filter((i) => i.status === "Completed").length,
    };
  }

  pendingEvidenceCount(architectId: string): number {
    return this.state.evidences.filter(
      (e) => e.architectId === architectId && e.status === "Pending",
    ).length;
  }

  assignedPaths(architectId: string): LearningPath[] {
    return this.state.learningPaths.filter((p) => p.assignedTo.includes(architectId));
  }
}
