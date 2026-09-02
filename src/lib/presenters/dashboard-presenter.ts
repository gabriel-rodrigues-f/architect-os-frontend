import type { AppState, SessionUser } from "../api";
import type { Architect, Assessment, DevelopmentPlan, Evidence, LearningPath } from "../domain";
import { defaultUiAuthorizationPolicy, type UiAuthorizationPolicy } from "../scope";
import { defaultGapSeverityRuler } from "../scoring-bands";
import type { Gap, Selectors } from "../selectors";

interface AssessmentCoverage {
  completed: number;
  inReview: number;
  draft: number;
  notStarted: number;
}

interface GapWithArchitect extends Gap {
  architect: Architect;
}

export const CRITICAL_GAP_THRESHOLD = defaultGapSeverityRuler.criticalThreshold;

interface ArchitectAwaitingCalibration {
  architect: Architect;
  assessment: Assessment | undefined;
}

interface ArchitectAwaitingApproval {
  architect: Architect;
  plan: DevelopmentPlan | undefined;
}

export class LeadPendingQueues {
  constructor(
    readonly people: readonly Architect[],
    readonly awaitingCalibration: readonly ArchitectAwaitingCalibration[],
    readonly pendingEvidence: readonly Evidence[],
    readonly awaitingApproval: readonly ArchitectAwaitingApproval[],
  ) {}

  get totalPending(): number {
    return (
      this.awaitingCalibration.length + this.pendingEvidence.length + this.awaitingApproval.length
    );
  }
}

export class DashboardPresenter {
  private readonly gapsCache = new WeakMap<readonly Architect[], GapWithArchitect[]>();

  constructor(
    private readonly state: Pick<
      AppState,
      "architects" | "evidences" | "plans" | "learningPaths" | "cycles" | "activeCycleId"
    >,
    private readonly sel: Pick<Selectors, "progressionGapsFor" | "assessmentFor" | "planFor">,
    private readonly criticalGapThreshold: number = CRITICAL_GAP_THRESHOLD,
    private readonly authorization: UiAuthorizationPolicy = defaultUiAuthorizationPolicy,
  ) {}

  get noCycleRegistered(): boolean {
    return this.state.cycles.length === 0;
  }

  pendingQueuesFor(user: SessionUser): LeadPendingQueues {
    const people = this.state.architects.filter(
      (architect) => architect.active && this.authorization.leadsTeamOf(user, architect),
    );

    const awaitingCalibration = people
      .map((architect) => ({ architect, assessment: this.sel.assessmentFor(architect.id) }))
      .filter((entry) => entry.assessment?.status === "In Review");

    const pendingEvidence = this.state.evidences.filter(
      (evidence) =>
        people.some((architect) => architect.id === evidence.architectId) &&
        evidence.status === "Pending",
    );

    const awaitingApproval = people
      .map((architect) => ({ architect, plan: this.sel.planFor(architect.id) }))
      .filter(
        (entry) => entry.plan && entry.plan.status === "Draft" && entry.plan.items.length > 0,
      );

    return new LeadPendingQueues(people, awaitingCalibration, pendingEvidence, awaitingApproval);
  }

  gapsOf(population: readonly Architect[]): GapWithArchitect[] {
    const cached = this.gapsCache.get(population);
    if (cached) return cached;

    const gaps = population.flatMap((a) =>
      this.sel.progressionGapsFor(a.id).map((g) => ({ ...g, architect: a })),
    );

    this.gapsCache.set(population, gaps);
    return gaps;
  }

  criticalGapCount(population: readonly Architect[]): number {
    return this.gapsOf(population).filter((g) => g.gap >= this.criticalGapThreshold).length;
  }

  topGaps(population: readonly Architect[], limit = 6): GapWithArchitect[] {
    return this.largestBy(this.gapsOf(population), (gap) => gap.gap, limit);
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

  private largestBy<T>(items: readonly T[], scoreOf: (item: T) => number, limit: number): T[] {
    if (limit <= 0) return [];
    if (items.length <= limit) return [...items].sort((a, b) => scoreOf(b) - scoreOf(a));

    const selected: T[] = [];
    const scores: number[] = [];

    for (const item of items) {
      const score = scoreOf(item);
      const weakestSelected = scores[limit - 1];
      if (selected.length === limit && weakestSelected !== undefined && score <= weakestSelected)
        continue;

      let position = selected.length;
      while (position > 0) {
        const previous = scores[position - 1];
        if (previous === undefined || previous >= score) break;
        position -= 1;
      }

      selected.splice(position, 0, item);
      scores.splice(position, 0, score);

      if (selected.length > limit) {
        selected.pop();
        scores.pop();
      }
    }

    return selected;
  }
}

interface PlanItemCounts {
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

  evidencesOf(architectId: string): Evidence[] {
    return this.state.evidences.filter((evidence) => evidence.architectId === architectId);
  }

  pendingEvidenceCount(architectId: string): number {
    return this.evidencesOf(architectId).filter((evidence) => evidence.status === "Pending").length;
  }

  assignedPaths(architectId: string): LearningPath[] {
    return this.state.learningPaths.filter((p) => p.assignedTo.includes(architectId));
  }
}
