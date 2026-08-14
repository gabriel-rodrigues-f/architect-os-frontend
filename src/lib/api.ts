import type {
  Architect,
  Assessment,
  AssessmentComment,
  Certification,
  Competency,
  CompetencyCategory,
  DevelopmentCycle,
  DevelopmentPlan,
  DevelopmentPlanItem,
  Evidence,
  LearningPath,
  LearningPathItem,
  Level,
  MentoringSession,
  Okr,
  Swot,
} from "./domain";

/** Etapa da filosofia de desenvolvimento exibida no dashboard. */
export interface PhilosophyStage {
  id: string;
  name: string;
}

export interface DevelopmentPhilosophy {
  title: string;
  description: string;
  stages: PhilosophyStage[];
  footer: string;
}

/** Snapshot devolvido por GET /api/state — espelha o AppState do backend. */
export interface AppState {
  categories: CompetencyCategory[];
  competencies: Competency[];
  architects: Architect[];
  assessments: Assessment[];
  cycles: DevelopmentCycle[];
  swots: Swot[];
  plans: DevelopmentPlan[];
  okrs: Okr[];
  learningPaths: LearningPath[];
  mentoringSessions: MentoringSession[];
  evidences: Evidence[];
  certifications: Certification[];
  activeCycleId: string;
  philosophy: DevelopmentPhilosophy;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  architectId: string | null;
  createdAt: string;
}

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

/** Os dois lados do par vão juntos — o backend recusa se algum vier vazio. */
export type CommentInput = Pick<AssessmentComment, "architectText" | "techLeadText">;

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
};

export const api = {
  getState: () => request<AppState>("/api/state"),

  setActiveCycle: (cycleId: string) =>
    put<{ cycleId: string }>("/api/settings/active-cycle", { cycleId }),

  /* arquitetos */
  createArchitect: (architect: Architect) => post<Architect>("/api/architects", architect),
  updateArchitect: (id: string, patch_: Partial<Omit<Architect, "id">>) =>
    patch<Architect>(`/api/architects/${id}`, patch_),
  deleteArchitect: (id: string) => del<void>(`/api/architects/${id}`),
  moveNineBox: (
    architectId: string,
    performance: Architect["performance"],
    potential: Architect["potential"],
  ) => patch<Architect>(`/api/architects/${architectId}/nine-box`, { performance, potential }),

  /* catálogo */
  createCategory: (category: CompetencyCategory) =>
    post<CompetencyCategory>("/api/categories", category),
  updateCategory: (id: string, patch_: Partial<Omit<CompetencyCategory, "id">>) =>
    patch<CompetencyCategory>(`/api/categories/${id}`, patch_),
  deleteCategory: (id: string) => del<{ competenciesRemoved: number }>(`/api/categories/${id}`),
  createCompetency: (competency: Competency) => post<Competency>("/api/competencies", competency),
  updateCompetency: (id: string, patch_: Partial<Omit<Competency, "id">>) =>
    patch<Competency>(`/api/competencies/${id}`, patch_),
  deleteCompetency: (id: string) => del<void>(`/api/competencies/${id}`),

  /* ciclos */
  createCycle: (cycle: DevelopmentCycle) => post<DevelopmentCycle>("/api/cycles", cycle),
  updateCycle: (id: string, patch_: Partial<Omit<DevelopmentCycle, "id">>) =>
    patch<DevelopmentCycle>(`/api/cycles/${id}`, patch_),
  deleteCycle: (id: string) => del<void>(`/api/cycles/${id}`),

  /* filosofia */
  savePhilosophy: (philosophy: DevelopmentPhilosophy) =>
    put<DevelopmentPhilosophy>("/api/philosophy", philosophy),

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

  putSwot: (
    architectId: string,
    cycleId: string,
    body: Partial<Omit<Swot, "architectId" | "cycleId">>,
  ) => put<Swot>(`/api/swots/${architectId}/${cycleId}`, body),

  /* PDI e OKR */
  addPlanItem: (architectId: string, cycleId: string, item: DevelopmentPlanItem) =>
    post<DevelopmentPlan>(`/api/plans/${architectId}/items`, { cycleId, item }),
  patchPlanItem: (planId: string, itemId: string, body: Partial<DevelopmentPlanItem>) =>
    patch<DevelopmentPlan>(`/api/plans/${planId}/items/${itemId}`, body),
  patchKeyResult: (okrId: string, keyResultId: string, progress: number) =>
    patch<Okr>(`/api/okrs/${okrId}/key-results/${keyResultId}`, { progress }),

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
  patchLearningItem: (pathId: string, itemId: string, progress: number) =>
    patch<LearningPath>(`/api/learning-paths/${pathId}/items/${itemId}`, { progress }),

  /* registros */
  createMentoringSession: (session: MentoringSession) =>
    post<MentoringSession>("/api/mentoring-sessions", session),
  createEvidence: (evidence: Evidence) => post<Evidence>("/api/evidences", evidence),
  createCertification: (certification: Certification) =>
    post<Certification>("/api/certifications", certification),
};
