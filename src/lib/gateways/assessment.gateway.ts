import type {
  Assessment,
  AssessmentCapability,
  AssessmentComment,
  AssessmentDevelopmentSummary,
  AssessmentEligibility,
  Level,
} from "../domain";
import type { ApiClient } from "../api-client";

export interface AssessmentItemPatch {
  self?: Level;
  leader?: Level;
  target?: Level;
  final?: Level;
}

/** Autor, papel e datas são preenchidos pelo servidor a partir da sessão. */
export type CommentInput = Pick<AssessmentComment, "text">;

/**
 * OO-FE-02 — gateway do contexto "avaliação" (assessment). Ver
 * `cycles.gateway.ts` para a explicação do padrão interface + `Http*` e do
 * porquê dos métodos serem arrow functions de campo (spread-safe na
 * fachada `api.ts`).
 */
export interface AssessmentGateway {
  openAssessment(architectId: string, cycleId: string): Promise<Assessment>;
  setAssessmentStatus(
    id: string,
    status: Assessment["status"],
    expectedVersion: number,
  ): Promise<Assessment>;
  patchAssessmentItem(
    assessmentId: string,
    competencyId: string,
    body: AssessmentItemPatch,
    expectedVersion: number,
  ): Promise<Assessment>;
  addAssessmentComment(
    assessmentId: string,
    competencyId: string,
    body: CommentInput,
  ): Promise<Assessment>;
  updateAssessmentComment(
    assessmentId: string,
    competencyId: string,
    commentId: string,
    body: CommentInput,
  ): Promise<Assessment>;
  deleteAssessmentComment(
    assessmentId: string,
    competencyId: string,
    commentId: string,
  ): Promise<Assessment>;
  assessmentCapabilities(assessmentId: string): Promise<AssessmentCapability[]>;
  addAssessmentCapability(
    assessmentId: string,
    capabilityId: string,
  ): Promise<AssessmentCapability>;
  removeAssessmentCapability(
    assessmentId: string,
    capabilityId: string,
    force?: boolean,
  ): Promise<void>;
  confirmAssessmentCapability(
    assessmentId: string,
    capabilityId: string,
  ): Promise<AssessmentCapability>;
  assessmentEligibility(assessmentId: string): Promise<AssessmentEligibility>;
  assessmentDevelopmentSummary(assessmentId: string): Promise<AssessmentDevelopmentSummary>;
  updateAssessmentDevelopmentSummary(
    assessmentId: string,
    body: Pick<AssessmentDevelopmentSummary, "startDoing" | "stopDoing" | "continueDoing">,
    expectedVersion: number,
  ): Promise<AssessmentDevelopmentSummary>;
}

export class HttpAssessmentGateway implements AssessmentGateway {
  constructor(private readonly client: ApiClient) {}

  openAssessment = (architectId: string, cycleId: string): Promise<Assessment> =>
    this.client.post<Assessment>("/api/assessments", { architectId, cycleId });

  /** AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-18 — `expectedVersion` obrigatório: concorrência otimista na transição de status. */
  setAssessmentStatus = (
    id: string,
    status: Assessment["status"],
    expectedVersion: number,
  ): Promise<Assessment> =>
    this.client.patch<Assessment>(`/api/assessments/${id}/status`, { status, expectedVersion });

  /** B-18 — idem, por item: concorrência otimista independente por competência. */
  patchAssessmentItem = (
    assessmentId: string,
    competencyId: string,
    body: AssessmentItemPatch,
    expectedVersion: number,
  ): Promise<Assessment> =>
    this.client.patch<Assessment>(`/api/assessments/${assessmentId}/items/${competencyId}`, {
      ...body,
      expectedVersion,
    });

  addAssessmentComment = (
    assessmentId: string,
    competencyId: string,
    body: CommentInput,
  ): Promise<Assessment> =>
    this.client.post<Assessment>(
      `/api/assessments/${assessmentId}/items/${competencyId}/comments`,
      body,
    );

  updateAssessmentComment = (
    assessmentId: string,
    competencyId: string,
    commentId: string,
    body: CommentInput,
  ): Promise<Assessment> =>
    this.client.patch<Assessment>(
      `/api/assessments/${assessmentId}/items/${competencyId}/comments/${commentId}`,
      body,
    );

  deleteAssessmentComment = (
    assessmentId: string,
    competencyId: string,
    commentId: string,
  ): Promise<Assessment> =>
    this.client.del<Assessment>(
      `/api/assessments/${assessmentId}/items/${competencyId}/comments/${commentId}`,
    );

  /**
   * ENT-CAR-014 — portfólio individual de capacidades. "Profissional
   * propõe" (`addAssessmentCapability`, só `Draft`), "Tech Lead confirma"
   * (`confirmAssessmentCapability`, só `In Review`).
   */
  assessmentCapabilities = (assessmentId: string): Promise<AssessmentCapability[]> =>
    this.client.request<AssessmentCapability[]>(`/api/assessments/${assessmentId}/capabilities`);

  addAssessmentCapability = (
    assessmentId: string,
    capabilityId: string,
  ): Promise<AssessmentCapability> =>
    this.client.post<AssessmentCapability>(`/api/assessments/${assessmentId}/capabilities`, {
      capabilityId,
    });

  /**
   * ORIENTACAO-NONA-RODADA, Seção 8, problema 3 — remover uma capacidade
   * com competência já respondida devolve 409 (`hadAnsweredItems: true`)
   * sem `force`; a tela precisa pedir confirmação explícita e reenviar
   * com `force=true` antes de descartar as respostas.
   */
  removeAssessmentCapability = (
    assessmentId: string,
    capabilityId: string,
    force = false,
  ): Promise<void> =>
    this.client.del<void>(
      `/api/assessments/${assessmentId}/capabilities/${capabilityId}${force ? "?force=true" : ""}`,
    );

  confirmAssessmentCapability = (
    assessmentId: string,
    capabilityId: string,
  ): Promise<AssessmentCapability> =>
    this.client.post<AssessmentCapability>(
      `/api/assessments/${assessmentId}/capabilities/${capabilityId}/confirm`,
      {},
    );

  /** ENT-CAR-015/016 — portfólio + qualificação + política do próximo nível, já juntos. */
  assessmentEligibility = (assessmentId: string): Promise<AssessmentEligibility> =>
    this.client.request<AssessmentEligibility>(`/api/assessments/${assessmentId}/eligibility`);

  /**
   * ESPECIFICACAO-OITAVA-RODADA, Seção 18 — "Começar/Parar/Continuar".
   * `expectedVersion` sempre a versão já lida (0 quando `GET` ainda não
   * devolveu nenhuma escrita — sentinel de "ainda não existe").
   */
  assessmentDevelopmentSummary = (assessmentId: string): Promise<AssessmentDevelopmentSummary> =>
    this.client.request<AssessmentDevelopmentSummary>(
      `/api/assessments/${assessmentId}/development-summary`,
    );

  updateAssessmentDevelopmentSummary = (
    assessmentId: string,
    body: Pick<AssessmentDevelopmentSummary, "startDoing" | "stopDoing" | "continueDoing">,
    expectedVersion: number,
  ): Promise<AssessmentDevelopmentSummary> =>
    this.client.put<AssessmentDevelopmentSummary>(
      `/api/assessments/${assessmentId}/development-summary`,
      { ...body, expectedVersion },
    );
}
