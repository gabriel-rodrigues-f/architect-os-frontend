import type { Evidence, EvidenceType } from "../domain";
import type { Api } from "../store";

/**
 * OO3-10c (Fase OO-3) — ViewModel da tela de perfil do arquiteto
 * (`routes/architects.$architectId.index.tsx`, ~886 linhas), no mesmo
 * formato enxuto de `DevelopmentPlansViewModel`/`LearningPathsViewModel`:
 * classe sem estado, UM `service` narrow no construtor (derivado de `Api`
 * via `Pick`, OO3-10a), SEM `UiAuthorizationPolicy` — as duas checagens da
 * tela (`canActFor` para registrar/reenviar, `isLeadOf` para revisar) são
 * booleans derivados de `user`/`architect` já resolvidos inline na rota,
 * sem lógica nova (mesmo critério documentado em
 * `learning-paths-view-model.ts` para `canEdit`/`canEditProgress`).
 *
 * Escopo: os três comandos de Evidência da tela — registrar
 * (`EvidenceDialog`), reenviar depois de "Precisa de melhoria"
 * (`ResubmitEvidenceDialog`, ENT-EVD-002) e revisar
 * (`EvidenceReviewDialog`) — com a montagem de payload/validação movida
 * para cá. Ficam de fora, deliberadamente — mesma régua de
 * `learning-paths-view-model.ts` (só regra de negócio/orquestração entra no
 * ViewModel, derivação de exibição fica na tela):
 *  - As derivações de render do componente (`computeNextSteps`,
 *    `assessmentHistory`, médias/coberturas, filtros de sessões/evidências
 *    por arquiteto) — inventário calculado para RENDERIZAR, não ação de
 *    negócio.
 *  - O estado dos três diálogos (`open`, rascunhos dos campos, `saving`) e
 *    a decisão de toast/fechar — orquestração de UI, mesmo contrato de
 *    `TeamViewModel.submit`.
 *
 * As três chamadas são sem otimismo de propósito (IDOR-001/EPIC L,
 * ENT-EVD-002): o servidor gera o id e confirma a decisão; o erro sobe para
 * o diálogo decidir a mensagem.
 */

/** Fatia de `useStore()` que os comandos de Evidência precisam — derivada de `Api` via `Pick` (OO3-10a). */
export type ArchitectProfileService = Pick<
  Api,
  "addEvidence" | "resubmitEvidence" | "reviewEvidence"
>;

/** Rascunho do `EvidenceDialog` — os campos exatamente como a pessoa digitou; o corte de espaços e as chaves condicionais são responsabilidade de `registerEvidence`. */
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

  /**
   * Sem id local nem sucesso otimista: o servidor gera o id de verdade
   * (IDOR-001) e é quem decide se o registro vale. Sem competência escolhida
   * na tela (`competencyIds: []`): se ligada a um item do PDI, o servidor
   * herda a competência do item automaticamente (EPIC 2). `issuer` só entra
   * para certificação — nos outros tipos a chave nem vai no corpo, como
   * antes; `project`/`url` idem quando vazios.
   */
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

  /**
   * ENT-EVD-002 — reenvio depois de "Precisa de melhoria": só os campos que
   * de fato mudaram entram no patch (campo igual ao atual nem vai no corpo,
   * como antes); a evidência volta para "Pendente" no servidor.
   */
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

  /**
   * Revisão é decisão do Tech Lead — `Pending` não é uma decisão de revisão
   * (ENT-EVD-001/002), por isso o tipo já exclui o estado inicial. Comentário
   * vazio nem entra no corpo.
   */
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
