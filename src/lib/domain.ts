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
  /** Fora do catálogo ativo, mas os assessments que já usaram este domínio permanecem legíveis. */
  active: boolean;
}

export interface Competency {
  id: string;
  name: string;
  categoryId: string;
  /** Role Competency Profile: expected level per role */
  expected: Record<RoleName, Level>;
  /** Fora do catálogo ativo — não entra em novo assessment nem em opção nova de PDI/trilha/evidência. */
  active: boolean;
}

export interface Architect {
  id: string;
  name: string;
  role: RoleName;
  yearsAsArchitect: number;
  specialization: string;
  email: string;
  /** Fora do time hoje, mas o histórico (assessments, PDI, OKR...) permanece. */
  active: boolean;
  /**
   * Id da conta `lead` responsável por esta pessoa — quem pode agir como Tech
   * Lead dela (revisar avaliação/evidência, escrever PDI/progresso de
   * trilha). `null`/ausente = sem Lead atribuído ainda; só a própria pessoa e
   * um admin têm acesso. Só admin atribui.
   */
  leadUserId?: string | null | undefined;
}

/**
 * Comentário de uma competência avaliada. Pertence a quem escreveu — não é
 * mais um par arquiteto+Tech Lead salvo junto (isso fabricava conversa que às
 * vezes ninguém teve). `authorUserId` fica nulo só em comentário herdado do
 * formato antigo cuja autoria não deu para reconstruir.
 */
export interface AssessmentComment {
  id: string;
  authorUserId: string | null;
  authorRole: "member" | "admin";
  text: string;
  /** ISO 8601, gerados pelo servidor. */
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface AssessmentItem {
  competencyId: string;
  /**
   * `null` até a pessoa/Tech Lead de fato avaliar — nunca um nível
   * fabricado (1) representando "ainda não avaliado". Garantidamente
   * preenchido quando `Assessment.status === "Completed"`: o servidor
   * exige completude antes de deixar a transição passar. Ver AUDITORIA-
   * QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, DOM-002.
   */
  self: Level | null;
  leader: Level | null;
  /** Sempre um nível real — competência sem nível esperado para o cargo não entra no assessment. */
  target: Level;
  final: Level | null;
  comments: AssessmentComment[];
  /**
   * Fotografia do nome/domínio da competência no momento em que o assessment
   * foi aberto — ausente em assessments criados antes desta migração, quando
   * quem renderiza cai de volta no catálogo atual.
   */
  competencyName?: string | undefined;
  categoryId?: string | undefined;
  categoryName?: string | undefined;
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
  /** Único indicador de andamento do item — sem percentual paralelo. Ver EPIC 3. */
  status: PdiStatus;
  smart?: SmartGoal | undefined;
  /**
   * Acompanhamento explícito — mudar `status` já registra o resultado;
   * check-in registra o processo (uma nota datada, de quem escreveu), sem
   * mudar nenhum campo do item. Ver FASE 2, AUDITORIA-QUINTA-RODADA-360-
   * SYNAPSE-2026-08-19.md.
   */
  checkins: PlanItemCheckin[];
  /** Concorrência otimista (ENT-DATA-012) — PATCH exige `expectedVersion`. */
  version: number;
}

export interface PlanItemCheckin {
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
  /** Quem aprovou e quando — `null` enquanto não aprovado, ou depois de reaberto. */
  approvedByUserId?: string | null | undefined;
  approvedAt?: string | null | undefined;
  /** Quem concluiu e quando — reflete só a conclusão atual, não o histórico completo. */
  completedByUserId?: string | null | undefined;
  completedAt?: string | null | undefined;
  /** Concorrência otimista (ENT-DATA-012) — status e reabertura exigem `expectedVersion`. */
  version: number;
}

/**
 * Histórico append-only do lifecycle do PDI (ENT-PDI-002) — nunca editado
 * nem apagado. `approvedAt`/`completedAt` no plano só guardam a ocorrência
 * mais recente; depois de Approved → Completed → Reopened → Approved →
 * Completed, a primeira conclusão só sobrevive aqui.
 */
export type PlanEventType = "PlanApproved" | "PlanReturnedToDraft" | "PlanCompleted" | "PlanReopened";

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

/** Catálogo do item — o que a trilha oferece, não o que uma pessoa já fez dele. */
export interface LearningPathItem {
  id: string;
  title: string;
  type: LearningItemType;
  url?: string | undefined;
  description?: string | undefined;
  hours: number;
}

/**
 * Execução de um item por uma pessoa específica. Antes, `status`/`progress`
 * viviam dentro do próprio `LearningPathItem` — uma trilha com Ana e Bruno
 * atribuídos tinha um progresso só, e o slider de um mexia no do outro. Ver
 * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 11.
 */
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
  /** Uma entrada por (architectId, itemId) já tocado — nunca um valor global. */
  progress: LearningItemProgress[];
  /** E-mail de quem criou — só apresentação; a autoria de verdade é `createdByUserId`. */
  createdBy?: string | null | undefined;
  /** Conta de quem criou — servidor deriva da sessão. `null` só em trilha anterior a esta migração. */
  createdByUserId?: string | null | undefined;
  /** ISO 8601 com data e hora de criação. */
  createdAt?: string | undefined;
}

/** Progresso de uma pessoa num item — {status:"Not Started", progress:0} se ainda não tocou. */
export function progressFor(
  path: Pick<LearningPath, "progress">,
  architectId: string,
  itemId: string,
): LearningItemProgress {
  return (
    path.progress.find((p) => p.architectId === architectId && p.itemId === itemId) ?? {
      architectId,
      itemId,
      status: "Not Started",
      progress: 0,
    }
  );
}

export interface MentoringSession {
  id: string;
  /** Nome do mentor — só apresentação; o servidor sempre deriva do usuário autenticado. */
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
  /** Nasce "Pending" — nunca aceita implicitamente só por existir. */
  status: "Pending" | "Accepted" | "Needs Improvement" | "Rejected";
  /** Quem emitiu — relevante quando `type === "Certification"`. */
  issuer?: string | undefined;
  /**
   * Item do PDI que esta evidência sustenta — fonte única do vínculo
   * PDI↔Evidência (nenhum array espelhado do outro lado). Ver
   * AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-SYNAPSE.md, EPIC 2.
   */
  developmentPlanItemId?: string | null | undefined;
  reviewedByUserId?: string | null | undefined;
  reviewedAt?: string | null | undefined;
}

/** Evidências que sustentam um item do PDI — sempre uma consulta, nunca um array guardado. */
export function evidencesForPlanItem(evidences: Evidence[], itemId: string): Evidence[] {
  return evidences.filter((e) => e.developmentPlanItemId === itemId);
}

export const gapSeverity = (gap: number) => {
  if (gap <= 0) return { label: "Adequado", tone: "ok" as const };
  if (gap === 1) return { label: "Recomendado", tone: "low" as const };
  if (gap === 2) return { label: "Prioridade alta", tone: "high" as const };
  return { label: "Crítico", tone: "critical" as const };
};
