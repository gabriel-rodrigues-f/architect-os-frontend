import type { ApiClient } from "../api-client";
import type { DataOrigin } from "./data-origin";

/**
 * A LEITURA EXECUTIVA DO CICLO — um pedido só, com os KPIs já calculados
 * (onda 3 do Painel Executivo).
 *
 * Até aqui o Painel baixava nove coleções inteiras e somava no navegador:
 * nenhuma fórmula era contrato, nenhuma era testável no servidor, e dois
 * cartões da mesma tela podiam usar recortes diferentes sem que nada
 * reclamasse. Estes tipos são o espelho do read-model do backend.
 *
 * NENHUM CAMPO DE TENDÊNCIA existe aqui de propósito: não há seta, direção
 * nem variação percentual. Há os dois valores e os dois ciclos nomeados, e a
 * régua (`arrowRuler`) que diz quando a seta poderá voltar.
 */

export interface CycleStamp {
  id: string;
  name: string;
  start: string;
  end: string;
}

export interface NamedPerson {
  professionalId: string;
  name: string;
}

/** A fração é o número grande; o percentual é legenda. */
export interface Fraction {
  part: number;
  whole: number;
}

export interface CoverageReading {
  cycle: CycleStamp;
  completed: Fraction;
}

export type CycleFunnelStepKind = "NOT_STARTED" | "DRAFT" | "IN_REVIEW" | "COMPLETED";

export interface CycleFunnelStep {
  kind: CycleFunnelStepKind;
  people: number;
}

export interface CycleFunnel {
  cycle: CycleStamp;
  steps: CycleFunnelStep[];
  biggestHoldUp: CycleFunnelStepKind[];
}

export interface DecisionsOnTheDesk {
  total: number;
  awaitingCalibration: NamedPerson[];
  awaitingPlanApproval: NamedPerson[];
}

export interface PlanCoverageReading {
  cycle: CycleStamp;
  approved: Fraction;
}

export interface CycleHealth {
  funnel: CycleFunnel;
  previousFunnel: CycleFunnel | null;
  planCoverage: PlanCoverageReading;
  previousPlanCoverage: PlanCoverageReading | null;
  goalsCompleted: Fraction;
  peopleWithoutPlan: NamedPerson[];
  openAndUnscored: NamedPerson[];
}

export interface PersonMovement extends NamedPerson {
  steps: number;
}

export interface CycleMovement {
  from: CycleStamp;
  to: CycleStamp;
  advanced: PersonMovement[];
  steady: PersonMovement[];
  regressed: PersonMovement[];
  comparablePeople: number;
  leftMeasurement: number;
  joinedMeasurement: number;
}

export type GapMoveKind = "CLOSED" | "REDUCED" | "STABLE" | "INCREASED" | "OPENED";

export interface GapMoveCount {
  kind: GapMoveKind;
  pairs: number;
}

export interface GapMovementSummary {
  from: CycleStamp;
  to: CycleStamp;
  moves: GapMoveCount[];
  firstMeasurementPairs: number;
  comparablePeople: number;
  comparablePairs: number;
  largestContributorToClosures: (NamedPerson & { closed: number }) | null;
}

export interface Promotion extends NamedPerson {
  fromRole: string;
  toRole: string;
  occurredAt: string;
}

export interface ValueCreated {
  movement: CycleMovement | null;
  gapMovement: GapMovementSummary | null;
  promotions: Promotion[];
}

export interface TrendAvailability {
  available: boolean;
  cyclesWithReading: number;
  cyclesRequired: number;
  cycleNamesWithReading: string[];
}

export interface ArrowRuler {
  comparablePeople: number;
  minimumRelativeChange: number | null;
  anyArrowEarned: boolean;
}

export interface CriticalGapCarrier extends NamedPerson {
  competencies: number;
}

export interface CriticalGapConcentration {
  criticalThreshold: number;
  minimumCompetencies: number;
  carriers: CriticalGapCarrier[];
  assessedWithNoCriticalGap: number;
  averageGap: number | null;
  previousAverageGap: number | null;
}

export type MissingRulerReason = "NO_CAREER_LEVEL" | "AT_TOP_LEVEL" | "EMPTY_TEAM_RULER";

export interface MissingRulerGroup {
  reason: MissingRulerReason;
  people: NamedPerson[];
}

export interface OverdueFollowUp extends NamedPerson {
  dueOn: string;
  lastSessionOn: string;
}

export interface OneOnOneRecency extends NamedPerson {
  days: number | null;
}

export interface StalledLearningPath extends NamedPerson {
  pathId: string;
  pathName: string;
  completedItems: number;
  totalItems: number;
}

export interface Risks {
  criticalGapConcentration: CriticalGapConcentration;
  withoutApplicableRuler: { people: Fraction; groups: MissingRulerGroup[] };
  overdueFollowUps: OverdueFollowUp[];
  oneOnOneRecency: OneOnOneRecency[];
  longestSilenceDays: number | null;
  stalledLearningPaths: StalledLearningPath[];
}

export type ActionReason =
  | "OVERDUE_ONE_ON_ONE"
  | "ASSESSMENT_NOT_COMPLETED"
  | "NO_APPROVED_PLAN"
  | "CRITICAL_GAP_CONCENTRATION"
  | "STALLED_LEARNING_PATH";

export interface RecommendedAction extends NamedPerson {
  reason: ActionReason;
  weight: number;
}

export interface DocumentedDependency {
  kpi: string;
  missing: string;
}

export interface ExecutiveBriefing {
  cycle: CycleStamp;
  comparedCycle: CycleStamp | null;
  population: { inScope: number; outOfScope: number };
  coverage: CoverageReading;
  previousCoverage: CoverageReading | null;
  decisionsOnTheDesk: DecisionsOnTheDesk;
  peopleWhoNeedYou: Fraction;
  health: CycleHealth;
  valueCreated: ValueCreated;
  trend: TrendAvailability;
  arrowRuler: ArrowRuler;
  risks: Risks;
  recommendedActions: RecommendedAction[];
  actionWeights: ActionReason[];
  documentedDependencies: DocumentedDependency[];
}

export interface ExecutiveDashboardGateway {
  readonly dataOrigin: DataOrigin;
  briefing(cycleId?: string): Promise<ExecutiveBriefing>;
}

export class HttpExecutiveDashboardGateway implements ExecutiveDashboardGateway {
  readonly dataOrigin: DataOrigin = "organization";

  constructor(private readonly client: ApiClient) {}

  briefing = (cycleId?: string): Promise<ExecutiveBriefing> =>
    this.client.request<ExecutiveBriefing>(
      cycleId
        ? `/dashboard/executive?cycleId=${encodeURIComponent(cycleId)}`
        : "/dashboard/executive",
    );
}
