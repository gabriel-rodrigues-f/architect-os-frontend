import type { Evidence, EvidenceType } from "../domain";
import type { Api } from "../store";

export type ArchitectProfileService = Pick<
  Api,
  "addEvidence" | "resubmitEvidence" | "reviewEvidence"
>;

export interface EvidenceDraft {
  title: string;
  description: string;
  type: EvidenceType;
  date: string;
  complexity: Evidence["complexity"];
  project: string;
  url: string;
  issuer: string;
  pdiItemId: string;
}

export class ArchitectProfileViewModel {
  constructor(private readonly service: ArchitectProfileService) {}

  registerEvidence(architectId: string, draft: EvidenceDraft): Promise<Evidence> {
    return this.service.addEvidence({
      id: "",
      architectId,
      title: draft.title.trim(),
      description: draft.description.trim(),
      type: draft.type,
      competencyIds: [],
      date: draft.date,
      complexity: draft.complexity,
      status: "Pending",
      ...(draft.project.trim() ? { project: draft.project.trim() } : {}),
      ...(draft.url.trim() ? { url: draft.url.trim() } : {}),
      ...(draft.type === "Certification" && draft.issuer.trim()
        ? { issuer: draft.issuer.trim() }
        : {}),
      ...(draft.pdiItemId ? { developmentPlanItemId: draft.pdiItemId } : {}),
    });
  }

  resubmit(
    evidence: Pick<Evidence, "id" | "description" | "url">,
    draft: { description: string; url: string },
  ): Promise<void> {
    return this.service.resubmitEvidence(evidence.id, {
      ...(draft.description.trim() !== evidence.description
        ? { description: draft.description.trim() }
        : {}),
      ...(draft.url.trim() !== (evidence.url ?? "") ? { url: draft.url.trim() } : {}),
    });
  }

  review(
    evidenceId: string,
    status: Exclude<Evidence["status"], "Pending">,
    comment: string,
  ): Promise<void> {
    return this.service.reviewEvidence(evidenceId, {
      status,
      ...(comment.trim() ? { leaderComment: comment.trim() } : {}),
    });
  }
}
