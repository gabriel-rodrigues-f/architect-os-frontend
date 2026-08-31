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

export type RoleName =
  "Arquiteto de Soluções I" | "Arquiteto de Soluções II" | "Arquiteto de Soluções III";

export interface CareerLevel {
  id: string;
  name: string;
  rank: number;
}

interface CareerLevelPolicy {
  careerLevelId: string;
  minimumQualifiedCapabilities: number;
}

export interface TeamLevelRule {
  id: string;
  teamId: string;
  careerLevelId: string;
  minimumQualifiedCapabilities: number;
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

export type RequirementType = "RESTRICTIVE" | "NON_RESTRICTIVE";

/**
 * Fase 2 (backend ADR-0032) — a competência global é definição pura.
 * `requirementType` e `expected` morreram no catálogo: obrigatoriedade e
 * nível exigido são da régua do time (`team_rule_competencies`) e chegam à
 * UI pela FOTO do item de avaliação (`AssessmentItem.requirementType`/`target`).
 */
export interface Competency {
  id: string;
  name: string;
  capabilityId: string;
  active: boolean;
}

export interface Architect {
  id: string;
  name: string;
  role: RoleName;

  careerLevelId?: string | null | undefined;
  yearsAsArchitect: number;
  specialization: string;

  primarySpecializationCompetencyId?: string | null | undefined;
  email: string;

  active: boolean;

  teamId?: string | null | undefined;

  version: number;
}

export interface CareerLevelTransition {
  id: string;
  architectId: string;
  fromRole: RoleName;
  toRole: RoleName;
  actorUserId: string;
  reason: string;
  occurredAt: string;
  architectVersion: number;
}

type AssessmentParticipantRole = "PROFESSIONAL" | "TECH_LEAD";

export interface AssessmentComment {
  id: string;
  authorUserId: string | null;
  authorRole: AssessmentParticipantRole;
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

  requirementType?: RequirementType | undefined;

  version?: number | undefined;
}

type AssessmentModelVersion = 1 | 2;

export type AssessmentTargetSemantics = "CURRENT_ROLE" | "NEXT_ROLE" | "MASTERY";

export interface Assessment {
  id: string;
  architectId: string;
  cycleId: string;
  status: "Draft" | "In Review" | "Completed";
  items: AssessmentItem[];
  modelVersion: AssessmentModelVersion;
  targetCareerLevelId: string | null;
  targetSemantics: AssessmentTargetSemantics | null;

  version: number;
}

export interface AssessmentDevelopmentSummary {
  assessmentId: string;
  startDoing: string;
  stopDoing: string;
  continueDoing: string;
  updatedByUserId: string | null;
  updatedAt: string | null;
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

export interface AssessmentEligibility {
  currentCareerLevel: CareerLevel | undefined;
  nextCareerLevel: CareerLevel | undefined;
  policy: CareerLevelPolicy | undefined;
  capabilities: { capabilityId: string; confirmed: boolean; qualified: boolean }[];
  qualifiedConfirmedCount: number;
  eligible: boolean | null;
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
  architectId: string;
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
  architectId: string;
  itemId: string;
  status: "Not Started" | "In Progress" | "Completed";
  progress: number;
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  competencyIds: string[];
  assignedTo: string[];
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
  competencyIds: string[];
  notes: string;
  decisions: string;
  actions: string;
  nextSession?: string | undefined;
}

export interface ProficiencyUpdate {
  competencyId: string;
  observedLevel: Level;
  note?: string | undefined;
}

type ProficiencySourceType = "ASSESSMENT" | "MENTORING";
type EvolutionSourceFilter = "ALL" | ProficiencySourceType;

export type SelectionScope = GenericSelectionScope<string>;

interface CompetencyLevelEvent {
  id: string;
  architectId: string;
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
  requirementTypeSnapshot: RequirementType;
}

interface ProfessionalStateSnapshot {
  id: string;
  architectId: string;
  effectiveDate: string;
  recordedAt: string;
  sourceType: ProficiencySourceType;
  sourceId: string;
  actorUserId: string;
  careerLevelIdSnapshot: string | null;
  careerLevelNameSnapshot: string | null;
  targetCareerLevelIdSnapshot: string | null;
  minimumQualifiedCapabilitiesSnapshot: number | null;
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

export interface ArchitectEvolutionResult {
  architect: { id: string; name: string; role: RoleName; careerLevelName: string | null };
  summary: EvolutionSummary;
  capabilitySeries: CapabilitySeries[];
  competencySeries: CompetencySeries[];
  events: CompetencyLevelEvent[];
  snapshots: ProfessionalStateSnapshot[];
  comparisons: CompetencyEvolutionComparison[];
}

export interface TeamEvolutionResult {
  architectCount: number;
  summary: EvolutionSummary;
  capabilitySeries: CapabilitySeries[];
  perArchitect: Array<{
    architectId: string;
    architectName: string;
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

export type EvidenceType =
  | "Architecture Design"
  | "ADR"
  | "Technical Presentation"
  | "Workshop"
  | "Project"
  | "Certification"
  | "Course"
  | "Proof of Concept"
  | "Architecture Review"
  | "Mentoring"
  | "Technical Article";

export const EVIDENCE_TYPES: EvidenceType[] = [
  "Architecture Design",
  "ADR",
  "Technical Presentation",
  "Workshop",
  "Project",
  "Certification",
  "Course",
  "Proof of Concept",
  "Architecture Review",
  "Mentoring",
  "Technical Article",
];

export interface Evidence {
  id: string;
  architectId: string;
  title: string;
  description: string;
  type: EvidenceType;
  competencyIds: string[];
  date: string;
  project?: string | undefined;
  url?: string | undefined;
  complexity: "Low" | "Medium" | "High";
  leaderComment?: string | undefined;

  status: "Pending" | "Accepted" | "Needs Improvement" | "Rejected";

  issuer?: string | undefined;

  developmentPlanItemId?: string | null | undefined;
  reviewedByUserId?: string | null | undefined;
  reviewedAt?: string | null | undefined;
}

type GapSeverity = BandTone;

export const gapSeverityOf: (gap: number) => GapSeverity =
  defaultGapSeverityRuler.severityOf.bind(defaultGapSeverityRuler);

export const GAP_SEVERITY_MESSAGE_KEY: Record<GapSeverity, MessageKey> =
  defaultGapSeverityRuler.messageKey;
