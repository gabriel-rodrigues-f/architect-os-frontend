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

export type CommentInput = Pick<AssessmentComment, "text">;

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

  setAssessmentStatus = (
    id: string,
    status: Assessment["status"],
    expectedVersion: number,
  ): Promise<Assessment> =>
    this.client.patch<Assessment>(`/api/assessments/${id}/status`, { status, expectedVersion });

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

  assessmentCapabilities = (assessmentId: string): Promise<AssessmentCapability[]> =>
    this.client.request<AssessmentCapability[]>(`/api/assessments/${assessmentId}/capabilities`);

  addAssessmentCapability = (
    assessmentId: string,
    capabilityId: string,
  ): Promise<AssessmentCapability> =>
    this.client.post<AssessmentCapability>(`/api/assessments/${assessmentId}/capabilities`, {
      capabilityId,
    });

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

  assessmentEligibility = (assessmentId: string): Promise<AssessmentEligibility> =>
    this.client.request<AssessmentEligibility>(`/api/assessments/${assessmentId}/eligibility`);

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
