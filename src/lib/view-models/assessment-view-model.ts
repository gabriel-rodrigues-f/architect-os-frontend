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

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — quarto ViewModel de tela desta fase e o primeiro com DUAS
 * fontes narrow no construtor, não uma só. `assessments-shared.tsx` mistura
 * duas famílias de ação:
 *
 * 1. Nota por competência (self/leader/final) e comentários passam por
 *    `store.tsx` (`useStore()`), que já resolve cache otimista/concorrência
 *    de versão (B-09/B-18) — mesmo raciocínio do `TeamViewModel`: um
 *    ViewModel que bypassasse `store` para isto duplicaria a semântica de
 *    cache que `store.tsx` já resolve.
 * 2. Portfólio de capacidades de carreira e o resumo de desenvolvimento
 *    ("Começar/Parar/Continuar") NUNCA passaram por `store` — vivem atrás
 *    da própria `useQuery` (`assessment-eligibility`/`assessment-
 *    development-summary`), de propósito fora do cache de `STATE_QUERY_KEY`
 *    (só `invalidateAll()` toca as duas). Estas chamam `api` diretamente
 *    hoje, sem nenhuma camada de cache no meio.
 *
 * Fingir que é tudo "um serviço só" inventaria uma camada de cache que não
 * existe para o grupo 2, ou faria o ViewModel bypassar o cache que já
 * existe para o grupo 1 — as duas armadilhas que este brief pede para não
 * mascarar. Por isso o construtor recebe duas interfaces narrow
 * (`AssessmentItemService`, satisfeita diretamente por `store`;
 * `AssessmentPortfolioService`, satisfeita diretamente por `api`), cada uma
 * só com o que o respectivo grupo precisa — TypeScript valida
 * estruturalmente, sem adaptador nenhum na hora de montar (ver
 * `assessments-shared.tsx`, `useAssessmentViewModel`).
 *
 * Escopo desta PR: os quatro grupos de ação do arquivo (~1290 linhas) —
 * nota por competência, comentários, portfólio de capacidades, resumo de
 * desenvolvimento — e o cômputo de permissões que já existia como
 * `useAssessmentPermissions`. Ficam de fora, deliberadamente, os
 * subcomponentes cujo estado é genuinamente de UI/render: `CommentSection`/
 * `CommentForm` (qual comentário está em edição, diálogo de confirmação de
 * exclusão, rascunho do textarea antes de salvar), `DevelopmentSummaryForm`
 * (rascunho local de startDoing/stopDoing/continueDoing, `saveState` que
 * pisca "salvo" e some, bandeira de conflito), e os `useState` de
 * `CareerPortfolioSection` (`busy`, `actionError`, `pendingRemoval`,
 * `selectedCapabilityId`) — mesma entanglement com o ciclo de render do
 * React documentada em `team-view-model.ts` para `useTeamRoster` e em
 * `development-plans-view-model.ts` para os subcomponentes de item de PDI.
 * A decisão de o QUE fazer com o erro (abrir diálogo de confirmação, mostrar
 * banner, toast) também fica nesses componentes — o ViewModel só faz a
 * chamada de negócio, nunca decide UI (mesmo contrato de
 * `TeamViewModel.submit`).
 */

/**
 * Fatia de `useStore()` que a nota por competência e os comentários
 * precisam. OO3-10 — derivada de `Api` (`store.tsx`, agora exportada) via
 * `Pick`, em vez de recopiar as assinaturas à mão: qualquer divergência
 * vira erro de compilação, e `useStore()` satisfaz a forma estruturalmente.
 */
export type AssessmentItemService = Pick<
  Api,
  | "updateAssessmentItem"
  | "addAssessmentComment"
  | "updateAssessmentComment"
  | "removeAssessmentComment"
>;

/**
 * Fatia da fachada `api` (não de `store`) que o portfólio de capacidades e o
 * resumo de desenvolvimento precisam — ver docstring da classe para o
 * porquê de não passar por `store` aqui. OO3-10 — derivada de `typeof api`
 * (a fonte real destas chamadas) via `Pick`, mesmo racional da derivação de
 * `AssessmentItemService` sobre `Api`.
 */
export type AssessmentPortfolioService = Pick<
  typeof api,
  | "addAssessmentCapability"
  | "removeAssessmentCapability"
  | "confirmAssessmentCapability"
  | "updateAssessmentDevelopmentSummary"
>;

/** Forma que `useAssessmentPermissions` já devolvia — só o cômputo mudou de lugar. */
export interface AssessmentPermissions {
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

  /**
   * Espelha `checkAssessmentWrite` do backend exatamente: dono primeiro
   * (`isOwner`), e `isLead` só considera o vínculo real
   * (`architect.leadUserId`) — nunca só o papel da conta — e é mutuamente
   * exclusivo com `isOwner`. Cada campo só abre na etapa certa do lifecycle
   * (autoavaliação fecha assim que vai para revisão; líder/final só abrem
   * quando a revisão já começou). Ver PLANO-360-AGENTES-SYNAPSE.md, Seção 9,
   * UX-001, AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, e
   * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 2-4. Espelha também a
   * completude que o backend exige na transição (DOM-002): `incompleteSelf`/
   * `incompleteLeaderFinal` são o que desabilita o botão de Enviar/Concluir
   * com explicação, em vez de deixar tentar e descobrir pelo erro do
   * servidor.
   */
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
    /** Só o Tech Lead reabre — devolve a `In Review` para corrigir e concluir de novo. */
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

  /**
   * As três notas nunca chegam juntas num único PATCH nesta tela (cada
   * `LevelSelect` só existe quando `permissionsFor(...).canEditSelf`/
   * `canEditLeaderFinal` já autoriza aquele campo específico) — nomear as
   * três operações em vez de expor um `updateItem(patch)` genérico deixa
   * explícita a regra de escrita por papel (self = dono em Draft,
   * leader/final = Tech Lead em In Review) sem duplicar a checagem em si,
   * que continua só decidindo o que RENDERIZA. Mesmo `store.updateAssessment
   * Item` de antes por baixo (cache otimista + concorrência de versão já
   * resolvidos lá, B-09/B-18).
   */
  updateSelfScore(assessmentId: string, competencyId: string, level: Level): void {
    this.items.updateAssessmentItem(assessmentId, competencyId, { self: level });
  }

  updateLeaderScore(assessmentId: string, competencyId: string, level: Level): void {
    this.items.updateAssessmentItem(assessmentId, competencyId, { leader: level });
  }

  updateFinalScore(assessmentId: string, competencyId: string, level: Level): void {
    this.items.updateAssessmentItem(assessmentId, competencyId, { final: level });
  }

  /**
   * Comentário pertence a quem escreveu — só o autor edita ou exclui a
   * própria fala (checagem de "é meu?" continua em `CommentSection`, que já
   * tem `currentUserId`). Sem otimismo: id e data de salvamento nascem no
   * servidor. Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 5.
   */
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

  /**
   * ENT-CAR-014/015/016 — "Profissional propõe" (só `Draft`, checado por
   * quem chama via `permissionsFor`/`assessment.status`, não repetido
   * aqui). Sem tratamento de erro: quem chama decide (banner de
   * `actionError`), mesmo contrato de `TeamViewModel.submit`.
   */
  proposeCapability(assessmentId: string, capabilityId: string): Promise<AssessmentCapability> {
    return this.portfolio.addAssessmentCapability(assessmentId, capabilityId);
  }

  /** ENT-CAR-014 — "Tech Lead confirma" (só `In Review`, checado por quem chama). */
  confirmCapability(assessmentId: string, capabilityId: string): Promise<AssessmentCapability> {
    return this.portfolio.confirmAssessmentCapability(assessmentId, capabilityId);
  }

  /**
   * ORIENTACAO-NONA-RODADA, Seção 8, problema 3 / B-16 (AUDITORIA-FINAL-
   * ENTERPRISE-SYNAPSE-2026-08-22.md, §26) — sem `force`, o backend recusa
   * com 409 (`PORTFOLIO_HAS_ANSWERED_ITEMS`) quando a capacidade já tem
   * competência respondida. Decidir SE esse 409 específico abre o diálogo
   * de confirmação (em vez de cair no banner de erro genérico) é orquestração
   * de UI — continua em `CareerPortfolioSection.attemptRemove`, que já reage
   * por `error.code`, não por `status` genérico. Este método só faz a
   * chamada, com ou sem `force`.
   */
  removeCapability(assessmentId: string, capabilityId: string, force = false): Promise<void> {
    return this.portfolio.removeAssessmentCapability(assessmentId, capabilityId, force);
  }

  /**
   * Problema 1 (ORIENTACAO-NONA-RODADA, Seção 8) — só capacidade `READY`
   * (curadoria completa) entra na lista de "propor"; o backend já recusa o
   * resto, mas oferecer a opção aqui só para devolver erro depois é a
   * experiência ruim que a Seção 8 aponta. Mesma composição de antes
   * (`CareerPortfolioSection`), só nomeada — igual
   * `DevelopmentPlansViewModel.suggestions`.
   */
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

  /**
   * ESPECIFICACAO-OITAVA-RODADA, Seção 18 / ORIENTACAO-NONA-RODADA
   * ENT-09-011 — "Começar/Parar/Continuar". `expectedVersion` é a mesma
   * concorrência otimista de `updatePlanStatus`/`patchAssessmentItem`
   * (B-09/B-18): decidir o que fazer com um 409 (banner de conflito +
   * "Carregar versão mais recente") continua em `DevelopmentSummaryForm`,
   * que já reage a `error.status`. Este método só faz a chamada.
   */
  updateDevelopmentSummary(
    assessmentId: string,
    fields: Pick<AssessmentDevelopmentSummary, "startDoing" | "stopDoing" | "continueDoing">,
    expectedVersion: number,
  ): Promise<AssessmentDevelopmentSummary> {
    return this.portfolio.updateAssessmentDevelopmentSummary(assessmentId, fields, expectedVersion);
  }
}
