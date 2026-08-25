import type { Evidence } from "../domain";
import type { ApiClient } from "../api-client";

/**
 * OO-FE-02 — gateway do contexto "evidências". Ver `cycles.gateway.ts` para
 * a explicação do padrão interface + `Http*` e do porquê dos métodos serem
 * arrow functions de campo (spread-safe na fachada `api.ts`).
 */
export interface EvidenceGateway {
  createEvidence(evidence: Evidence): Promise<Evidence>;
  reviewEvidence(
    id: string,
    review: { status: Evidence["status"]; leaderComment?: string | undefined },
  ): Promise<Evidence>;
  resubmitEvidence(id: string, patch_: { description?: string; url?: string }): Promise<Evidence>;
  evidenceReviews(id: string): Promise<
    Array<{
      id: string;
      reviewerUserId: string;
      status: Evidence["status"];
      comment: string | null;
      reviewedAt: string;
    }>
  >;
}

export class HttpEvidenceGateway implements EvidenceGateway {
  constructor(private readonly client: ApiClient) {}

  createEvidence = (evidence: Evidence): Promise<Evidence> =>
    this.client.post<Evidence>("/api/evidences", evidence);

  /** Revisão (status + comentário) é decisão do Tech Lead — rota admin-only no backend. */
  reviewEvidence = (
    id: string,
    review: { status: Evidence["status"]; leaderComment?: string | undefined },
  ): Promise<Evidence> => this.client.patch<Evidence>(`/api/evidences/${id}/review`, review);

  /**
   * ENT-EVD-002 — reenvio depois de "Needs Improvement": a própria pessoa
   * (ou o Tech Lead dela) corrige e a evidência volta para Pending.
   */
  resubmitEvidence = (
    id: string,
    patch_: { description?: string; url?: string },
  ): Promise<Evidence> => this.client.post<Evidence>(`/api/evidences/${id}/resubmit`, patch_);

  evidenceReviews = (
    id: string,
  ): Promise<
    Array<{
      id: string;
      reviewerUserId: string;
      status: Evidence["status"];
      comment: string | null;
      reviewedAt: string;
    }>
  > =>
    this.client.request<
      Array<{
        id: string;
        reviewerUserId: string;
        status: Evidence["status"];
        comment: string | null;
        reviewedAt: string;
      }>
    >(`/api/evidences/${id}/reviews`);
}
