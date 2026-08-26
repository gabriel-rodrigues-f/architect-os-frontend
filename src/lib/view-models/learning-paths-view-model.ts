import type { SessionUser } from "../api";
import type {
  Architect,
  LearningItemProgress,
  LearningItemType,
  LearningPath,
  LearningPathItem,
} from "../domain";
import type { Api } from "../store";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — sexto ViewModel de tela desta fase, mesmo formato enxuto
 * de `DevelopmentPlansViewModel`: só `service` no construtor, SEM
 * `UiAuthorizationPolicy`. Diferente de `TeamViewModel`/
 * `CompetencyMatrixViewModel` (que injetam a política para expor
 * `isAdmin`), as três checagens de autorização desta tela —
 * `canCreatePath` (`isLeadCapable(user.role)`), `canEdit` (espelha
 * `canEditPath` do backend: admin, autor por `createdByUserId`, ou
 * Lead/Admin quando a trilha é legada sem autor) e `canEditProgress`
 * (`canActFor`, já um método de `UiAuthorizationPolicy` via `scope.ts`) —
 * continuam booleans derivados de `path`/`user`/`architectId` já resolvidos
 * inline em `learning-paths.tsx`, sem lógica NOVA que justifique sair do
 * componente: exatamente a mesma categoria que o docstring de
 * `DevelopmentPlansViewModel` já documenta para `canApprovePlan` etc. Trazer
 * uma política pra cá só para `canEdit`/`canEditProgress` delegarem 1:1 pra
 * ela infligiria uma dependência que nenhum método deste ViewModel usa.
 *
 * Confirmado por leitura direta de `backend/src/modules/learning-paths/`
 * (não alterado nesta PR): `canEditPath` (autor ou admin, trilha sem autor
 * cai para Lead/Admin) e o `canActFor` do PATCH de progresso são a ÚNICA
 * autorização real deste agregado — o controller nunca expõe nenhuma regra
 * cross-aggregate nova (tipo o limite de 6/3+3 de `CompetencyMatrixViewModel`)
 * para o front precisar espelhar; a checagem extra do servidor no PATCH de
 * progresso ("pessoa precisa estar em `assignedTo`", "item precisa existir")
 * nunca é alcançável pela UI por construção — o slider só existe para
 * `path.assignedTo` × `path.items` já carregados, nunca para um par
 * inventado — então não há nada de novo para prever aqui.
 *
 * Escopo desta PR: os comandos de escrita da trilha (`LearningPage`,
 * `CreatePathDialog`, `EditPathDialog`, `LearningPathItemRow`) — criar,
 * renomear/redescrever, (des)marcar competência, (des)atribuir pessoa,
 * adicionar/editar/remover item, excluir a trilha inteira, e registrar
 * progresso — mais a regra "quem pode ser atribuído" (`assignableArchitects`,
 * espelha o mesmo raciocínio de `swapCandidates` em
 * `CompetencyMatrixViewModel`: filtro de elegibilidade, não autorização).
 * Ficam de fora, deliberadamente — mesma entanglement com o ciclo de render
 * do React já documentada nos cinco ViewModels anteriores:
 *  - Busca (`search`) e expandir/recolher card (`expandedIds`) em
 *    `LearningPage` — mesma categoria de `curationFilter`/`expandedIds` em
 *    `competency-matrix-view-model.ts`.
 *  - `editingPath`/`creatingPath` (qual diálogo está aberto) e `saving`
 *    (flag de "ocupado" do `CreatePathDialog`, só desabilita botão enquanto
 *    a Promise de `createPath` está em voo) — mesmo contrato de `saving` em
 *    `CompetencyMatrixViewModel`.
 *  - `newItem`/`competencyFilter` (rascunho do formulário de novo item e
 *    filtro local de competências acima de 20) em `EditPathDialog`/
 *    `CreatePathDialog` — rascunho de formulário, não ação de negócio.
 *  - `draft` em `ProgressControl` e `titleDraft`/`hoursDraft` em
 *    `LearningPathItemRow` (B-33, AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-
 *    08-22.md, §12.4) — estado local que só existe para o feedback
 *    instantâneo do arrasto/digitação antes do commit (`onMouseUp`/
 *    `onTouchEnd`/`onKeyUp`/`onBlur`); o PATCH em si já é `recordProgress`/
 *    `updateItem` abaixo.
 */

/**
 * Fatia de `useStore()` que esta tela precisa. OO3-10 — derivada de `Api`
 * (`store.tsx`, agora exportada) via `Pick`, em vez de recopiar as
 * assinaturas à mão: qualquer divergência vira erro de compilação, e
 * `useStore()` satisfaz a forma estruturalmente.
 */
export type LearningPathService = Pick<
  Api,
  | "addLearningPath"
  | "updateLearningPath"
  | "removeLearningPath"
  | "addLearningPathItem"
  | "removeLearningPathItem"
  | "updateLearningItemProgress"
>;

export class LearningPathsViewModel {
  constructor(private readonly service: LearningPathService) {}

  /**
   * OO3-11l — progresso de uma pessoa num item: `{status:"Not Started",
   * progress:0}` se ainda não tocou (movido de `domain.progressFor`).
   */
  progressFor(
    path: Pick<LearningPath, "progress">,
    architectId: string,
    itemId: string,
  ): LearningItemProgress {
    return (
      path.progress.find((p) => p.architectId === architectId && p.itemId === itemId) ?? {
        architectId,
        itemId,
        status: "Not Started",
        progress: 0,
      }
    );
  }

  /** Média CRUA (sem arredondar) dos itens para uma pessoa — 0 para trilha sem item, nunca NaN. */
  private personProgress(
    path: Pick<LearningPath, "progress" | "items">,
    architectId: string,
  ): number {
    const values = path.items.map((item) => this.progressFor(path, architectId, item.id).progress);
    return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  }

  /** OO3-11l/D-4 — percentual de UMA pessoa na trilha (Perfil); arredonda só no nível externo, como o original. */
  progressPercentFor(path: Pick<LearningPath, "progress" | "items">, architectId: string): number {
    return Math.round(this.personProgress(path, architectId));
  }

  /**
   * OO3-11l/D-4 — percentual do card da trilha: média entre as pessoas
   * atribuídas, cada uma com a própria média entre os itens (médias por
   * pessoa CRUAS; `Math.round` só no total, preservando o cálculo original).
   * 0 para trilha sem pessoa atribuída — nunca NaN.
   */
  teamProgressPercent(path: Pick<LearningPath, "progress" | "items" | "assignedTo">): number {
    const perPerson = path.assignedTo.map((architectId) => this.personProgress(path, architectId));
    return perPerson.length
      ? Math.round(perPerson.reduce((s, v) => s + v, 0) / perPerson.length)
      : 0;
  }

  /**
   * Sem otimismo (mesmo contrato de `TeamViewModel.submit`/
   * `CompetencyMatrixViewModel.createCapability`): id sempre vazio — o
   * servidor gera o de verdade, nunca aceita o do cliente (IDOR-001, ver
   * `LearningPathService.create` no backend). Trilha nasce sem itens e sem
   * progresso; autoria (`createdBy`/`createdByUserId`) vem da sessão atual,
   * nunca de texto digitado. Não decide toast nem fecha diálogo — isso é
   * orquestração de UI, fica em `CreatePathDialog`.
   */
  createPath(
    user: Pick<SessionUser, "email" | "id">,
    form: { name: string; description: string },
    competencyIds: string[],
    assignedTo: string[],
  ): Promise<LearningPath> {
    return this.service.addLearningPath({
      id: "",
      name: form.name.trim(),
      description: form.description.trim(),
      competencyIds,
      assignedTo,
      items: [],
      progress: [],
      createdBy: user.email,
      createdByUserId: user.id,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Nome nunca salva em branco — cai para o nome atual quando o rascunho vem
   * só de espaço (mesmo fallback que já existia inline em `saveDetails`).
   * Descrição não é cortada aqui de propósito — comportamento idêntico ao
   * que já existia (diferente de `createPath`, que corta; zero mudança de
   * comportamento nesta extração).
   */
  updateDetails(
    path: Pick<LearningPath, "id" | "name">,
    form: { name: string; description: string },
  ): void {
    this.service.updateLearningPath(path.id, {
      name: form.name.trim() || path.name,
      description: form.description,
    });
  }

  /** (Des)marca uma competência do catálogo desta trilha — tag de assunto, não autorização. */
  toggleCompetency(path: Pick<LearningPath, "id" | "competencyIds">, competencyId: string): void {
    const current = path.competencyIds;
    this.service.updateLearningPath(path.id, {
      competencyIds: current.includes(competencyId)
        ? current.filter((id) => id !== competencyId)
        : [...current, competencyId],
    });
  }

  /** (Des)atribui esta trilha a uma pessoa. */
  toggleAssignment(path: Pick<LearningPath, "id" | "assignedTo">, architectId: string): void {
    const current = path.assignedTo;
    this.service.updateLearningPath(path.id, {
      assignedTo: current.includes(architectId)
        ? current.filter((id) => id !== architectId)
        : [...current, architectId],
    });
  }

  /**
   * AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC E —
   * atribuir trilha nova é para o time atual (só arquiteto ativo vira opção
   * NOVA); quem já saiu mas já estava atribuído antes continua na lista,
   * senão a atribuição existente ficaria invisível, sem jeito de desmarcar.
   * `CreatePathDialog` chama com `alreadyAssignedIds: []` (nada persistido
   * ainda, equivalente ao filtro só por `active` que já existia ali).
   */
  assignableArchitects(
    architects: readonly Architect[],
    alreadyAssignedIds: readonly string[],
  ): Architect[] {
    return architects.filter((a) => a.active || alreadyAssignedIds.includes(a.id));
  }

  /**
   * Item nasce com id gerado no cliente (`lpi-${Date.now()}`) — diferente da
   * trilha em si (`createPath`, id vazio pro servidor gerar): padrão já
   * existente deste sub-recurso antes desta extração, preservado tal como
   * estava (zero mudança de comportamento). Hora sem preenchimento válido
   * cai para 1 (mesmo fallback que já existia inline em `addItem`).
   */
  addItem(pathId: string, title: string, type: LearningItemType, hours: string): void {
    this.service.addLearningPathItem(pathId, {
      id: `lpi-${Date.now()}`,
      title: title.trim(),
      type,
      hours: Number(hours) || 1,
    });
  }

  /**
   * B-33 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §12.4) — reúne
   * os três call sites que recomputavam `items` inteiro (tipo, título,
   * horas) espalhados em `EditPathDialog`, um por campo. `type` é imediato
   * (`<select>` sem flooding); título e horas continuam com draft/blur em
   * `LearningPathItemRow` — o commit em si é o mesmo método aqui.
   */
  updateItem(
    path: Pick<LearningPath, "id" | "items">,
    itemId: string,
    patch: Partial<Pick<LearningPathItem, "type" | "title" | "hours">>,
  ): void {
    this.service.updateLearningPath(path.id, {
      items: path.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  }

  /** Tira o item da trilha — sem retorno, mesmo contrato de `removeLearningPathItem` no `store`. */
  removeItem(pathId: string, itemId: string): void {
    this.service.removeLearningPathItem(pathId, itemId);
  }

  /** Exclui a trilha inteira do catálogo — não decide toast nem fecha diálogo, mesma orquestração de UI de `createPath`. */
  removePath(pathId: string): void {
    this.service.removeLearningPath(pathId);
  }

  /**
   * Progresso é por pessoa (não da trilha): a entrada de
   * `(architectId, itemId)` muda sozinha — mesmo contrato de
   * `updateLearningItemProgress` no `store`. Chamado só no `onCommit` do
   * slider (soltar o arrasto ou ajustar por teclado), nunca a cada passo —
   * isso é UI, fica em `ProgressControl`.
   */
  recordProgress(pathId: string, architectId: string, itemId: string, progress: number): void {
    this.service.updateLearningItemProgress(pathId, architectId, itemId, progress);
  }
}
