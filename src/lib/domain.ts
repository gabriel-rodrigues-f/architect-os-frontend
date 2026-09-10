import type { MessageKey } from "./i18n";
import { defaultGapSeverityRuler, type BandTone } from "./scoring-bands";
import type { SelectionScope as GenericSelectionScope } from "./selection";

export type Level = 1 | 2 | 3 | 4 | 5;

export const LEVELS: { level: Level }[] = [
  { level: 1 },
  { level: 2 },
  { level: 3 },
  { level: 4 },
  { level: 5 },
];

export type RoleName = CareerLevel["name"];

export interface CareerLevel {
  id: string;
  name: string;
  rank: number;
}

/**
 * A régua de um (time, nível) como o roster a enxerga. O PISO de capacidades
 * qualificadas saiu dela com a elegibilidade (dono, 2026-09-10): o que a
 * régua diz agora é o ESPERADO, e a existência dela é o invariante da regra
 * 19 — todo time tem régua para os cinco níveis.
 */
export interface TeamLevelRule {
  id: string;
  teamId: string;
  careerLevelId: string;
}

interface CapabilityCuration {
  activeCompetencyCount: number;
  status: "READY" | "REQUIRES_CURATION";
}

export interface Capability {
  id: string;
  name: string;
  short: string;

  active: boolean;
  curation: CapabilityCuration;
}

export function capabilityShortLabels(
  capabilities: readonly Pick<Capability, "id" | "short">[],
): Map<string, string> {
  const seen = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const c of capabilities) {
    const key = c.short.trim().toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    labels.set(c.id, count === 1 ? c.short : `${c.short} (${count})`);
  }
  return labels;
}

/**
 * Fase 2 (backend ADR-0032) — a competência global é definição pura; o nível
 * exigido é da régua do time e chega à UI pela FOTO do item de avaliação
 * (`AssessmentItem.target`). Onda 36 (backend ADR-0082): a obrigatoriedade
 * (RESTRITIVA/DESEJÁVEL) deixou de existir em qualquer camada — toda
 * competência da régua pesa igual.
 */
export interface Competency {
  id: string;
  name: string;
  capabilityId: string;
  active: boolean;
}

/**
 * Onda 37 (backend ADR-0084) — cargo e SENIORIDADE se separaram. Gerente e
 * tech lead não têm senioridade, e o servidor devolve `role: null` e
 * `careerLevelId: null` neles: a ausência é o dado, não um erro de leitura.
 */
export interface Professional {
  id: string;
  name: string;
  role: RoleName | null;

  careerLevelId?: string | null | undefined;
  yearsAsProfessional: number;
  specialization: string;

  primarySpecializationCompetencyId?: string | null | undefined;
  email: string;

  active: boolean;

  teamId?: string | null | undefined;

  /**
   * O cargo da conta ligada à pessoa (`users.role`): `manager`, `tech_lead`
   * ou `member`; `null` sem conta. Dono (2026-09-06): o gerente não é um
   * profissional com capacidades — ver `ProfessionalRoster.professionals`.
   */
  cargo?: ProfessionalCargo | null | undefined;

  version: number;
}

export type ProfessionalCargo = "manager" | "tech_lead" | "member";

export interface CareerLevelTransition {
  id: string;
  professionalId: string;
  fromRole: RoleName;
  toRole: RoleName;
  actorUserId: string;
  reason: string;
  occurredAt: string;
  professionalVersion: number;
}

export interface AssessmentComment {
  id: string;
  authorUserId: string | null;
  /**
   * QUEM ASSINOU, pelo nome — resolvido pelo SERVIDOR a partir da PK da conta,
   * na leitura (dono, 2026-09-09: *"a pessoa que assina deve ser reconhecida
   * pelo seu nome + sobrenome... não pelo seu cargo atual, até porque cargo
   * pode mudar"*).
   *
   * Aqui não dava para resolver: o autor pode ser um administrador sem ficha
   * de profissional, ou alguém fora do recorte de quem lê — o `store` não tem
   * o nome dele. Substituiu o `authorRole`, que rotulava o comentário com o
   * cargo de quem escreveu e dizia "Tech Lead" para duas pessoas diferentes.
   *
   * NULO quando não há a quem perguntar: comentário histórico sem autor, ou
   * conta apagada pelo esquecimento. A tela põe a frase da ausência.
   */
  authorName: string | null;
  text: string;

  createdAt: string;
  updatedAt?: string | undefined;
}

export interface AssessmentItem {
  competencyId: string;

  self: Level | null;
  leader: Level | null;

  target: Level;
  final: Level | null;
  comments: AssessmentComment[];

  competencyName?: string | undefined;
  capabilityId?: string | undefined;
  capabilityName?: string | undefined;

  version?: number | undefined;
}

type AssessmentModelVersion = 1 | 2;

export type AssessmentTargetSemantics = "CURRENT_ROLE" | "NEXT_ROLE" | "MASTERY";

export interface Assessment {
  id: string;
  professionalId: string;
  cycleId: string;
  status: "Draft" | "In Review" | "Completed";
  items: AssessmentItem[];
  modelVersion: AssessmentModelVersion;
  targetCareerLevelId: string | null;
  targetSemantics: AssessmentTargetSemantics | null;

  version: number;
}

export interface AssessmentCapability {
  id: string;
  assessmentId: string;
  capabilityId: string;
  addedByUserId: string;
  addedAt: string;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
}

/**
 * O PORTFÓLIO DO CICLO, com o estágio de cada capacidade.
 *
 * Dono (2026-09-10): a elegibilidade saiu do produto, e com ela o veredito e
 * o piso de capacidades qualificadas. Ficou o COMPARATIVO — "esta capacidade
 * atingiu o alvo congelado dos próprios itens?" —, e ele se calcula na tela
 * sobre a avaliação que ela já tem em mãos: nenhuma rota devolve mais isso.
 */
export interface PortfolioCapabilityState {
  capabilityId: string;
  confirmed: boolean;
  qualified: boolean;
}

export interface DevelopmentCycle {
  id: string;
  name: string;
  start: string;
  end: string;
  status: "Active" | "Closed" | "Planned";
}

export const ACTION_TYPES = ["Learn", "Practice", "Apply", "Teach", "Mentor", "Lead"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export type PdiStatus = "Not Started" | "In Progress" | "Blocked" | "Completed";

export interface DevelopmentPlanItem {
  id: string;
  competencyId: string;
  currentLevel: Level;
  targetLevel: Level;
  objective: string;
  actionType: ActionType;
  actionPlan: string;
  startDate: string;
  targetDate: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  owner: string;

  status: PdiStatus;
  smart?: SmartGoal | undefined;

  checkins: PlanItemCheckin[];

  version: number;

  sourceAssessmentId?: string | null | undefined;

  dedicationHoursPerWeek?: number | null | undefined;
}

export interface DevelopmentPlanItemEvent {
  id: string;
  itemId: string;
  eventType: "ItemRescheduled";
  fromTargetDate: string | null;
  toTargetDate: string;
  actorUserId: string;
  reason: string;
  occurredAt: string;
  itemVersion: number;
}

interface PlanItemCheckin {
  id: string;
  authorUserId: string;
  text: string;
  createdAt: string;
}

export interface SmartGoal {
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
  statement: string;
}

export interface DevelopmentPlan {
  id: string;
  professionalId: string;
  cycleId: string;
  status: "Draft" | "Approved" | "Completed";
  items: DevelopmentPlanItem[];

  approvedByUserId?: string | null | undefined;
  approvedAt?: string | null | undefined;

  completedByUserId?: string | null | undefined;
  completedAt?: string | null | undefined;

  version: number;
}

type PlanEventType = "PlanApproved" | "PlanReturnedToDraft" | "PlanCompleted" | "PlanReopened";

export interface DevelopmentPlanEvent {
  id: string;
  planId: string;
  eventType: PlanEventType;
  fromStatus: DevelopmentPlan["status"] | null;
  toStatus: DevelopmentPlan["status"];
  actorUserId: string;
  reason: string | null;
  occurredAt: string;
  planVersion: number;
}

export const LEARNING_ITEM_TYPES = [
  "Curso",
  "Vídeo",
  "Livro",
  "Artigo",
  "Laboratório",
  "Desafio",
  "Projeto",
  "Certificação",
  "Apresentação",
  "Workshop",
] as const;
export type LearningItemType = (typeof LEARNING_ITEM_TYPES)[number];

export interface LearningPathItem {
  id: string;
  title: string;
  type: LearningItemType;
  url?: string | undefined;
  description?: string | undefined;
  hours: number;
}

export interface LearningItemProgress {
  professionalId: string;
  itemId: string;
  status: "Not Started" | "In Progress" | "Completed";
  progress: number;
}

/** Fatia PRAZOS: quem está inscrito numa trilha, e desde quando. */
export interface LearningPathEnrollment {
  professionalId: string;
  enrolledAt: string;
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  competencyIds: string[];
  /** Quem está inscrito, por id — projeção de `enrollments`. */
  assignedTo: string[];
  /** Quem está inscrito e desde quando — o que o prazo precisa saber. */
  enrollments: LearningPathEnrollment[];
  /** Dias para concluir, contados do ingresso de cada inscrito. Nulo = sem prazo. */
  completionDeadlineDays: number | null;
  items: LearningPathItem[];

  progress: LearningItemProgress[];

  createdBy?: string | null | undefined;

  createdByUserId?: string | null | undefined;

  createdAt?: string | undefined;
}

export interface MentoringSession {
  id: string;

  mentor: string;
  mentorUserId?: string | null | undefined;
  menteeId: string;
  date: string;
  durationMin: number;
  topic: string;
  notes: string;

  /**
   * "Decisões", "Ações" e "Competências discutidas" saíram do produto inteiro
   * em 2026-09-09 — *"deve morrer totalmente, front, back e banco"* —, e o
   * texto que as sessões antigas tinham foi dobrado dentro de `notes` pela
   * própria migração. A 1:1 guarda um bloco de anotações só.
   *
   * `nextSession` FICA, e continua sendo escrito por outro caminho que não o
   * formulário: o "Agendar follow-up" da Linha do Tempo, que faz PATCH na
   * sessão mais recente da pessoa (regra 20).
   */
  nextSession?: string | undefined;
}

type ProficiencySourceType = "ASSESSMENT" | "MENTORING";
type EvolutionSourceFilter = "ALL" | ProficiencySourceType;

export type SelectionScope = GenericSelectionScope<string>;

interface CompetencyLevelEvent {
  id: string;
  professionalId: string;
  competencyId: string;
  fromLevel: Level | null;
  toLevel: Level;
  sourceType: ProficiencySourceType;
  sourceId: string;
  effectiveDate: string;
  recordedAt: string;
  actorUserId: string;
  note: string | null;
}

type SnapshotTemporalPrecision = "EXACT" | "CYCLE_END_INFERRED";

interface ProfessionalStateSnapshotItem {
  capabilityId: string;
  competencyId: string;
  capabilityNameSnapshot: string;
  competencyNameSnapshot: string;
  observedLevel: Level | null;
  officialLevel: Level | null;
  expectedLevelSnapshot: Level | null;
}

interface ProfessionalStateSnapshot {
  id: string;
  professionalId: string;
  effectiveDate: string;
  recordedAt: string;
  sourceType: ProficiencySourceType;
  sourceId: string;
  actorUserId: string;
  careerLevelIdSnapshot: string | null;
  careerLevelNameSnapshot: string | null;
  targetCareerLevelIdSnapshot: string | null;
  temporalPrecision: SnapshotTemporalPrecision;
  items: ProfessionalStateSnapshotItem[];
}

export interface CompetencyEvolutionComparison {
  competencyId: string;
  competencyName: string;
  capabilityId: string;
  capabilityName: string;
  initialLevel: Level | null;
  currentLevel: Level | null;
  delta: number | null;
  lastSourceType: ProficiencySourceType | null;
}

interface CapabilitySeriesPoint {
  date: string;
  averageLevel: number;
  coveredCount: number;
}

interface CapabilitySeries {
  capabilityId: string;
  capabilityName: string;
  points: CapabilitySeriesPoint[];
}

interface CompetencySeries {
  competencyId: string;
  competencyName: string;
  capabilityId: string;
  events: CompetencyLevelEvent[];
}

interface EvolutionSummary {
  coverage: { covered: number; total: number };
  initialAverage: number | null;
  currentAverage: number | null;
  averageDelta: number | null;
  improved: number;
  stable: number;
  regressed: number;
  mentoringCount: number;
  assessmentCount: number;
}

export interface ProfessionalEvolutionResult {
  professional: { id: string; name: string; role: RoleName; careerLevelName: string | null };
  summary: EvolutionSummary;
  capabilitySeries: CapabilitySeries[];
  competencySeries: CompetencySeries[];
  events: CompetencyLevelEvent[];
  snapshots: ProfessionalStateSnapshot[];
  comparisons: CompetencyEvolutionComparison[];
}

export interface TeamEvolutionResult {
  professionalCount: number;
  summary: EvolutionSummary;
  capabilitySeries: CapabilitySeries[];
  perProfessional: Array<{
    professionalId: string;
    professionalName: string;
    initialAverage: number | null;
    currentAverage: number | null;
    delta: number | null;
  }>;
}

export interface EvolutionFilters {
  range: { from: string; to: string };
  capabilities: SelectionScope;
  competencies: SelectionScope;
  source: EvolutionSourceFilter;
}

type GapSeverity = BandTone;

export const gapSeverityOf: (gap: number) => GapSeverity =
  defaultGapSeverityRuler.severityOf.bind(defaultGapSeverityRuler);

export const GAP_SEVERITY_MESSAGE_KEY: Record<GapSeverity, MessageKey> =
  defaultGapSeverityRuler.messageKey;

/**
 * Decisão do dono (2026-09-06): para o gerente, mudar alguém de time é uma
 * SOLICITAÇÃO — o gerente do time de destino aprova, e só então a pessoa
 * migra. O admin continua movendo direto (correção de cadastro).
 */
export type TeamTransferRequestStatus = "pending" | "approved" | "refused" | "cancelled";

/** A foto que os POSTs devolvem (`TeamTransferRequestSnapshot` no backend). */
export interface TeamTransferRequest {
  id: string;
  professionalId: string;
  fromTeamId: string;
  toTeamId: string;
  reason: string;
  requestedByUserId: string;
  requestedAt: string;
  status: TeamTransferRequestStatus;
  decidedByUserId: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  version: number;
}

/** A listagem (`GET /team-transfer-requests`): a foto mais os nomes, para a tela não juntar tabelas. */
export interface TeamTransferRequestView extends TeamTransferRequest {
  professionalName: string;
  fromTeamName: string;
  toTeamName: string;
  requestedByName: string;
  decidedByName: string | null;
}
