import type {
  ActionType,
  Architect,
  ArchitectEvolutionResult,
  Assessment,
  AssessmentCapability,
  AssessmentComment,
  AssessmentDevelopmentSummary,
  AssessmentEligibility,
  CareerLevel,
  CareerLevelPolicy,
  CareerLevelTransition,
  Competency,
  Capability,
  DevelopmentCycle,
  DevelopmentPlan,
  DevelopmentPlanEvent,
  DevelopmentPlanItem,
  DevelopmentPlanItemEvent,
  Evidence,
  EvolutionFilters,
  LearningPath,
  LearningPathItem,
  Level,
  MentoringSession,
  ProficiencyUpdate,
  SelectionScope,
  TeamEvolutionResult,
} from "./domain";
import { appStateSchema, careerLevelsResponseSchema } from "./api-schemas";

/**
 * Snapshot devolvido por GET /api/state — espelha o AppState do backend.
 * B-24 (ADR-0011) — `careerLevels` saiu daqui, primeira coleção migrada
 * para seu endpoint por contexto (`api.careerLevels()`, `lib/store.tsx`
 * `useCareerLevelsByRank`).
 */
export interface AppState {
  capabilities: Capability[];
  competencies: Competency[];
  careerLevelPolicies: CareerLevelPolicy[];
  architects: Architect[];
  assessments: Assessment[];
  cycles: DevelopmentCycle[];
  plans: DevelopmentPlan[];
  learningPaths: LearningPath[];
  mentoringSessions: MentoringSession[];
  evidences: Evidence[];
  activeCycleId: string;
}

/**
 * `admin` administra o sistema (catálogo, ciclos, roster, contas). `lead`
 * exerce o papel de Tech Lead — revisa avaliação, evidência, PDI e trilha de
 * quem não é ele mesmo — sem as rotas de administração. `admin` também é
 * lead-capable (ver `isLeadCapable`): a distinção existe para permitir uma
 * conta que só revisa, não para impedir quem administra de revisar também.
 */
export type UserRole = "admin" | "lead" | "member";
export type UserStatus = "active" | "disabled";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  architectId: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: string;
}

/** Quem pode agir como Tech Lead: revisar avaliação/evidência, escrever no PDI de outra pessoa. */
export const isLeadCapable = (role: UserRole): boolean => role === "admin" || role === "lead";

export const API_URL = (import.meta.env["VITE_API_URL"] ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-16 (§26) — `code`
 * (estável por regra, ex. `PLAN_VERSION_CONFLICT`) e `correlationId` (id da
 * requisição, útil pra achar a linha certa no log do servidor ao investigar
 * um erro relatado) vêm do novo envelope `{code, message, details?,
 * correlationId}`. Aditivo: `.message`/`.status`/`.details` continuam
 * exatamente como antes — nenhum call site existente precisa mudar.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
    readonly code?: string,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * B-33 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §12 — "sem
 * tratamento global de 401") — sessão expirando NO MEIO do uso (não o
 * `/api/auth/me` inicial, nem um 401 de senha errada no próprio formulário
 * de login) caía como qualquer outro erro de rede: `store.tsx` mostrava
 * "Não foi possível acessar o serviço" e a pessoa nunca era levada de volta
 * ao login. `api.ts` é um módulo comum (não um hook) — não pode chamar
 * `setUser(null)` direto —, então só notifica quem registrar interesse;
 * `AuthProvider` (`auth.tsx`) é quem decide se um 401 específico significa
 * "sessão que existia caiu" (só quando já havia usuário autenticado) ou é
 * irrelevante (login/register/me sem sessão nenhuma ainda).
 */
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

/**
 * R2-TEC-21 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — nem todo 401 significa
 * "a sessão caiu". `INVALID_CURRENT_PASSWORD` (senha atual errada ao trocar
 * senha) e `INVALID_CREDENTIALS`/`ACCOUNT_DISABLED` (login) também são 401,
 * mas são erro de NEGÓCIO de uma requisição específica — antes desta
 * allowlist, qualquer um deles disparava `unauthorizedHandler`
 * (`auth.tsx`) e deslogava quem só errou a senha atual no próprio
 * formulário de troca de senha, dentro de uma sessão perfeitamente válida.
 * Allowlist (não denylist) é deliberado: só os códigos abaixo, todos
 * emitidos por `auth/plugin.ts#requireAuth`, de fato significam "o cookie
 * de sessão não autentica mais" — qualquer 401 de rota de negócio fica de
 * fora por padrão, mesmo que um código novo apareça no futuro.
 */
const SESSION_INVALIDATING_CODES = new Set([
  "AUTHENTICATION_REQUIRED",
  "SESSION_INVALID",
  "SESSION_REVOKED",
]);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Sem corpo não vai content-type: o Fastify tenta parsear o JSON ausente e
  // responde 400 (FST_ERR_CTP_EMPTY_JSON_BODY), quebrando todo DELETE.
  const headers: Record<string, string> = {
    ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };

  // ORIENTACAO-NONA-RODADA-FECHAMENTO, Seção 24 — sessão vive num cookie
  // HttpOnly, não em localStorage/JS. `credentials: "include"` é o que faz o
  // browser anexar esse cookie em requisição cross-port (localhost:5175 →
  // localhost:4000 é cross-origin do ponto de vista do fetch, mesmo "same
  // site"); sem isto o cookie simplesmente não sai, mesmo já gravado.
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      details?: unknown;
      code?: string;
      correlationId?: string;
    } | null;
    if (response.status === 401 && body?.code && SESSION_INVALIDATING_CODES.has(body.code)) {
      unauthorizedHandler?.();
    }
    throw new ApiError(
      body?.message ?? `${init?.method ?? "GET"} ${path} falhou (${response.status})`,
      response.status,
      body?.details,
      body?.code,
      body?.correlationId,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * ORIENTACAO-DECIMA-RODADA, Seção 71 — o PDF chega como blob, não JSON;
 * `request()` não serve aqui. Devolve o filename já resolvido do
 * `Content-Disposition` (o backend decide o nome — Seção 55 — o cliente só
 * repassa pro download).
 */
async function requestBlob(path: string, body: unknown): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
      correlationId?: string;
    } | null;
    throw new ApiError(
      errorBody?.message ?? `POST ${path} falhou (${response.status})`,
      response.status,
      undefined,
      errorBody?.code,
      errorBody?.correlationId,
    );
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return { blob: await response.blob(), filename: match?.[1] ?? "relatorio.pdf" };
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const put = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PUT", body: JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

export interface AssessmentItemPatch {
  self?: Level;
  leader?: Level;
  target?: Level;
  final?: Level;
}

/** Autor, papel e datas são preenchidos pelo servidor a partir da sessão. */
export type CommentInput = Pick<AssessmentComment, "text">;

export interface AuthResult {
  user: SessionUser;
}

export const authApi = {
  /** Diz se a instância já tem alguma conta — define login x primeiro acesso. */
  status: () => request<{ hasUsers: boolean }>("/api/auth/status"),
  login: (email: string, password: string) =>
    post<AuthResult>("/api/auth/login", { email, password }),
  register: (input: { name: string; email: string; password: string }) =>
    post<AuthResult>("/api/auth/register", input),
  /** Só o servidor apaga um cookie HttpOnly — sem isto a sessão nunca de fato encerra. */
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  me: () => request<SessionUser>("/api/auth/me"),
  users: () => request<SessionUser[]>("/api/auth/users"),
  /** Papel, vínculo com arquiteto e status (ativa/desabilitada) de outra conta — admin-only no backend. */
  updateUser: (
    id: string,
    patch_: Partial<{ role: UserRole; architectId: string | null; status: UserStatus }>,
  ) => patch<SessionUser>(`/api/auth/users/${id}`, patch_),
  /**
   * ENT-AUTH-001 — única forma de entrar conta na instância depois do
   * bootstrap. `temporaryPassword` só vem nesta resposta — o admin repassa
   * por um canal fora da aplicação.
   */
  createUser: (input: {
    name: string;
    email: string;
    role: UserRole;
    architectId?: string | null;
  }) => post<{ user: SessionUser; temporaryPassword: string }>("/api/auth/users", input),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<void>("/api/auth/change-password", { currentPassword, newPassword }),
};

export const api = {
  /**
   * B-11 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1-10) — único
   * ponto do app que valida a resposta em runtime (`appStateSchema`, gerado
   * à mão a partir de `AppState`/`domain.ts`) em vez de um cast puro. Falha
   * de validação joga um `ZodError`, que `useQuery` (`store.tsx`) já trata
   * como qualquer outro erro de rede — drift vira erro visível, não
   * `undefined` se propagando silenciosamente pela UI.
   *
   * R2-TEC-20 — `architect.role` no schema é `z.string()`, mais largo que
   * `RoleName` (`AppState`/`domain.ts`): validar de propósito não exclui um
   * nome de cargo desconhecido (criar um 4º nível de carreira, já
   * documentado como cenário esperado em ADR-0002, não pode derrubar o
   * app inteiro em `ConnectionError` por causa disto). O `as AppState`
   * aqui é a fronteira deliberada desse afrouxamento: o restante do app
   * continua tratando `role` como `RoleName` (os 3 nomes conhecidos são o
   * caso comum) — só deixou de ser uma garantia de RUNTIME.
   */
  getState: () =>
    request<AppState>("/api/state").then((data) => appStateSchema.parse(data) as AppState),

  setActiveCycle: (cycleId: string) =>
    put<{ cycleId: string }>("/api/settings/active-cycle", { cycleId }),

  /* arquitetos */
  /** B-32 — id é sempre gerado no servidor; nunca aceito do cliente (evita colisão de slug). */
  createArchitect: (architect: Omit<Architect, "id" | "version">) =>
    post<Architect>("/api/architects", architect),
  /** `role`/`version` ficam de fora — ENT-CAR-017: nível de carreira só muda por `transitionCareerLevel`. */
  updateArchitect: (id: string, patch_: Partial<Omit<Architect, "id" | "role" | "version">>) =>
    patch<Architect>(`/api/architects/${id}`, patch_),
  /**
   * ENT-CAR-017 — comando dedicado, não um PATCH de `role`: exige motivo e
   * concorrência otimista, mesmo padrão de `reopenPlan`.
   */
  transitionCareerLevel: (
    id: string,
    toRole: Architect["role"],
    reason: string,
    expectedVersion: number,
  ) =>
    post<Architect>(`/api/architects/${id}/career-level-transition`, {
      toRole,
      reason,
      expectedVersion,
    }),
  careerLevelTransitions: (id: string) =>
    request<CareerLevelTransition[]>(`/api/architects/${id}/career-level-transitions`),

  /* carreira */
  // R2-TEC-19 — validado em runtime (mesmo padrão de getState/appStateSchema),
  // não só um cast de tipo: `careerLevels` perdeu essa checagem quando saiu
  // de `/api/state` (B-24, ADR-0011) e nunca ganhou uma equivalente no
  // endpoint dedicado.
  careerLevels: () =>
    request<CareerLevel[]>("/api/career-levels").then((data) =>
      careerLevelsResponseSchema.parse(data),
    ),
  /**
   * ORIENTACAO-NONA-RODADA, Seção 16 (ENT-09-009) — Política de Progressão:
   * mínimo global >=3 já é validado no backend (`policyPatchSchema`,
   * `routes/api/career.ts`); admin-only lá também.
   */
  updateCareerLevelPolicy: (careerLevelId: string, minimumQualifiedCapabilities: number) =>
    patch<CareerLevelPolicy>(`/api/career-levels/${careerLevelId}/policy`, {
      minimumQualifiedCapabilities,
    }),

  /* catálogo */
  /** `curation` nunca vem do cliente — é sempre calculado pelo servidor a partir das competências. B-32: `id` idem — gerado no servidor. */
  createCapability: (capability: Omit<Capability, "id" | "curation">) =>
    post<Capability>("/api/capabilities", capability),
  updateCapability: (id: string, patch_: Partial<Omit<Capability, "id" | "curation">>) =>
    patch<Capability>(`/api/capabilities/${id}`, patch_),
  /** `archived: true` quando a capacidade já tinha histórico e foi arquivada em vez de apagada. */
  deleteCapability: (id: string) =>
    del<{ archived: boolean; competenciesRemoved: number }>(`/api/capabilities/${id}`),
  /** B-32 — id é sempre gerado no servidor; nunca aceito do cliente (evita colisão de slug). */
  createCompetency: (competency: Omit<Competency, "id">) =>
    post<Competency>("/api/competencies", competency),
  updateCompetency: (id: string, patch_: Partial<Omit<Competency, "id">>) =>
    patch<Competency>(`/api/competencies/${id}`, patch_),
  /** `undefined` (204) = apagada de verdade; `{archived:true}` (200) = arquivada por já ter histórico. */
  deleteCompetency: (id: string) =>
    del<{ archived: boolean } | undefined>(`/api/competencies/${id}`),
  /**
   * ORIENTACAO-NONA-RODADA — troca RESTRICTIVE ↔ NON_RESTRICTIVE entre duas
   * competências da mesma capacidade, numa transação só. Único jeito de
   * mudar o tipo de uma quando os dois lados já estão em 3/3 (READY) — um
   * `PATCH` comum é sempre recusado nesse caso, porque o destino já está no
   * teto.
   */
  swapCompetencyRequirement: (id: string, withCompetencyId: string) =>
    post<{ a: Competency; b: Competency }>(`/api/competencies/${id}/swap-requirement`, {
      withCompetencyId,
    }),

  /* ciclos */
  createCycle: (cycle: DevelopmentCycle) => post<DevelopmentCycle>("/api/cycles", cycle),
  updateCycle: (id: string, patch_: Partial<Omit<DevelopmentCycle, "id">>) =>
    patch<DevelopmentCycle>(`/api/cycles/${id}`, patch_),
  deleteCycle: (id: string) => del<void>(`/api/cycles/${id}`),

  /* assessments */
  openAssessment: (architectId: string, cycleId: string) =>
    post<Assessment>("/api/assessments", { architectId, cycleId }),
  /** AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-18 — `expectedVersion` obrigatório: concorrência otimista na transição de status. */
  setAssessmentStatus: (id: string, status: Assessment["status"], expectedVersion: number) =>
    patch<Assessment>(`/api/assessments/${id}/status`, { status, expectedVersion }),
  /** B-18 — idem, por item: concorrência otimista independente por competência. */
  patchAssessmentItem: (
    assessmentId: string,
    competencyId: string,
    body: AssessmentItemPatch,
    expectedVersion: number,
  ) =>
    patch<Assessment>(`/api/assessments/${assessmentId}/items/${competencyId}`, {
      ...body,
      expectedVersion,
    }),

  addAssessmentComment: (assessmentId: string, competencyId: string, body: CommentInput) =>
    post<Assessment>(`/api/assessments/${assessmentId}/items/${competencyId}/comments`, body),
  updateAssessmentComment: (
    assessmentId: string,
    competencyId: string,
    commentId: string,
    body: CommentInput,
  ) =>
    patch<Assessment>(
      `/api/assessments/${assessmentId}/items/${competencyId}/comments/${commentId}`,
      body,
    ),
  deleteAssessmentComment: (assessmentId: string, competencyId: string, commentId: string) =>
    del<Assessment>(`/api/assessments/${assessmentId}/items/${competencyId}/comments/${commentId}`),

  /**
   * ENT-CAR-014 — portfólio individual de capacidades. "Profissional
   * propõe" (`addAssessmentCapability`, só `Draft`), "Tech Lead confirma"
   * (`confirmAssessmentCapability`, só `In Review`).
   */
  assessmentCapabilities: (assessmentId: string) =>
    request<AssessmentCapability[]>(`/api/assessments/${assessmentId}/capabilities`),
  addAssessmentCapability: (assessmentId: string, capabilityId: string) =>
    post<AssessmentCapability>(`/api/assessments/${assessmentId}/capabilities`, { capabilityId }),
  /**
   * ORIENTACAO-NONA-RODADA, Seção 8, problema 3 — remover uma capacidade
   * com competência já respondida devolve 409 (`hadAnsweredItems: true`)
   * sem `force`; a tela precisa pedir confirmação explícita e reenviar
   * com `force=true` antes de descartar as respostas.
   */
  removeAssessmentCapability: (assessmentId: string, capabilityId: string, force = false) =>
    del<void>(
      `/api/assessments/${assessmentId}/capabilities/${capabilityId}${force ? "?force=true" : ""}`,
    ),
  confirmAssessmentCapability: (assessmentId: string, capabilityId: string) =>
    post<AssessmentCapability>(
      `/api/assessments/${assessmentId}/capabilities/${capabilityId}/confirm`,
      {},
    ),
  /** ENT-CAR-015/016 — portfólio + qualificação + política do próximo nível, já juntos. */
  assessmentEligibility: (assessmentId: string) =>
    request<AssessmentEligibility>(`/api/assessments/${assessmentId}/eligibility`),

  /**
   * ESPECIFICACAO-OITAVA-RODADA, Seção 18 — "Começar/Parar/Continuar".
   * `expectedVersion` sempre a versão já lida (0 quando `GET` ainda não
   * devolveu nenhuma escrita — sentinel de "ainda não existe").
   */
  assessmentDevelopmentSummary: (assessmentId: string) =>
    request<AssessmentDevelopmentSummary>(`/api/assessments/${assessmentId}/development-summary`),
  updateAssessmentDevelopmentSummary: (
    assessmentId: string,
    body: Pick<AssessmentDevelopmentSummary, "startDoing" | "stopDoing" | "continueDoing">,
    expectedVersion: number,
  ) =>
    put<AssessmentDevelopmentSummary>(`/api/assessments/${assessmentId}/development-summary`, {
      ...body,
      expectedVersion,
    }),

  /* PDI */
  addPlanItem: (architectId: string, cycleId: string, item: DevelopmentPlanItem) =>
    post<DevelopmentPlan>(`/api/plans/${architectId}/items`, { cycleId, item }),
  /**
   * ESPECIFICACAO-OITAVA-RODADA, Seção 15/25/28/34 — criação source-driven:
   * o cliente referencia o gap (assessment + competência); o servidor
   * deriva `currentLevel`/`targetLevel`/`priority` a partir do assessment
   * oficial. Nunca aceitar esses três do cliente aqui — não é só
   * convenção, o schema do backend nem tem esses campos.
   */
  createPlanItemFromGap: (
    architectId: string,
    item: {
      id: string;
      assessmentId: string;
      competencyId: string;
      objective: string;
      actionType: ActionType;
      actionPlan: string;
      startDate: string;
      targetDate: string;
      owner: string;
      dedicationHoursPerWeek?: number | null;
    },
  ) => post<DevelopmentPlan>(`/api/plans/${architectId}/items/from-gap`, item),
  /**
   * `expectedVersion` sustenta concorrência otimista (ENT-DATA-012) —
   * sempre a versão do item já lido. `currentLevel`/`targetLevel`/
   * `priority`/`sourceAssessmentId` ficam de fora do tipo: são derivados
   * na criação (`createPlanItemFromGap`) e o backend nem aceita PATCH
   * neles (Seção 15/28) — o tipo aqui só espelha o que a rota de fato
   * recebe, para não sugerir uma escrita que sempre seria ignorada.
   */
  patchPlanItem: (
    planId: string,
    itemId: string,
    body: Partial<
      Omit<
        DevelopmentPlanItem,
        "version" | "currentLevel" | "targetLevel" | "priority" | "sourceAssessmentId"
      >
    >,
    expectedVersion: number,
  ) => patch<DevelopmentPlan>(`/api/plans/${planId}/items/${itemId}`, { ...body, expectedVersion }),
  removePlanItem: (planId: string, itemId: string) =>
    del<void>(`/api/plans/${planId}/items/${itemId}`),
  updatePlanStatus: (planId: string, status: DevelopmentPlan["status"], expectedVersion: number) =>
    patch<DevelopmentPlan>(`/api/plans/${planId}/status`, { status, expectedVersion }),
  /**
   * Reabertura de PDI concluído (ENT-PDI-001) — comando dedicado, não um
   * PATCH de status: exige motivo, e só o Tech Lead responsável.
   */
  reopenPlan: (planId: string, reason: string, expectedVersion: number) =>
    post<DevelopmentPlan>(`/api/plans/${planId}/reopen`, { reason, expectedVersion }),
  planEvents: (planId: string) => request<DevelopmentPlanEvent[]>(`/api/plans/${planId}/events`),
  addPlanItemCheckin: (planId: string, itemId: string, text: string) =>
    post<DevelopmentPlan>(`/api/plans/${planId}/items/${itemId}/checkins`, { text }),
  /**
   * Seção 17 — reprogramar prazo depois de `Approved` (quando o PATCH
   * genérico já bloqueia `targetDate`) é um comando dedicado: motivo
   * obrigatório, `expectedVersion` sustenta a mesma concorrência otimista
   * do resto do PDI.
   */
  reschedulePlanItem: (
    planId: string,
    itemId: string,
    targetDate: string,
    reason: string,
    expectedVersion: number,
  ) =>
    post<DevelopmentPlan>(`/api/plans/${planId}/items/${itemId}/reschedule`, {
      targetDate,
      reason,
      expectedVersion,
    }),
  /** Histórico append-only de reprogramações de um item — prazos anteriores, com motivo. */
  planItemEvents: (planId: string, itemId: string) =>
    request<DevelopmentPlanItemEvent[]>(`/api/plans/${planId}/items/${itemId}/events`),

  /* trilhas */
  createLearningPath: (path: LearningPath) => post<LearningPath>("/api/learning-paths", path),
  updateLearningPath: (
    id: string,
    patch_: Partial<
      Pick<LearningPath, "name" | "description" | "competencyIds" | "assignedTo" | "items">
    >,
  ) => patch<LearningPath>(`/api/learning-paths/${id}`, patch_),
  deleteLearningPath: (id: string) => del<void>(`/api/learning-paths/${id}`),
  addLearningItem: (pathId: string, item: LearningPathItem) =>
    post<LearningPath>(`/api/learning-paths/${pathId}/items`, item),
  removeLearningItem: (pathId: string, itemId: string) =>
    del<LearningPath>(`/api/learning-paths/${pathId}/items/${itemId}`),
  /** Progresso é por pessoa: só a própria pessoa (ou admin) pode registrar o dela. */
  patchLearningItemProgress: (
    pathId: string,
    architectId: string,
    itemId: string,
    progress: number,
  ) =>
    patch<LearningPath>(`/api/learning-paths/${pathId}/progress/${architectId}/${itemId}`, {
      progress,
    }),

  /* registros */
  createMentoringSession: (
    session: MentoringSession,
    proficiencyUpdates: ProficiencyUpdate[] = [],
  ) => post<MentoringSession>("/api/mentoring-sessions", { ...session, proficiencyUpdates }),
  scheduleMentoringFollowUp: (id: string, nextSession: string | null) =>
    patch<MentoringSession>(`/api/mentoring-sessions/${id}`, { nextSession }),
  createEvidence: (evidence: Evidence) => post<Evidence>("/api/evidences", evidence),
  /** Revisão (status + comentário) é decisão do Tech Lead — rota admin-only no backend. */
  reviewEvidence: (
    id: string,
    review: { status: Evidence["status"]; leaderComment?: string | undefined },
  ) => patch<Evidence>(`/api/evidences/${id}/review`, review),
  /**
   * ENT-EVD-002 — reenvio depois de "Needs Improvement": a própria pessoa
   * (ou o Tech Lead dela) corrige e a evidência volta para Pending.
   */
  resubmitEvidence: (id: string, patch_: { description?: string; url?: string }) =>
    post<Evidence>(`/api/evidences/${id}/resubmit`, patch_),
  evidenceReviews: (id: string) =>
    request<
      Array<{
        id: string;
        reviewerUserId: string;
        status: Evidence["status"];
        comment: string | null;
        reviewedAt: string;
      }>
    >(`/api/evidences/${id}/reviews`),
};

/**
 * ORIENTACAO-DECIMA-RODADA, Seção 47-49/55 — mesmo serviço de analytics do
 * backend, aqui só a chamada de rede; nenhum cálculo replicado no cliente.
 */
export const evolutionApi = {
  architect: (architectId: string, filters: EvolutionFilters) =>
    post<ArchitectEvolutionResult>("/api/evolution/architect", { architectId, ...filters }),
  team: (architects: SelectionScope, filters: EvolutionFilters) =>
    post<TeamEvolutionResult>("/api/evolution/team", { architects, ...filters }),
};

/**
 * Fase 10.6 — só individual: o relatório é "o que esta pessoa está vendo na
 * tela de Evolução dela", mesmo escopo de `evolutionApi.architect`. Time
 * inteiro em PDF não foi pedido nem construído no backend (que renderizador
 * de tabela/gráfico faria sentido pra dezenas de pessoas de uma vez é uma
 * decisão de produto em aberto, não um detalhe de implementação).
 */
export const reportsApi = {
  exportEvolutionPdf: (architectId: string, filters: EvolutionFilters) =>
    requestBlob("/api/reports/evolution/pdf", { architectId, ...filters }),
};
