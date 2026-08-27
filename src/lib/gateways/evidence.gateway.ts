import type { Evidence } from "../domain";
import type { ApiClient } from "../api-client";

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
    this.client.post<Evidence>("/evidences", evidence);

  reviewEvidence = (
    id: string,
    review: { status: Evidence["status"]; leaderComment?: string | undefined },
  ): Promise<Evidence> => this.client.patch<Evidence>(`/evidences/${id}/review`, review);

  resubmitEvidence = (
    id: string,
    patch_: { description?: string; url?: string },
  ): Promise<Evidence> => this.client.post<Evidence>(`/evidences/${id}/resubmit`, patch_);

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
    >(`/evidences/${id}/reviews`);
}
