import type { SelectionScope as GenericSelectionScope } from "./selection";

export type Level = 1 | 2 | 3 | 4 | 5;

/**
 * R2-VIS-05 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — nome e descrição de cada
 * nível saíram daqui: viviam fixos em português, ignorando o seletor de
 * idioma (e um segundo mapa dormia sem uso em `pt.json`, com o nível 2 numa
 * palavra diferente deste). `useLabels().levelName`/`.levelDescription`
 * (`lib/labels.ts`) são a fonte única agora, via i18n — `LEVELS` continua só
 * para iterar os 5 níveis.
 */
export const LEVELS: { level: Level }[] = [
  { level: 1 },
  { level: 2 },
  { level: 3 },
  { level: 4 },
  { level: 5 },
];

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
/** Aceita `string` (não só `RoleName`) — `CareerLevel.name` já nasce com o mesmo texto, sem o tipo. */
export const roleShort = (role: string): string =>
  `Nível ${role.replace("Arquiteto de Soluções ", "")}`;

/**
 * ENT-CAR-013 — `rank` ordena os níveis (I=1, II=2, III=3) para calcular
 * "o próximo nível"; ainda não é o que decide o alvo de um assessment
 * (isso é o motor de elegibilidade, Fase D, ainda não construído).
 */
export interface CareerLevel {
  id: string;
  name: string;
  rank: number;
}

/** Quantas capacidades precisam estar qualificadas para elegibilidade a este nível. */
export interface CareerLevelPolicy {
  careerLevelId: string;
  minimumQualifiedCapabilities: number;
}

/**
 * ESPECIFICACAO-OITAVA-RODADA, Seção 1.1/11 — computado pelo servidor a
 * cada leitura (nunca armazenado, nunca calculado no front): só
 * `status === "READY"` (exatamente 6 competências ativas, 3 restritivas,
 * 3 não restritivas) pode entrar no portfólio de um assessment novo.
 * `REQUIRES_CURATION` é o estado normal do catálogo legado até alguém do
 * negócio escolher as seis oficiais — nunca escondido, sempre mostrado
 * como orientação de curadoria.
 */
export interface CapabilityCuration {
  activeCompetencyCount: number;
  restrictiveCompetencyCount: number;
  nonRestrictiveCompetencyCount: number;
  status: "READY" | "REQUIRES_CURATION";
}

export interface Capability {
  id: string;
  name: string;
  short: string;
  /** Fora do catálogo ativo, mas os assessments que já usaram esta capacidade permanecem legíveis. */
  active: boolean;
  curation: CapabilityCuration;
}

/**
 * Dedup só para EXIBIÇÃO: `short` é único por construção (gerado/validado no
 * backend — ver `catalog.short-generator.ts`/`assertCapabilityShortAvailable`
 * no backend), mas dados legados de antes dessa garantia (ou uma sigla
 * arquivada reaproveitada) ainda podem colidir. Em vez de quebrar a leitura
 * do rótulo compacto, sufixa "(2)", "(3)"... na ordem de `capabilities` —
 * determinístico, sem depender de `id`. Só `id`/`short` no parâmetro (não
 * `Capability` inteiro) porque alguns chamadores (export CSV/PDF) já
 * trabalham com uma projeção mais estreita.
 */
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
 * ENT-CAR-011 — uma capacidade só é "qualificada" para progressão de
 * carreira (motor ainda não implementado, Fase D) quando TODAS as suas
 * competências RESTRICTIVE atingem o alvo; NON_RESTRICTIVE nunca bloqueia
 * sozinha. Backend valida o limite (até 6 por capacidade, até 3
 * RESTRICTIVE) em `createCompetency`/`updateCompetency` — o front só
 * espelha o estado, nunca decide sozinho se algo passa do limite.
 */
export type RequirementType = "RESTRICTIVE" | "NON_RESTRICTIVE";

export interface Competency {
  id: string;
  name: string;
  capabilityId: string;
  requirementType: RequirementType;
  /**
   * Role Competency Profile: nível esperado por NÍVEL DE CARREIRA — chave é
   * `CareerLevel.id` (ex. `arquiteto-de-solucoes-i`), não mais o texto de
   * `RoleName`. B-38 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md) —
   * a régua de carreira é dado (`career_levels`), não união hardcoded;
   * chaves não são garantidas presentes (nível sem curadoria ainda).
   */
  expected: Record<string, Level>;
  /** Fora do catálogo ativo — não entra em novo assessment nem em opção nova de PDI/trilha/evidência. */
  active: boolean;
}

export interface Architect {
  id: string;
  name: string;
  role: RoleName;
  /**
   * ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 11 — FK real para
   * `career_levels` (backend a mantém em sincronia com `role` em toda
   * escrita). O frontend nunca precisou resolver nível de carreira por
   * nome sozinho — telas que precisam do nível atual já recebem um
   * `CareerLevel` pronto do servidor (`AssessmentEligibility.
   * currentCareerLevel`); este campo existe para espelhar o contrato da
   * API por completude, opcional para não forçar toda fixture/formulário
   * existente a declará-lo.
   */
  careerLevelId?: string | null | undefined;
  yearsAsArchitect: number;
  specialization: string;
  /**
   * ESPECIFICACAO-OITAVA-RODADA, Seção 13 — especialização principal como
   * competência real do catálogo, não mais texto livre. `specialization`
   * (acima) continua existindo durante a migração (Seção 37, passo 6): só
   * é substituído quando houver correspondência validada, nunca mapeado
   * automaticamente. `null`/ausente = pendência administrativa.
   */
  primarySpecializationCompetencyId?: string | null | undefined;
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
  /**
   * ENT-CAR-017 — concorrência otimista só para `role`: mudar nível de
   * carreira exige `expectedVersion`, igual a `DevelopmentPlan.version`.
   * Demais campos do cadastro não usam isto.
   */
  version: number;
}

/**
 * ENT-CAR-017 — histórico append-only de mudança de nível de carreira.
 * `fromRole`/`toRole` são `RoleName` — sem FK para `CareerLevel` ainda
 * (ENT-DATA-011, separado).
 */
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

/**
 * Qual LADO da conversa escreveu — nunca a role de acesso da conta
 * (`UserRole`). Um Lead também escreve como `TECH_LEAD`, mesmo sem a role
 * "admin" — ver ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 14.
 */
export type AssessmentParticipantRole = "PROFESSIONAL" | "TECH_LEAD";

/**
 * Comentário de uma competência avaliada. Pertence a quem escreveu — não é
 * mais um par arquiteto+Tech Lead salvo junto (isso fabricava conversa que às
 * vezes ninguém teve). `authorUserId` fica nulo só em comentário herdado do
 * formato antigo cuja autoria não deu para reconstruir.
 */
export interface AssessmentComment {
  id: string;
  authorUserId: string | null;
  authorRole: AssessmentParticipantRole;
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
   * Fotografia do nome/capacidade da competência no momento em que o assessment
   * foi aberto — ausente em assessments criados antes desta migração, quando
   * quem renderiza cai de volta no catálogo atual.
   */
  competencyName?: string | undefined;
  capabilityId?: string | undefined;
  capabilityName?: string | undefined;
  /** ENT-CAR-011/015 — mesma lógica de fotografia, para `Competency.requirementType`. */
  requirementType?: RequirementType | undefined;
  /**
   * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-18 — concorrência
   * otimista por item: duas escritas na mesma competência (duas abas do
   * Tech Lead) eram last-write-wins silencioso. Opcional (sem backfill no
   * banco — vive dentro do JSONB de itens): item sem o campo (assessment
   * anterior a esta correção) é tratado como `1` por quem lê.
   */
  version?: number | undefined;
}

/**
 * ESPECIFICACAO-OITAVA-RODADA, Seção 6/7 — `1` é todo assessment já
 * existente (comportamento legado: nasce com o catálogo inteiro, alvo é
 * sempre o cargo atual). `2` é "Assessment V2": nasce vazio (`items: []`),
 * só ganha itens quando uma capacidade READY entra no portfólio, e o alvo
 * é o PRÓXIMO nível de carreira (ENT-CAR-016). Um `Completed` nunca muda
 * de versão — histórico fechado nunca é reinterpretado.
 */
export type AssessmentModelVersion = 1 | 2;

/**
 * `NEXT_ROLE`: alvo é o próximo nível (caso comum de Assessment V2).
 * `MASTERY`: pessoa já está no Nível III — sem próximo nível, os itens
 * usam o alvo do próprio nível atual, mas nunca viram "gap de progressão"
 * (Seção 7). `CURRENT_ROLE`/`null`: assessment V1, cargo atual.
 */
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
  /** AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-18 — concorrência otimista da transição de status. */
  version: number;
}

/**
 * ESPECIFICACAO-OITAVA-RODADA, Seção 18 — "Começar/Parar/Continuar",
 * agregado por assessment (não por pessoa: pertence ao ciclo, não ao
 * cadastro estático). `version: 0` é o sentinel de "ninguém escreveu
 * ainda" que `GET .../development-summary` devolve antes da primeira
 * escrita — nunca 404.
 */
export interface AssessmentDevelopmentSummary {
  assessmentId: string;
  startDoing: string;
  stopDoing: string;
  continueDoing: string;
  updatedByUserId: string | null;
  updatedAt: string | null;
  version: number;
}

/**
 * ENT-CAR-014 — quais capacidades contam para elegibilidade de carreira
 * NESTE assessment (mínimo 3). "Profissional propõe, Tech Lead confirma":
 * `confirmedByUserId`/`confirmedAt` só depois que o Tech Lead confirma.
 */
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
 * ENT-CAR-014/015/016 — portfólio + qualificação + política do próximo
 * nível, já juntos. `eligible` é `null` (não `false`) quando não há
 * próximo nível — quem já está no topo não tem "elegibilidade", tem
 * "oportunidades de desenvolvimento".
 */
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

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §12.2/§20 — fonte
 * única: `ActionType` deriva de `ACTION_TYPES`, e `api-schemas.ts` deriva
 * `z.enum(ACTION_TYPES)` do mesmo array (mesmo fix do backend), em vez das
 * listas escritas à mão que a auditoria cita como exemplo de enum
 * duplicado.
 */
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
  /**
   * ESPECIFICACAO-OITAVA-RODADA, Seção 15/25 — de qual assessment este
   * item foi derivado (`POST /api/plans/:architectId/items/from-gap`).
   * `currentLevel`/`targetLevel`/`priority` são calculados pelo servidor
   * a partir deste assessment no momento da criação — nunca editáveis
   * depois. `null`/ausente em item manual (não derivado de gap) ou
   * anterior a esta migração.
   */
  sourceAssessmentId?: string | null | undefined;
  /**
   * Seção 16 — esforço planejado (horas/semana), conceito distinto de
   * `priority`/severidade do GAP. Nunca entra em cálculo de elegibilidade
   * ou GAP — é atributo do plano de execução.
   */
  dedicationHoursPerWeek?: number | null | undefined;
}

/**
 * Seção 17 — histórico append-only de reprogramação de prazo. Existe
 * porque `targetDate` deixa de ser editável livremente depois de
 * `Approved`: mudar o prazo de um compromisso já aprovado precisa de
 * motivo e fica registrado (`POST /api/plans/:planId/items/:itemId/
 * reschedule`), nunca um PATCH silencioso.
 */
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
export type PlanEventType =
  "PlanApproved" | "PlanReturnedToDraft" | "PlanCompleted" | "PlanReopened";

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

/** Nível OBSERVADO mudado nesta sessão — separado de `competencyIds` (Seção 17). */
export interface ProficiencyUpdate {
  competencyId: string;
  observedLevel: Level;
  note?: string | undefined;
}

export type ProficiencySourceType = "ASSESSMENT" | "MENTORING";
export type EvolutionSourceFilter = "ALL" | ProficiencySourceType;

/**
 * Nunca `[] = todos` (Seção 44) — modo explícito. OO3-09b: deriva do
 * genérico `Selection<TId>`/`SelectionScope<TId>` (`selection.ts`), que
 * unificou esta representação com os recortes `string[]` das telas.
 */
export type SelectionScope = GenericSelectionScope<string>;

export interface CompetencyLevelEvent {
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

export type SnapshotTemporalPrecision = "EXACT" | "CYCLE_END_INFERRED";

export interface ProfessionalStateSnapshotItem {
  capabilityId: string;
  competencyId: string;
  capabilityNameSnapshot: string;
  competencyNameSnapshot: string;
  observedLevel: Level | null;
  officialLevel: Level | null;
  expectedLevelSnapshot: Level | null;
  requirementTypeSnapshot: RequirementType;
}

export interface ProfessionalStateSnapshot {
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

export interface CapabilitySeriesPoint {
  date: string;
  averageLevel: number;
  coveredCount: number;
}

export interface CapabilitySeries {
  capabilityId: string;
  capabilityName: string;
  points: CapabilitySeriesPoint[];
}

export interface CompetencySeries {
  competencyId: string;
  competencyName: string;
  capabilityId: string;
  events: CompetencyLevelEvent[];
}

export interface EvolutionSummary {
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
