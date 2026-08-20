import type {
  Architect,
  Assessment,
  AssessmentComment,
  CareerLevel,
  CareerLevelPolicy,
  CareerLevelTransition,
  Competency,
  Capability,
  DevelopmentCycle,
  DevelopmentPlan,
  DevelopmentPlanEvent,
  DevelopmentPlanItem,
  Evidence,
  LearningPath,
  LearningPathItem,
  Level,
  MentoringSession,
} from "./domain";

/** Snapshot devolvido por GET /api/state — espelha o AppState do backend. */
export interface AppState {
  capabilities: Capability[];
  competencies: Competency[];
  careerLevels: CareerLevel[];
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

const TOKEN_STORAGE_KEY = "architect-os.token";

/**
 * O token vive no localStorage e numa variável em memória — a variável evita
 * ler o storage a cada requisição e mantém o SSR funcionando (onde não há
 * `window`).
 */
let authToken: string | null = null;

export function loadStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  authToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  return authToken;
}

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Sem corpo não vai content-type: o Fastify tenta parsear o JSON ausente e
  // responde 400 (FST_ERR_CTP_EMPTY_JSON_BODY), quebrando todo DELETE.
  const headers: Record<string, string> = {
    ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (authToken) headers["authorization"] = `Bearer ${authToken}`;

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      details?: unknown;
    } | null;
    throw new ApiError(
      body?.message ?? `${init?.method ?? "GET"} ${path} falhou (${response.status})`,
      response.status,
      body?.details,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
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
  token: string;
  user: SessionUser;
}

export const authApi = {
  /** Diz se a instância já tem alguma conta — define login x primeiro acesso. */
  status: () => request<{ hasUsers: boolean }>("/api/auth/status"),
  login: (email: string, password: string) =>
    post<AuthResult>("/api/auth/login", { email, password }),
  register: (input: { name: string; email: string; password: string }) =>
    post<AuthResult>("/api/auth/register", input),
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
  getState: () => request<AppState>("/api/state"),

  setActiveCycle: (cycleId: string) =>
    put<{ cycleId: string }>("/api/settings/active-cycle", { cycleId }),

  /* arquitetos */
  createArchitect: (architect: Omit<Architect, "version">) =>
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

  /* catálogo */
  createCapability: (capability: Capability) => post<Capability>("/api/capabilities", capability),
  updateCapability: (id: string, patch_: Partial<Omit<Capability, "id">>) =>
    patch<Capability>(`/api/capabilities/${id}`, patch_),
  /** `archived: true` quando a capacidade já tinha histórico e foi arquivada em vez de apagada. */
  deleteCapability: (id: string) =>
    del<{ archived: boolean; competenciesRemoved: number }>(`/api/capabilities/${id}`),
  createCompetency: (competency: Competency) => post<Competency>("/api/competencies", competency),
  updateCompetency: (id: string, patch_: Partial<Omit<Competency, "id">>) =>
    patch<Competency>(`/api/competencies/${id}`, patch_),
  /** `undefined` (204) = apagada de verdade; `{archived:true}` (200) = arquivada por já ter histórico. */
  deleteCompetency: (id: string) =>
    del<{ archived: boolean } | undefined>(`/api/competencies/${id}`),

  /* ciclos */
  createCycle: (cycle: DevelopmentCycle) => post<DevelopmentCycle>("/api/cycles", cycle),
  updateCycle: (id: string, patch_: Partial<Omit<DevelopmentCycle, "id">>) =>
    patch<DevelopmentCycle>(`/api/cycles/${id}`, patch_),
  deleteCycle: (id: string) => del<void>(`/api/cycles/${id}`),

  /* assessments */
  openAssessment: (architectId: string, cycleId: string) =>
    post<Assessment>("/api/assessments", { architectId, cycleId }),
  setAssessmentStatus: (id: string, status: Assessment["status"]) =>
    patch<Assessment>(`/api/assessments/${id}/status`, { status }),
  patchAssessmentItem: (assessmentId: string, competencyId: string, body: AssessmentItemPatch) =>
    patch<Assessment>(`/api/assessments/${assessmentId}/items/${competencyId}`, body),

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

  /* PDI */
  addPlanItem: (architectId: string, cycleId: string, item: DevelopmentPlanItem) =>
    post<DevelopmentPlan>(`/api/plans/${architectId}/items`, { cycleId, item }),
  /** `expectedVersion` sustenta concorrência otimista (ENT-DATA-012) — sempre a versão do item já lido. */
  patchPlanItem: (
    planId: string,
    itemId: string,
    body: Partial<Omit<DevelopmentPlanItem, "version">>,
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
  createMentoringSession: (session: MentoringSession) =>
    post<MentoringSession>("/api/mentoring-sessions", session),
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
