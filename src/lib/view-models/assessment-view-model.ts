import type { api, SessionUser } from "../api";
import type {
  Professional,
  Assessment,
  AssessmentCapability,
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
  "addAssessmentCapability" | "removeAssessmentCapability" | "confirmAssessmentCapability"
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
  /**
   * QUEM ABRE A AVALIAÇÃO DO CICLO. Dono (2026-09-08): *"acessando como
   * profissional, não posso ver um botão de 'Abrir avaliação do ciclo';
   * consequentemente não verei a mensagem em vermelho acima."* A ação era
   * oferecida a todos e recusada pelo serviço — o vermelho era a recusa. A
   * pergunta passa a ser feita ANTES de desenhar, e a quem sabe respondê-la.
   */
  canOpen: boolean;
  canEditSelf: boolean;
  canEditLeaderFinal: boolean;
  /**
   * QUEM ESCREVE COMENTÁRIO NESTA AVALIAÇÃO. Dono (2026-09-09): a caixa de
   * texto era oferecida a quem não pode escrever, e a pessoa só descobria no
   * envio — o mesmo defeito do Plano de Ação, *"um bloco de texto, enganando
   * o usuário"*. A pergunta passa a ser feita ANTES de desenhar a caixa.
   */
  canComment: boolean;
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
    professionalId: string,
    selectedProfessional: Professional | undefined,
    assessment: Assessment | undefined,
  ): AssessmentPermissions {
    // Ninguém age sobre si (dono, 2026-09-06): a autoavaliação é registrada
    // por quem lidera, na 1:1. O sujeito LÊ — veredito, respostas, números.
    const isSubject = this.policy.readsOwn(user, professionalId);
    const isLead = this.policy.isLeadOf(user, selectedProfessional);
    // D4 (dono, 2026-09-05): o tech lead pontua; quem CONCLUI e REABRE é o
    // gerente designado (ou o admin como correção). D2: a própria pessoa vê
    // os próprios números.
    const decides = this.policy.decidesCareerOf(user, selectedProfessional);
    const status = assessment?.status;
    const isCompleted = status === "Completed";
    // Abre quem vai preencher: a liderança com vínculo naquela pessoa.
    // Ninguém age sobre si, então o sujeito nunca abre a própria avaliação.
    const canOpen = isLead;
    const canEditSelf = isLead && status === "Draft";
    const canEditLeaderFinal = isLead && status === "In Review";
    /**
     * COMENTAR é outra pergunta que pontuar, e por isso tem nome próprio.
     *
     * O servidor exige as duas coisas na mesma guarda: `isLeadOf` (quem não
     * lidera recebe "só quem lidera esta pessoa altera esta avaliação — a
     * autoavaliação é registrada na 1:1") e avaliação não concluída (a
     * concluída está trancada). Usar `canEditLeaderFinal` aqui seria apertado
     * demais — ele só vale em revisão — e usar `isLead` sozinho seria frouxo:
     * ofereceria a caixa numa avaliação trancada.
     */
    const canComment = isLead && !isCompleted;
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
      canOpen,
      canEditSelf,
      canEditLeaderFinal,
      canComment,
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
}
