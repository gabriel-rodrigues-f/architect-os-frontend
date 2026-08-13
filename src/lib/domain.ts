export type Level = 1 | 2 | 3 | 4 | 5;

export const LEVELS: { level: Level; name: string; description: string }[] = [
  {
    level: 1,
    name: "Consciência",
    description:
      "Conhece os conceitos principais, terminologia e propósito da tecnologia ou prática.",
  },
  {
    level: 2,
    name: "Fundamentos",
    description: "Compreende os fundamentos e consegue executar tarefas simples com orientação.",
  },
  {
    level: 3,
    name: "Praticante",
    description: "Consegue aplicar a competência de forma autônoma em projetos reais.",
  },
  {
    level: 4,
    name: "Avançado",
    description: "Toma decisões complexas, orienta outras pessoas e avalia trade-offs.",
  },
  {
    level: 5,
    name: "Especialista",
    description: "É referência no assunto, define padrões e desenvolve outros profissionais.",
  },
];

export const levelName = (l: number) => LEVELS.find((x) => x.level === l)?.name ?? "—";

/**
 * Cargos da carreira de arquitetura. A progressão é I → II → III; o app não
 * trabalha com senioridade (júnior/pleno/sênior) em separado.
 */
export type RoleName =
  "Arquiteto de Soluções I" | "Arquiteto de Soluções II" | "Arquiteto de Soluções III";

export const ROLES: RoleName[] = [
  "Arquiteto de Soluções I",
  "Arquiteto de Soluções II",
  "Arquiteto de Soluções III",
];

/** Rótulo curto para cabeçalhos de tabela: "Nível I", "Nível II", "Nível III". */
export const roleShort = (role: RoleName): string =>
  `Nível ${role.replace("Arquiteto de Soluções ", "")}`;

export interface CompetencyCategory {
  id: string;
  name: string;
  short: string;
}

export interface Competency {
  id: string;
  name: string;
  categoryId: string;
  /** Role Competency Profile: expected level per role */
  expected: Record<RoleName, Level>;
}

export interface Architect {
  id: string;
  name: string;
  role: RoleName;
  yearsAsArchitect: number;
  specialization: string;
  email: string;
  strongDomain: string;
  gapDomain: string;
  performance: "Low" | "Medium" | "High";
  potential: "Low" | "Medium" | "High";
}

export interface AssessmentItem {
  competencyId: string;
  self: Level;
  leader: Level;
  target: Level;
  final: Level;
  selfComment?: string | undefined;
  leaderComment?: string | undefined;
}

export interface Assessment {
  id: string;
  architectId: string;
  cycleId: string;
  status: "Draft" | "In Review" | "Completed";
  items: AssessmentItem[];
}

export interface DevelopmentCycle {
  id: string;
  name: string;
  start: string;
  end: string;
  status: "Active" | "Closed" | "Planned";
}

export interface Swot {
  architectId: string;
  cycleId: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export type ActionType = "Learn" | "Practice" | "Apply" | "Teach" | "Mentor" | "Lead";
export const ACTION_TYPES: ActionType[] = ["Learn", "Practice", "Apply", "Teach", "Mentor", "Lead"];

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
  progress: number;
  evidenceIds: string[];
  smart?: SmartGoal | undefined;
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
}

export interface KeyResult {
  id: string;
  title: string;
  progress: number;
}

export interface Okr {
  id: string;
  architectId: string;
  cycleId: string;
  objective: string;
  keyResults: KeyResult[];
}

export type LearningItemType =
  | "Curso"
  | "Vídeo"
  | "Livro"
  | "Artigo"
  | "Laboratório"
  | "Desafio"
  | "Projeto"
  | "Certificação"
  | "Apresentação"
  | "Workshop";

export interface LearningPathItem {
  id: string;
  title: string;
  type: LearningItemType;
  url?: string | undefined;
  description?: string | undefined;
  hours: number;
  status: "Not Started" | "In Progress" | "Completed";
  progress: number;
  evidence?: string | undefined;
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  competencyIds: string[];
  assignedTo: string[];
  items: LearningPathItem[];
  /** E-mail de quem criou a trilha; nulo nas trilhas anteriores à autenticação. */
  createdBy?: string | null | undefined;
  /** ISO 8601 com data e hora de criação. */
  createdAt?: string | undefined;
}

export interface MentoringSession {
  id: string;
  mentor: string;
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
}

export interface Certification {
  id: string;
  architectId: string;
  name: string;
  issuer: string;
  year: number;
}

export const gapSeverity = (gap: number) => {
  if (gap <= 0) return { label: "Adequado", tone: "ok" as const };
  if (gap === 1) return { label: "Recomendado", tone: "low" as const };
  if (gap === 2) return { label: "Prioridade alta", tone: "high" as const };
  return { label: "Crítico", tone: "critical" as const };
};
