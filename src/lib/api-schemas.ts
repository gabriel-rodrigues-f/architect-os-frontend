import { z } from "zod";

import { ACTION_TYPES } from "./domain";

/**
 * B-11 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1-10) — os tipos
 * de domínio são espelhados à mão entre front e back (`domain.ts` ×
 * `domain/types.ts`), e o drift já tinha começado silenciosamente (LEVELS/
 * roleShort do backend, removidos nesta mesma leva por estarem mortos —
 * nunca chegavam a uma resposta de API). Nenhuma resposta era validada em
 * runtime; um campo renomeado ou removido no servidor só aparecia como
 * `undefined` se propagando silenciosamente pela UI.
 *
 * Escopo deliberadamente limitado a `GET /api/state` (o payload de bootstrap
 * do app inteiro, `store.tsx`) — não os ~40 outros endpoints. A própria
 * auditoria oferece isto como alternativa ao contrato de tipos compartilhado
 * (esforço bem maior, dois repositórios independentes); replicar zod para
 * cada endpoint também contraria o NF-1 ("DTO layer completa antes do
 * OpenAPI") — o que falta ali é o próprio OpenAPI (B-17), não um zod a mais
 * por rota. Falha de validação aqui propaga como erro comum de `useQuery`
 * (`store.tsx` já trata isso via `ConnectionError`) — silencioso vira
 * barulhento, sem precisar de nenhuma UI nova.
 */

const level = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

/**
 * R2-TEC-20 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — B-38 já relaxou o
 * cast equivalente no BACKEND (`RoleName` deixou de ser um enum fechado
 * ali); este `z.enum([...3 nomes])` sobrevivia só no cliente, um enum
 * FECHADO sobre um valor que ADR-0002 já documenta como "transitório" —
 * criar um 4º nível de carreira faz QUALQUER resposta de `/api/state`
 * com um arquiteto nesse nível falhar `appStateSchema.parse` inteiro,
 * derrubando o app TODO em `ConnectionError` (`store.tsx`), não só a
 * tela de quem tem o nível novo. `z.string()` aceita qualquer nome —
 * código que precisa comparar contra nomes conhecidos usa os níveis
 * reais de `career_levels` (`useCareerLevelsByRank`, `store.tsx` — o
 * array `ROLES` hardcoded morreu no CFG-01/A5); um nome desconhecido só
 * deixa de quebrar a validação, não vira um valor especial.
 */
const roleName = z.string();

const requirementType = z.enum(["RESTRICTIVE", "NON_RESTRICTIVE"]);

const capabilityCuration = z.object({
  activeCompetencyCount: z.number(),
  restrictiveCompetencyCount: z.number(),
  nonRestrictiveCompetencyCount: z.number(),
  status: z.enum(["READY", "REQUIRES_CURATION"]),
});

const capability = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
  active: z.boolean(),
  curation: capabilityCuration,
});

/**
 * B-38 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md) — chave é
 * `career_levels.id` (dado), não mais `RoleName`: `expected` não garante
 * mais as 3 chaves fixas presentes (`Competency.expected` em `domain.ts`
 * já é `Record<string, Level>`), então um record dinâmico é o schema
 * certo, não mais um objeto de 3 chaves enumeradas à mão.
 */
const expectedLevelMap = z.record(z.string(), level);

const competency = z.object({
  id: z.string(),
  name: z.string(),
  capabilityId: z.string(),
  requirementType,
  expected: expectedLevelMap,
  active: z.boolean(),
});

const careerLevelPolicy = z.object({
  careerLevelId: z.string(),
  minimumQualifiedCapabilities: z.number(),
});

/**
 * R2-TEC-19 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — `careerLevels` saiu de
 * `appStateSchema` junto com a migração pra `GET /api/career-levels` (B-24,
 * ADR-0011, comentário em `api.ts`), mas a validação em runtime não
 * acompanhou: `api.careerLevels()` ficou só com um cast de tipo
 * (`request<CareerLevel[]>`), a MESMA lacuna que `appStateSchema` existe
 * pra fechar nas outras coleções. Schema dedicado, exportado, pra
 * `api.ts#careerLevels` validar a resposta como as demais.
 */
const careerLevel = z.object({
  id: z.string(),
  name: z.string(),
  rank: z.number(),
});

export const careerLevelsResponseSchema = z.array(careerLevel);

/**
 * CFG-02 — resposta de `GET /api/config/bands` (`ConfigGateway.bands`):
 * escalas agrupadas, cada uma com faixas meia-abertas `min <= v < max`
 * (`null` = ±infinito na ponta). `labelKey` é string livre de propósito —
 * chave i18n desconhecida não derruba o parse; `messageKeyOrDefault`
 * (`scoring-bands.ts`) resolve o fallback na hora de exibir. Toda escala é
 * opcional: quem completa com o default é `withDefaultScoringBands`.
 */
const bandTone = z.enum(["ok", "low", "high", "critical"]);
const scoringBand = z.object({
  key: z.string(),
  minValue: z.number().nullable(),
  maxValue: z.number().nullable(),
  labelKey: z.string(),
  tone: bandTone,
  sortOrder: z.number(),
});
export const scoringBandsResponseSchema = z.object({
  GAP_SEVERITY: z.array(scoringBand).optional(),
  PROFICIENCY: z.array(scoringBand).optional(),
  CONCENTRATION_RISK: z.array(scoringBand).optional(),
});

/**
 * CFG-03 — resposta de `GET /api/config/templates` (`ConfigGateway.
 * templates`): `key → locale → template`, exatamente como
 * `TextTemplateCatalog.groupedByKey()` serializa no backend. Keys e locales
 * são strings livres de propósito — um template de key que este build não
 * conhece não derruba o parse; quem completa keys/locales ausentes com o
 * default é `withDefaultTextTemplates` (`text-templates.ts`).
 */
export const textTemplatesResponseSchema = z.record(z.record(z.string()));

const architect = z.object({
  id: z.string(),
  name: z.string(),
  role: roleName,
  careerLevelId: z.string().nullish(),
  yearsAsArchitect: z.number(),
  specialization: z.string(),
  primarySpecializationCompetencyId: z.string().nullish(),
  email: z.string(),
  active: z.boolean(),
  leadUserId: z.string().nullish(),
  version: z.number(),
});

const assessmentParticipantRole = z.enum(["PROFESSIONAL", "TECH_LEAD"]);

const assessmentComment = z.object({
  id: z.string(),
  authorUserId: z.string().nullable(),
  authorRole: assessmentParticipantRole,
  text: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

const assessmentItem = z.object({
  competencyId: z.string(),
  self: level.nullable(),
  leader: level.nullable(),
  target: level,
  final: level.nullable(),
  comments: z.array(assessmentComment),
  competencyName: z.string().optional(),
  capabilityId: z.string().optional(),
  capabilityName: z.string().optional(),
  requirementType: requirementType.optional(),
  version: z.number().optional(),
});

const assessment = z.object({
  id: z.string(),
  architectId: z.string(),
  cycleId: z.string(),
  status: z.enum(["Draft", "In Review", "Completed"]),
  items: z.array(assessmentItem),
  modelVersion: z.union([z.literal(1), z.literal(2)]),
  targetCareerLevelId: z.string().nullable(),
  targetSemantics: z.enum(["CURRENT_ROLE", "NEXT_ROLE", "MASTERY"]).nullable(),
  version: z.number(),
});

const developmentCycle = z.object({
  id: z.string(),
  name: z.string(),
  start: z.string(),
  end: z.string(),
  status: z.enum(["Active", "Closed", "Planned"]),
});

const smartGoal = z.object({
  specific: z.string(),
  measurable: z.string(),
  achievable: z.string(),
  relevant: z.string(),
  timeBound: z.string(),
  statement: z.string(),
});

const planItemCheckin = z.object({
  id: z.string(),
  authorUserId: z.string(),
  text: z.string(),
  createdAt: z.string(),
});

const developmentPlanItem = z.object({
  id: z.string(),
  competencyId: z.string(),
  currentLevel: level,
  targetLevel: level,
  objective: z.string(),
  actionType: z.enum(ACTION_TYPES),
  actionPlan: z.string(),
  startDate: z.string(),
  targetDate: z.string(),
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  owner: z.string(),
  status: z.enum(["Not Started", "In Progress", "Blocked", "Completed"]),
  smart: smartGoal.optional(),
  checkins: z.array(planItemCheckin),
  version: z.number(),
  sourceAssessmentId: z.string().nullish(),
  dedicationHoursPerWeek: z.number().nullish(),
});

const developmentPlan = z.object({
  id: z.string(),
  architectId: z.string(),
  cycleId: z.string(),
  status: z.enum(["Draft", "Approved", "Completed"]),
  items: z.array(developmentPlanItem),
  approvedByUserId: z.string().nullish(),
  approvedAt: z.string().nullish(),
  completedByUserId: z.string().nullish(),
  completedAt: z.string().nullish(),
  version: z.number(),
});

const learningPathItem = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum([
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
  ]),
  url: z.string().optional(),
  description: z.string().optional(),
  hours: z.number(),
});

const learningItemProgress = z.object({
  architectId: z.string(),
  itemId: z.string(),
  status: z.enum(["Not Started", "In Progress", "Completed"]),
  progress: z.number(),
});

const learningPath = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  competencyIds: z.array(z.string()),
  assignedTo: z.array(z.string()),
  items: z.array(learningPathItem),
  progress: z.array(learningItemProgress),
  createdBy: z.string().nullish(),
  createdByUserId: z.string().nullish(),
  createdAt: z.string().optional(),
});

const mentoringSession = z.object({
  id: z.string(),
  mentor: z.string(),
  mentorUserId: z.string().nullish(),
  menteeId: z.string(),
  date: z.string(),
  durationMin: z.number(),
  topic: z.string(),
  competencyIds: z.array(z.string()),
  notes: z.string(),
  decisions: z.string(),
  actions: z.string(),
  nextSession: z.string().optional(),
});

const evidence = z.object({
  id: z.string(),
  architectId: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum([
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
  ]),
  competencyIds: z.array(z.string()),
  date: z.string(),
  project: z.string().optional(),
  url: z.string().optional(),
  complexity: z.enum(["Low", "Medium", "High"]),
  leaderComment: z.string().optional(),
  status: z.enum(["Pending", "Accepted", "Needs Improvement", "Rejected"]),
  issuer: z.string().optional(),
  developmentPlanItemId: z.string().nullish(),
  reviewedByUserId: z.string().nullish(),
  reviewedAt: z.string().nullish(),
});

/**
 * R2-TEC-19 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — comportamento não
 * documentado até aqui: `z.object()` sem `.passthrough()`/`.strict()`
 * (o default do zod) SILENCIOSAMENTE DESCARTA qualquer chave que o
 * servidor mande e este schema não conheça — `.parse()` não falha, só
 * devolve um objeto sem o campo novo. Isto é aceito de propósito, não um
 * bug: um campo REMOVIDO ou RENOMEADO no servidor (o caso que este
 * schema existe pra pegar) ainda quebra a validação normalmente (chave
 * exigida ausente); só um campo ADICIONADO fica invisível até este
 * arquivo ser atualizado — o mesmo trade-off que qualquer parser
 * "aditivo primeiro" faz. Se um campo novo precisar aparecer na UI, ele
 * também precisa ser declarado aqui — não é automático.
 */
export const appStateSchema = z.object({
  capabilities: z.array(capability),
  competencies: z.array(competency),
  careerLevelPolicies: z.array(careerLevelPolicy),
  architects: z.array(architect),
  assessments: z.array(assessment),
  cycles: z.array(developmentCycle),
  plans: z.array(developmentPlan),
  learningPaths: z.array(learningPath),
  mentoringSessions: z.array(mentoringSession),
  evidences: z.array(evidence),
  activeCycleId: z.string(),
});
