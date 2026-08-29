import type { AppState } from "./api";
import type {
  Architect,
  Assessment,
  AssessmentTargetSemantics,
  Competency,
  Capability,
  Evidence,
  Level,
} from "./domain";
import { capabilityShortLabels } from "./domain";

export const emptyState: AppState = {
  capabilities: [],
  competencies: [],
  teamLevelRules: [],
  architects: [],
  assessments: [],
  cycles: [],
  plans: [],
  learningPaths: [],
  mentoringSessions: [],
  evidences: [],
  activeCycleId: "",
};

type EvaluatedAssessmentItem = Assessment["items"][number] & {
  self: Level;
  leader: Level;
  final: Level;
};

const isEvaluated = (item: Assessment["items"][number]): item is EvaluatedAssessmentItem =>
  item.final !== null;

export interface Gap {
  competency: Competency;
  item: EvaluatedAssessmentItem;
  gap: number;
  assessmentId: string;
  targetSemantics: AssessmentTargetSemantics | null;
}

export interface CapabilityAverage {
  capability: Capability;
  avg: number | undefined;
  target: number | undefined;
}

export interface TrainingNeed {
  competency: Competency;
  people: number;
  avgGap: number;
  totalGap: number;

  architectIds: string[];
}

const byId = <T extends { id: string }>(items: T[]): Map<string, T> =>
  new Map(items.map((item) => [item.id, item]));

const cycleKey = (architectId: string, cycleId: string) => `${architectId} ${cycleId}`;

const indexByArchitectAndCycle = <T extends { architectId: string; cycleId: string }>(
  items: T[],
): Map<string, T> => new Map(items.map((item) => [cycleKey(item.architectId, item.cycleId), item]));

export class SelectorIndex {
  readonly competencyIndex: Map<string, Competency>;
  readonly capabilityIndex: Map<string, Capability>;
  readonly architectIndex: Map<string, Architect>;
  readonly assessmentIndex: Map<string, Assessment>;
  readonly planIndex: Map<string, AppState["plans"][number]>;

  constructor(private readonly state: AppState) {
    this.competencyIndex = byId(state.competencies);
    this.capabilityIndex = byId(state.capabilities);
    this.architectIndex = byId(state.architects);
    this.assessmentIndex = indexByArchitectAndCycle(state.assessments);
    this.planIndex = indexByArchitectAndCycle(state.plans);
  }

  get activeCycleId(): string {
    return this.state.activeCycleId;
  }
}

export class ArchitectSelectors {
  readonly active: Architect[];

  constructor(
    state: AppState,
    private readonly index: SelectorIndex,
  ) {
    this.active = state.architects.filter((a) => a.active);
  }

  byId = (id: string): Architect | undefined => this.index.architectIndex.get(id);

  specializationLabel = (
    architect: Pick<Architect, "specialization" | "primarySpecializationCompetencyId">,
  ): string => {
    if (architect.primarySpecializationCompetencyId) {
      const competency = this.index.competencyIndex.get(
        architect.primarySpecializationCompetencyId,
      );
      if (competency) return competency.name;
    }
    return architect.specialization
      ? `${architect.specialization} (pendente de migração)`
      : "Especialização não definida";
  };
}

export class AssessmentSelectors {
  private readonly gapsCache = new Map<string, Gap[]>();

  constructor(private readonly index: SelectorIndex) {}

  private resolveCompetency = (item: Assessment["items"][number]): Competency | undefined => {
    const live = this.index.competencyIndex.get(item.competencyId);
    if (live) return live;
    if (!item.competencyName) return undefined;
    return {
      id: item.competencyId,
      name: item.competencyName,
      capabilityId: item.capabilityId ?? "",
      active: false,
    };
  };

  assessmentFor = (
    architectId: string,
    cycleId = this.index.activeCycleId,
  ): Assessment | undefined => this.index.assessmentIndex.get(cycleKey(architectId, cycleId));

  officialAssessmentFor = (
    architectId: string,
    cycleId = this.index.activeCycleId,
  ): Assessment | undefined => {
    const assessment = this.assessmentFor(architectId, cycleId);
    return assessment?.status === "Completed" ? assessment : undefined;
  };

  gapsFor = (architectId: string, cycleId = this.index.activeCycleId): Gap[] => {
    const cacheKey = cycleKey(architectId, cycleId);
    const cached = this.gapsCache.get(cacheKey);
    if (cached) return cached;

    const assessment = this.officialAssessmentFor(architectId, cycleId);
    const gaps = !assessment
      ? []
      : assessment.items
          .filter(isEvaluated)
          .map((item) => ({
            competency: this.resolveCompetency(item),
            item,
            gap: item.target - item.final,
            assessmentId: assessment.id,
            targetSemantics: assessment.targetSemantics,
          }))
          .filter((g): g is Gap => g.competency !== undefined)
          .sort((x, y) => y.gap - x.gap);

    this.gapsCache.set(cacheKey, gaps);
    return gaps;
  };

  progressionGapsFor = (architectId: string, cycleId = this.index.activeCycleId): Gap[] =>
    this.gapsFor(architectId, cycleId).filter((g) => g.targetSemantics !== "MASTERY");

  masteryOpportunitiesFor = (architectId: string, cycleId = this.index.activeCycleId): Gap[] =>
    this.gapsFor(architectId, cycleId).filter((g) => g.targetSemantics === "MASTERY");
}

export interface ConsolidatedGapRow {
  competencyId: string;
  name: string;
  capabilityId: string;
  requirementType: "RESTRICTIVE" | "NON_RESTRICTIVE";
  people: number;

  architectNames: string[];
  totalGap: number;
  maxGap: number;
  avgGap: number;
  avgFinal: number;
  avgTarget: number;
}

export class GapConsolidationSelectors {
  constructor(private readonly assessment: AssessmentSelectors) {}

  consolidate(
    architects: readonly Architect[],
    gapsFor: (architectId: string) => Gap[],
  ): ConsolidatedGapRow[] {
    const map = new Map<
      string,
      {
        competencyId: string;
        name: string;
        capabilityId: string;
        requirementType: "RESTRICTIVE" | "NON_RESTRICTIVE";
        people: number;
        architectNames: string[];
        totalGap: number;
        maxGap: number;
        sumFinal: number;
        sumTarget: number;
      }
    >();

    for (const architect of architects) {
      for (const gap of gapsFor(architect.id)) {
        if (gap.gap <= 0 || !gap.competency) continue;
        let current = map.get(gap.competency.id);
        if (!current) {
          current = {
            competencyId: gap.competency.id,
            name: gap.competency.name,
            capabilityId: gap.competency.capabilityId,
            requirementType: gap.item.requirementType ?? "NON_RESTRICTIVE",
            people: 0,
            architectNames: [],
            totalGap: 0,
            maxGap: 0,
            sumFinal: 0,
            sumTarget: 0,
          };
          map.set(gap.competency.id, current);
        }
        current.people += 1;
        current.architectNames.push(architect.name);
        current.totalGap += gap.gap;
        current.maxGap = Math.max(current.maxGap, gap.gap);
        current.sumFinal += gap.item.final;
        current.sumTarget += gap.item.target;
      }
    }

    return [...map.values()]
      .map((row) => ({
        ...row,
        avgFinal: Number((row.sumFinal / row.people).toFixed(1)),
        avgTarget: Number((row.sumTarget / row.people).toFixed(1)),
        avgGap: Number((row.totalGap / row.people).toFixed(1)),
      }))
      .sort((a, b) => b.totalGap - a.totalGap || b.maxGap - a.maxGap);
  }

  progression = (architects: readonly Architect[]): ConsolidatedGapRow[] =>
    this.consolidate(architects, this.assessment.progressionGapsFor);

  mastery = (architects: readonly Architect[]): ConsolidatedGapRow[] =>
    this.consolidate(architects, this.assessment.masteryOpportunitiesFor);
}

export class DevelopmentSelectors {
  constructor(private readonly index: SelectorIndex) {}

  planFor = (architectId: string, cycleId = this.index.activeCycleId) =>
    this.index.planIndex.get(cycleKey(architectId, cycleId));

  evidencesForPlanItem = (evidences: readonly Evidence[], itemId: string): Evidence[] =>
    evidences.filter((e) => e.developmentPlanItemId === itemId);
}

export class CapabilitySelectors {
  private readonly averagesCache = new Map<string, CapabilityAverage[]>();

  readonly shortLabels: Map<string, string>;

  constructor(
    private readonly state: AppState,
    private readonly index: SelectorIndex,
    private readonly assessment: AssessmentSelectors,
  ) {
    this.shortLabels = capabilityShortLabels(state.capabilities);
  }

  competencyById = (id: string): Competency | undefined => this.index.competencyIndex.get(id);
  capabilityById = (id: string): Capability | undefined => this.index.capabilityIndex.get(id);

  shortLabelFor = (c: Pick<Capability, "id" | "short">): string =>
    this.shortLabels.get(c.id) ?? c.short;

  coverageFor = (
    architectId: string,
    cycleId?: string,
  ): { avg: number | undefined; covered: number; total: number } =>
    averageWithCoverage(this.capabilityAverages(architectId, cycleId).map((d) => d.avg));

  teamAverageFor = (
    capabilityId: string,
    architects: readonly Pick<Architect, "id">[],
  ): {
    atual: { avg: number | undefined; covered: number; total: number };
    alvo: { avg: number | undefined; covered: number; total: number };
  } => {
    const rows = architects.map((a) =>
      this.capabilityAverages(a.id).find((d) => d.capability.id === capabilityId),
    );
    return {
      atual: averageWithCoverage(rows.map((r) => r?.avg)),
      alvo: averageWithCoverage(rows.map((r) => r?.target)),
    };
  };

  capabilityAverages = (
    architectId: string,
    cycleId = this.index.activeCycleId,
  ): CapabilityAverage[] => {
    const cacheKey = cycleKey(architectId, cycleId);
    const cached = this.averagesCache.get(cacheKey);
    if (cached) return cached;

    const totals = new Map<string, { final: number; target: number; count: number }>();
    for (const item of this.assessment.officialAssessmentFor(architectId, cycleId)?.items ?? []) {
      if (item.final === null) continue;
      const capabilityId =
        this.index.competencyIndex.get(item.competencyId)?.capabilityId ?? item.capabilityId;
      if (!capabilityId) continue;
      const acc = totals.get(capabilityId) ?? { final: 0, target: 0, count: 0 };
      acc.final += item.final;
      acc.target += item.target;
      acc.count += 1;
      totals.set(capabilityId, acc);
    }

    const averages = this.state.capabilities.map((capability) => {
      const acc = totals.get(capability.id);
      if (!acc?.count) return { capability, avg: undefined, target: undefined };
      const mean = (value: number) => Number((value / acc.count).toFixed(2));
      return { capability, avg: mean(acc.final), target: mean(acc.target) };
    });

    this.averagesCache.set(cacheKey, averages);
    return averages;
  };
}

export class TrainingSelectors {
  constructor(
    private readonly architect: ArchitectSelectors,
    private readonly assessment: AssessmentSelectors,
  ) {}

  teamTrainingNeeds = (population: Architect[] = this.architect.active): TrainingNeed[] => {
    const totals = new Map<
      string,
      { competency: Competency; people: number; totalGap: number; architectIds: string[] }
    >();
    for (const architect of population) {
      for (const gap of this.assessment.progressionGapsFor(architect.id)) {
        if (gap.gap <= 0) continue;
        let acc = totals.get(gap.item.competencyId);
        if (!acc) {
          acc = { competency: gap.competency, people: 0, totalGap: 0, architectIds: [] };
          totals.set(gap.item.competencyId, acc);
        }
        acc.people += 1;
        acc.totalGap += gap.gap;
        acc.architectIds.push(architect.id);
      }
    }

    return [...totals.values()]
      .map((v) => ({
        competency: v.competency,
        people: v.people,
        avgGap: Number((v.totalGap / v.people).toFixed(1)),
        totalGap: v.totalGap,
        architectIds: v.architectIds,
      }))
      .sort((x, y) => y.totalGap - x.totalGap);
  };
}

export function createSelectors(state: AppState) {
  const index = new SelectorIndex(state);
  const architect = new ArchitectSelectors(state, index);
  const assessment = new AssessmentSelectors(index);
  const development = new DevelopmentSelectors(index);
  const capability = new CapabilitySelectors(state, index, assessment);
  const training = new TrainingSelectors(architect, assessment);
  const gapConsolidation = new GapConsolidationSelectors(assessment);

  return {
    competencyById: capability.competencyById,
    capabilityById: capability.capabilityById,
    architectById: architect.byId,
    activeArchitects: architect.active,
    specializationLabel: architect.specializationLabel,
    assessmentFor: assessment.assessmentFor,
    officialAssessmentFor: assessment.officialAssessmentFor,
    planFor: development.planFor,
    evidencesForPlanItem: development.evidencesForPlanItem,
    gapsFor: assessment.gapsFor,
    progressionGapsFor: assessment.progressionGapsFor,
    masteryOpportunitiesFor: assessment.masteryOpportunitiesFor,
    capabilityAverages: capability.capabilityAverages,
    capabilityShortLabels: capability.shortLabels,
    capabilityShortLabel: capability.shortLabelFor,
    coverageFor: capability.coverageFor,
    teamAverageFor: capability.teamAverageFor,
    consolidateProgressionGaps: gapConsolidation.progression,
    consolidateMasteryGaps: gapConsolidation.mastery,
    teamTrainingNeeds: training.teamTrainingNeeds,
  };
}

export type Selectors = ReturnType<typeof createSelectors>;

function averageWithCoverage(values: (number | undefined)[]): {
  avg: number | undefined;
  covered: number;
  total: number;
} {
  const present = values.filter((v): v is number => v !== undefined);
  return {
    avg: present.length ? present.reduce((sum, v) => sum + v, 0) / present.length : undefined,
    covered: present.length,
    total: values.length,
  };
}
