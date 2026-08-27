import type { api, SessionUser } from "../api";
import type {
  Architect,
  Assessment,
  AssessmentCapability,
  AssessmentDevelopmentSummary,
  AssessmentEligibility,
  Capability,
  Level,
} from "../domain";
import type { CommentInput } from "../gateways/assessment.gateway";
import type { UiAuthorizationPolicy } from "../scope";
import type { Api } from "../store";

export type AssessmentItemService = Pick<
  Api,
  | "updateAssessmentItem"
  | "addAssessmentComment"
  | "updateAssessmentComment"
  | "removeAssessmentComment"
>;

export type AssessmentPortfolioService = Pick<
  typeof api,
  | "addAssessmentCapability"
  | "removeAssessmentCapability"
  | "confirmAssessmentCapability"
  | "updateAssessmentDevelopmentSummary"
>;

interface AssessmentPermissions {
  isOwner: boolean;
  isLead: boolean;
  status: Assessment["status"] | undefined;
  isCompleted: boolean;
  canEditSelf: boolean;
  canEditLeaderFinal: boolean;
  canSubmit: boolean;
  canComplete: boolean;
  canReopen: boolean;
  incompleteSelf: boolean;
  incompleteLeaderFinal: boolean;
}

export class AssessmentViewModel {
  constructor(
    private readonly items: AssessmentItemService,
    private readonly portfolio: AssessmentPortfolioService,
    private readonly policy: UiAuthorizationPolicy,
  ) {}

  permissionsFor(
    user: SessionUser,
    architectId: string,
    selectedArchitect: Architect | undefined,
    assessment: Assessment | undefined,
  ): AssessmentPermissions {
    const isOwner = user.architectId === architectId;
    const isLead = !isOwner && this.policy.isLeadOf(user, selectedArchitect);
    const status = assessment?.status;
    const isCompleted = status === "Completed";
    const canEditSelf = !isLead && isOwner && status === "Draft";
    const canEditLeaderFinal = isLead && status === "In Review";
    const canSubmit = !isLead && isOwner && status === "Draft";
    const canComplete = isLead && status === "In Review";

    const canReopen = isLead && status === "Completed";

    const incompleteSelf = assessment?.items.some((i) => i.self === null) ?? false;
    const incompleteLeaderFinal =
      assessment?.items.some((i) => i.leader === null || i.final === null) ?? false;

    return {
      isOwner,
      isLead,
      status,
      isCompleted,
      canEditSelf,
      canEditLeaderFinal,
      canSubmit,
      canComplete,
      canReopen,
      incompleteSelf,
      incompleteLeaderFinal,
    };
  }

  updateSelfScore(assessmentId: string, competencyId: string, level: Level): void {
    this.items.updateAssessmentItem(assessmentId, competencyId, { self: level });
  }

  updateLeaderScore(assessmentId: string, competencyId: string, level: Level): void {
    this.items.updateAssessmentItem(assessmentId, competencyId, { leader: level });
  }

  updateFinalScore(assessmentId: string, competencyId: string, level: Level): void {
    this.items.updateAssessmentItem(assessmentId, competencyId, { final: level });
  }

  addComment(assessmentId: string, competencyId: string, input: CommentInput): Promise<Assessment> {
    return this.items.addAssessmentComment(assessmentId, competencyId, input);
  }

  updateComment(
    assessmentId: string,
    competencyId: string,
    commentId: string,
    input: CommentInput,
  ): Promise<Assessment> {
    return this.items.updateAssessmentComment(assessmentId, competencyId, commentId, input);
  }

  removeComment(
    assessmentId: string,
    competencyId: string,
    commentId: string,
  ): Promise<Assessment> {
    return this.items.removeAssessmentComment(assessmentId, competencyId, commentId);
  }

  proposeCapability(assessmentId: string, capabilityId: string): Promise<AssessmentCapability> {
    return this.portfolio.addAssessmentCapability(assessmentId, capabilityId);
  }

  confirmCapability(assessmentId: string, capabilityId: string): Promise<AssessmentCapability> {
    return this.portfolio.confirmAssessmentCapability(assessmentId, capabilityId);
  }

  removeCapability(assessmentId: string, capabilityId: string, force = false): Promise<void> {
    return this.portfolio.removeAssessmentCapability(assessmentId, capabilityId, force);
  }

  availableCapabilitiesToPropose(
    allCapabilities: readonly Capability[],
    eligibility: AssessmentEligibility,
  ): Capability[] {
    return allCapabilities.filter(
      (cap) =>
        cap.curation.status === "READY" &&
        !eligibility.capabilities.some((c) => c.capabilityId === cap.id),
    );
  }

  updateDevelopmentSummary(
    assessmentId: string,
    fields: Pick<AssessmentDevelopmentSummary, "startDoing" | "stopDoing" | "continueDoing">,
    expectedVersion: number,
  ): Promise<AssessmentDevelopmentSummary> {
    return this.portfolio.updateAssessmentDevelopmentSummary(assessmentId, fields, expectedVersion);
  }
}
