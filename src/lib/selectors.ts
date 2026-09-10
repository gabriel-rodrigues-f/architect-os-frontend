import type { AppState } from "./api";
import type {
  Professional,
  Assessment,
  AssessmentTargetSemantics,
  Competency,
  Capability,
  Level,
} from "./domain";
import { capabilityShortLabels } from "./domain";
import { PositionReading } from "./position";

export const emptyState: AppState = {
  capabilities: [],
  competencies: [],
  teamLevelRules: [],
  professionals: [],
  assessments: [],
  cycles: [],
  plans: [],
  learningPaths: [],
  mentoringSessions: [],
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

const byId = <T extends { id: string }>(items: T[]): Map<string, T> =>
  new Map(items.map((item) => [item.id, item]));

const cycleKey = (professionalId: string, cycleId: string) => `${professionalId} ${cycleId}`;

const indexByProfessionalAndCycle = <T extends { professionalId: string; cycleId: string }>(
  items: T[],
): Map<string, T> =>
  new Map(items.map((item) => [cycleKey(item.professionalId, item.cycleId), item]));

export class SelectorIndex {
  readonly competencyIndex: Map<string, Competency>;
  readonly capabilityIndex: Map<string, Capability>;
  readonly professionalIndex: Map<string, Professional>;
  readonly assessmentIndex: Map<string, Assessment>;
  readonly planIndex: Map<string, AppState["plans"][number]>;

  constructor(private readonly state: AppState) {
    this.competencyIndex = byId(state.competencies);
    this.capabilityIndex = byId(state.capabilities);
    this.professionalIndex = byId(state.professionals);
    this.assessmentIndex = indexByProfessionalAndCycle(state.assessments);
    this.planIndex = indexByProfessionalAndCycle(state.plans);
  }

  get activeCycleId(): string {
    return this.state.activeCycleId;
  }
}

export class ProfessionalRoster {
  /**
   * Quem entra em toda leitura de capacidade: ativo E profissional. O gerente
   * (cargo `manager`) fica de fora de Avaliações, Prioridades, Progressão,
   * Comparativo, PDI e afins (dono, 2026-09-06); o Time o lista pelo roster
   * completo, com o filtro de status.
   */
  static active(professionals: readonly Professional[]): Professional[] {
    return ProfessionalRoster.professionals(professionals).filter(
      (professional) => professional.active,
    );
  }

  /** Todo mundo menos o gerente — ativos e desativados. É o que o Time lista. */
  static professionals(professionals: readonly Professional[]): Professional[] {
    return professionals.filter((professional) => PositionReading.isProfessional(professional));
  }
}

export class ProfessionalSelectors {
  readonly active: Professional[];

  constructor(
    state: AppState,
    private readonly index: SelectorIndex,
  ) {
    this.active = ProfessionalRoster.active(state.professionals);
  }

  byId = (id: string): Professional | undefined => this.index.professionalIndex.get(id);

  specializationLabel = (
    professional: Pick<Professional, "specialization" | "primarySpecializationCompetencyId">,
  ): string => {
    if (professional.primarySpecializationCompetencyId) {
      const competency = this.index.competencyIndex.get(
        professional.primarySpecializationCompetencyId,
      );
      if (competency) return competency.name;
    }
    return professional.specialization
      ? `${professional.specialization} (pendente de migração)`
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
    };
  };

  assessmentFor = (
    professionalId: string,
    cycleId = this.index.activeCycleId,
  ): Assessment | undefined => this.index.assessmentIndex.get(cycleKey(professionalId, cycleId));

  officialAssessmentFor = (
    professionalId: string,
    cycleId = this.index.activeCycleId,
  ): Assessment | undefined => {
    const assessment = this.assessmentFor(professionalId, cycleId);
    return assessment?.status === "Completed" ? assessment : undefined;
  };

  gapsFor = (professionalId: string, cycleId = this.index.activeCycleId): Gap[] => {
    const cacheKey = cycleKey(professionalId, cycleId);
    const cached = this.gapsCache.get(cacheKey);
    if (cached) return cached;

    const assessment = this.officialAssessmentFor(professionalId, cycleId);
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

  progressionGapsFor = (professionalId: string, cycleId = this.index.activeCycleId): Gap[] =>
    this.gapsFor(professionalId, cycleId).filter((g) => g.targetSemantics !== "MASTERY");

  masteryOpportunitiesFor = (professionalId: string, cycleId = this.index.activeCycleId): Gap[] =>
    this.gapsFor(professionalId, cycleId).filter((g) => g.targetSemantics === "MASTERY");
}

export interface ConsolidatedGapRow {
  competencyId: string;
  name: string;
  capabilityId: string;
  people: number;

  professionalNames: string[];
  totalGap: number;
  maxGap: number;
  avgGap: number;
  avgFinal: number;
  avgTarget: number;
}

export class GapConsolidationSelectors {
  constructor(private readonly assessment: AssessmentSelectors) {}

  consolidate(
    professionals: readonly Professional[],
    gapsFor: (professionalId: string) => Gap[],
  ): ConsolidatedGapRow[] {
    const map = new Map<
      string,
      {
        competencyId: string;
        name: string;
        capabilityId: string;
        people: number;
        professionalNames: string[];
        totalGap: number;
        maxGap: number;
        sumFinal: number;
        sumTarget: number;
      }
    >();

    for (const professional of professionals) {
      for (const gap of gapsFor(professional.id)) {
        if (gap.gap <= 0 || !gap.competency) continue;
        let current = map.get(gap.competency.id);
        if (!current) {
          current = {
            competencyId: gap.competency.id,
            name: gap.competency.name,
            capabilityId: gap.competency.capabilityId,
            people: 0,
            professionalNames: [],
            totalGap: 0,
            maxGap: 0,
            sumFinal: 0,
            sumTarget: 0,
          };
          map.set(gap.competency.id, current);
        }
        current.people += 1;
        current.professionalNames.push(professional.name);
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

  progression = (professionals: readonly Professional[]): ConsolidatedGapRow[] =>
    this.consolidate(professionals, this.assessment.progressionGapsFor);

  mastery = (professionals: readonly Professional[]): ConsolidatedGapRow[] =>
    this.consolidate(professionals, this.assessment.masteryOpportunitiesFor);
}

export class DevelopmentSelectors {
  constructor(private readonly index: SelectorIndex) {}

  planFor = (professionalId: string, cycleId = this.index.activeCycleId) =>
    this.index.planIndex.get(cycleKey(professionalId, cycleId));
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
    professionalId: string,
    cycleId?: string,
  ): { avg: number | undefined; covered: number; total: number } =>
    averageWithCoverage(this.capabilityAverages(professionalId, cycleId).map((d) => d.avg));

  teamAverageFor = (
    capabilityId: string,
    professionals: readonly Pick<Professional, "id">[],
  ): {
    atual: { avg: number | undefined; covered: number; total: number };
    alvo: { avg: number | undefined; covered: number; total: number };
  } => {
    const rows = professionals.map((a) =>
      this.capabilityAverages(a.id).find((d) => d.capability.id === capabilityId),
    );
    return {
      atual: averageWithCoverage(rows.map((r) => r?.avg)),
      alvo: averageWithCoverage(rows.map((r) => r?.target)),
    };
  };

  capabilityAverages = (
    professionalId: string,
    cycleId = this.index.activeCycleId,
  ): CapabilityAverage[] => {
    const cacheKey = cycleKey(professionalId, cycleId);
    const cached = this.averagesCache.get(cacheKey);
    if (cached) return cached;

    const totals = new Map<string, { final: number; target: number; count: number }>();
    for (const item of this.assessment.officialAssessmentFor(professionalId, cycleId)?.items ??
      []) {
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

export function createSelectors(state: AppState) {
  const index = new SelectorIndex(state);
  const professional = new ProfessionalSelectors(state, index);
  const assessment = new AssessmentSelectors(index);
  const development = new DevelopmentSelectors(index);
  const capability = new CapabilitySelectors(state, index, assessment);
  const gapConsolidation = new GapConsolidationSelectors(assessment);

  return {
    competencyById: capability.competencyById,
    capabilityById: capability.capabilityById,
    professionalById: professional.byId,
    activeProfessionals: professional.active,
    specializationLabel: professional.specializationLabel,
    assessmentFor: assessment.assessmentFor,
    officialAssessmentFor: assessment.officialAssessmentFor,
    planFor: development.planFor,
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
