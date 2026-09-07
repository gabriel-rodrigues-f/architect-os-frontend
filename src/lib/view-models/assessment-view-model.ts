import type { api, SessionUser } from "../api";
import type {
  Architect,
  Assessment,
  AssessmentCapability,
  AssessmentDevelopmentSummary,
  AssessmentEligibility,
  Capability,
  Competency,
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

export interface AssessmentCompletionBrief {
  readonly competencyCount: number;
  readonly divergentCount: number;
  readonly pendingLeaderFinal: readonly Competency[];
}

interface AssessmentPermissions {
  /** A pessoa É o sujeito desta avaliação — lê tudo o que é dela, não age (dono, 2026-09-06). */
  isSubject: boolean;
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
  seesAssessmentNumbers: boolean;
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
    // Ninguém age sobre si (dono, 2026-09-06): a autoavaliação é registrada
    // por quem lidera, na 1:1. O sujeito LÊ — veredito, respostas, números.
    const isSubject = this.policy.readsOwn(user, architectId);
    const isLead = this.policy.isLeadOf(user, selectedArchitect);
    // D4 (dono, 2026-09-05): o tech lead pontua; quem CONCLUI e REABRE é o
    // gerente designado (ou o admin como correção). D2: a própria pessoa vê
    // os próprios números.
    const decides = this.policy.decidesCareerOf(user, selectedArchitect);
    const status = assessment?.status;
    const isCompleted = status === "Completed";
    const canEditSelf = isLead && status === "Draft";
    const canEditLeaderFinal = isLead && status === "In Review";
    const canSubmit = isLead && status === "Draft";
    const canComplete = decides && status === "In Review";

    const canReopen = decides && status === "Completed";
    const seesAssessmentNumbers = this.policy.isLeadership(user) || isSubject;

    const incompleteSelf = assessment?.items.some((i) => i.self === null) ?? false;
    const incompleteLeaderFinal =
      assessment?.items.some((i) => i.leader === null || i.final === null) ?? false;

    return {
      isSubject,
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
      seesAssessmentNumbers,
    };
  }

  completionBriefFor(
    assessment: Assessment | undefined,
    competencies: readonly Competency[],
  ): AssessmentCompletionBrief {
    const items = assessment?.items ?? [];
    const divergentCount = items.filter(
      (item) => item.self !== null && item.leader !== null && item.self !== item.leader,
    ).length;
    const pendingIds = new Set(
      items
        .filter((item) => item.leader === null || item.final === null)
        .map((item) => item.competencyId),
    );
    return {
      competencyCount: items.length,
      divergentCount,
      pendingLeaderFinal: competencies.filter((competency) => pendingIds.has(competency.id)),
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
