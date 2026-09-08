import type { AppState, SessionUser } from "../api";
import type { Professional, Assessment, DevelopmentPlan, Evidence, LearningPath } from "../domain";
import { defaultUiAuthorizationPolicy, type UiAuthorizationPolicy } from "../scope";
import { defaultGapSeverityRuler, type BandTone, type GapSeverityRuler } from "../scoring-bands";
import type { Gap, Selectors } from "../selectors";

interface AssessmentCoverage {
  completed: number;
  inReview: number;
  draft: number;
  notStarted: number;
}

interface GapWithProfessional extends Gap {
  professional: Professional;
}

export const CRITICAL_GAP_THRESHOLD = defaultGapSeverityRuler.criticalThreshold;

interface ProfessionalAwaitingCalibration {
  professional: Professional;
  assessment: Assessment | undefined;
}

interface ProfessionalAwaitingApproval {
  professional: Professional;
  plan: DevelopmentPlan | undefined;
}

export class LeadPendingQueues {
  constructor(
    readonly people: readonly Professional[],
    readonly awaitingCalibration: readonly ProfessionalAwaitingCalibration[],
    readonly pendingEvidence: readonly Evidence[],
    readonly awaitingApproval: readonly ProfessionalAwaitingApproval[],
  ) {}

  get totalPending(): number {
    return (
      this.awaitingCalibration.length + this.pendingEvidence.length + this.awaitingApproval.length
    );
  }
}

export class DashboardPresenter {
  private readonly gapsCache = new WeakMap<readonly Professional[], GapWithProfessional[]>();

  constructor(
    private readonly state: Pick<
      AppState,
      "professionals" | "evidences" | "plans" | "learningPaths" | "cycles" | "activeCycleId"
    >,
    private readonly sel: Pick<Selectors, "progressionGapsFor" | "assessmentFor" | "planFor">,
    private readonly criticalGapThreshold: number = CRITICAL_GAP_THRESHOLD,
    private readonly authorization: UiAuthorizationPolicy = defaultUiAuthorizationPolicy,
  ) {}

  get noCycleRegistered(): boolean {
    return this.state.cycles.length === 0;
  }

  pendingQueuesFor(user: SessionUser): LeadPendingQueues {
    const people = this.state.professionals.filter(
      (professional) => professional.active && this.authorization.leadsTeamOf(user, professional),
    );

    const awaitingCalibration = people
      .map((professional) => ({
        professional,
        assessment: this.sel.assessmentFor(professional.id),
      }))
      .filter((entry) => entry.assessment?.status === "In Review");

    const pendingEvidence = this.state.evidences.filter(
      (evidence) =>
        people.some((professional) => professional.id === evidence.professionalId) &&
        evidence.status === "Pending",
    );

    const awaitingApproval = people
      .map((professional) => ({ professional, plan: this.sel.planFor(professional.id) }))
      .filter(
        (entry) => entry.plan && entry.plan.status === "Draft" && entry.plan.items.length > 0,
      );

    return new LeadPendingQueues(people, awaitingCalibration, pendingEvidence, awaitingApproval);
  }

  gapsOf(population: readonly Professional[]): GapWithProfessional[] {
    const cached = this.gapsCache.get(population);
    if (cached) return cached;

    const gaps = population.flatMap((a) =>
      this.sel.progressionGapsFor(a.id).map((g) => ({ ...g, professional: a })),
    );

    this.gapsCache.set(population, gaps);
    return gaps;
  }

  /** Quantas distâncias do time caem em cada faixa de severidade da régua. */
  gapsBySeverity(
    population: readonly Professional[],
    ruler: GapSeverityRuler,
  ): Record<BandTone, number> {
    const counts: Record<BandTone, number> = { ok: 0, low: 0, high: 0, critical: 0 };
    for (const gap of this.gapsOf(population)) counts[ruler.severityOf(gap.gap)] += 1;
    return counts;
  }

  criticalGapCount(population: readonly Professional[]): number {
    return this.gapsOf(population).filter((g) => g.gap >= this.criticalGapThreshold).length;
  }

  topGaps(population: readonly Professional[], limit = 6): GapWithProfessional[] {
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

  assessmentCoverage(population: readonly Professional[]): AssessmentCoverage {
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

  openGaps(professionalId: string): Gap[] {
    return this.sel.progressionGapsFor(professionalId).filter((g) => g.gap > 0);
  }

  planItemCounts(professionalId: string): PlanItemCounts {
    const items = this.sel.planFor(professionalId)?.items ?? [];
    return {
      notStarted: items.filter((i) => i.status === "Not Started").length,
      inProgress: items.filter((i) => i.status === "In Progress").length,
      blocked: items.filter((i) => i.status === "Blocked").length,
      completed: items.filter((i) => i.status === "Completed").length,
    };
  }

  evidencesOf(professionalId: string): Evidence[] {
    return this.state.evidences.filter((evidence) => evidence.professionalId === professionalId);
  }

  pendingEvidenceCount(professionalId: string): number {
    return this.evidencesOf(professionalId).filter((evidence) => evidence.status === "Pending")
      .length;
  }

  assignedPaths(professionalId: string): LearningPath[] {
    return this.state.learningPaths.filter((p) => p.assignedTo.includes(professionalId));
  }
}
