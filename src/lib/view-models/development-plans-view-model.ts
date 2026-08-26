import type { ActionType, DevelopmentPlan, PdiStatus, SmartGoal } from "../domain";
import type { Gap } from "../selectors";
import type { Api } from "../store";
import { createPlanItemFromGap } from "./plan-item-from-gap";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 60) — segundo ViewModel de tela desta fase, no mesmo formato do
 * exemplo LITERAL da seção (`DevelopmentPlansViewModel` com `approve()`,
 * `reopen(reason)`, `get suggestions()`).
 *
 * Escopo desta PR: só o ciclo de vida do PLANO (`PlansPage` em
 * `routes/development-plans.tsx`, ~1200 linhas no total) — aprovar,
 * devolver a rascunho, concluir, reabrir, e a lista de sugestões de PDI a
 * partir de gaps. Ficam de fora, deliberadamente: os ~10 subcomponentes de
 * item (`ActionPlanField`, `DeadlineField`, `ItemHistory`,
 * `RescheduleDialog`, `CheckinTimeline`, `NewPlanItemDialog`,
 * `SmartGoalEditor`, `ReopenPlanDialog`), porque cada um tem o próprio
 * `useState` de rascunho/diálogo cujo motivo de existir é o ciclo de
 * render do React (draft de textarea que só salva no blur, diálogo que
 * abre/fecha, "salvo" que pisca e some em 2s) — mover isso para uma classe
 * comum inventaria um mecanismo de observação que o código não tem hoje,
 * a mesma entanglement documentada em `team-view-model.ts` para
 * `useTeamRoster`. As permissões (`canApprovePlan` etc., calculadas com
 * `UiAuthorizationPolicy` via `scope.ts`) também ficam na rota: são
 * booleans derivados de `plan`/`user`/`architect` já resolvidos ali, sem
 * lógica extra que justifique sair do componente.
 *
 * OO3-10b (Fase OO-3) — os NOVE comandos de item que ainda chamavam
 * `useStore()` direto da tela entraram aqui: as cinco variações de
 * `updatePlanItem` (tipo de ação, status, plano de ação, prazo em rascunho,
 * meta SMART), remover item, reprogramar prazo, check-in e criar item a
 * partir de gap (montagem de payload no colaborador compartilhado
 * `plan-item-from-gap.ts`, reusado por `MentoringViewModel.sendToPlan`).
 * Os subcomponentes continuam donos do próprio estado de UI (drafts,
 * diálogos, flags de "ocupado") — o contrato segue o dos métodos acima: o
 * ViewModel monta o payload e delega ao serviço; o erro sobe para quem
 * chama decidir banner/toast.
 */

/**
 * Fatia de `useStore()` que este ViewModel precisa. OO3-10 — derivada de
 * `Api` (`store.tsx`, agora exportada) via `Pick`, em vez de recopiar as
 * assinaturas à mão: qualquer divergência vira erro de compilação.
 */
export type DevelopmentPlanService = Pick<
  Api,
  | "updatePlanStatus"
  | "reopenPlan"
  | "updatePlanItem"
  | "removePlanItem"
  | "reschedulePlanItem"
  | "addPlanItemCheckin"
  | "createPlanItemFromGap"
>;

/** Campos que a pessoa escolhe no diálogo de novo item (`NewPlanItemDialog`) — o resto do envelope é derivado em `createItemFromGap`. */
export interface NewPlanItemDraft {
  actionType: ActionType;
  actionPlan: string;
  targetDate: string;
  dedicationHoursPerWeek: number | null;
}

export class DevelopmentPlansViewModel {
  constructor(private readonly service: DevelopmentPlanService) {}

  async approve(planId: string): Promise<DevelopmentPlan> {
    return this.service.updatePlanStatus(planId, "Approved");
  }

  async complete(planId: string): Promise<DevelopmentPlan> {
    return this.service.updatePlanStatus(planId, "Completed");
  }

  async returnToDraft(planId: string): Promise<DevelopmentPlan> {
    return this.service.updatePlanStatus(planId, "Draft");
  }

  /**
   * ENT-PDI-001 — reabertura de PDI concluído, motivo obrigatório (validado
   * por quem chama, igual antes: o botão de confirmar já nasce desabilitado
   * sem motivo).
   */
  async reopen(planId: string, reason: string): Promise<DevelopmentPlan> {
    return this.service.reopenPlan(planId, reason);
  }

  /**
   * ORIENTACAO-NONA-RODADA, Seção 5/11 (ENT-09-006) — de um conjunto de gaps
   * de progressão JÁ positivos (`gap > 0`, filtro que continua na rota
   * porque `gaps` também alimenta `creatingForGap`, fora do escopo deste
   * ViewModel), exclui o que já virou item do plano e limita a 5 — mesma
   * composição de antes, só nomeada.
   */
  suggestions(positiveGaps: readonly Gap[], plan: DevelopmentPlan | undefined): Gap[] {
    return positiveGaps
      .filter((g) => !plan?.items.some((i) => i.competencyId === g.item.competencyId))
      .slice(0, 5);
  }

  // ---- Comandos de item (OO3-10b) ----

  /** Campo diagnóstico — a tela só oferece o `<select>` quando o plano ainda está em `Draft` (`canEditDiagnostic`). */
  setItemActionType(planId: string, itemId: string, actionType: ActionType): void {
    this.service.updatePlanItem(planId, itemId, { actionType });
  }

  /** Campo de execução — aberto até `Completed` (`canEditExecution`); o backend trava o resto (DOM-001). */
  setItemStatus(planId: string, itemId: string, status: PdiStatus): void {
    this.service.updatePlanItem(planId, itemId, { status });
  }

  /** Campo de execução — o draft/blur que decide QUANDO salvar fica em `ActionPlanField`; o commit é este. */
  saveActionPlan(planId: string, itemId: string, actionPlan: string): void {
    this.service.updatePlanItem(planId, itemId, { actionPlan });
  }

  /**
   * ORIENTACAO-NONA-RODADA, Seção 7/14 (GES-007/ENT-09-010) — prazo por
   * PATCH genérico só em `Draft`; depois de `Approved` o backend recusa o
   * campo e o único caminho é `reschedule` abaixo.
   */
  setItemTargetDate(planId: string, itemId: string, targetDate: string): void {
    this.service.updatePlanItem(planId, itemId, { targetDate });
  }

  /** A meta SMART é escrita campo a campo pela pessoa (`SmartGoalEditor`); aqui só o commit do objeto completo. */
  defineSmartGoal(planId: string, itemId: string, smart: SmartGoal): void {
    this.service.updatePlanItem(planId, itemId, { smart });
  }

  /** Tira o item do PDI — a lacuna dele volta a aparecer como sugestão. Só em `Draft` (`canEditDiagnostic`). */
  removeItem(planId: string, itemId: string): void {
    this.service.removePlanItem(planId, itemId);
  }

  /**
   * Seção 14 (ENT-09-010) — comando dedicado depois de `Approved`, motivo
   * obrigatório (o botão de confirmar já nasce desabilitado sem motivo; o
   * corte de espaços do motivo acontece aqui, não em quem chama). Sem
   * otimismo — o erro (409 de versão, 400 sem motivo) sobe para o diálogo.
   */
  reschedule(
    planId: string,
    itemId: string,
    targetDate: string,
    reason: string,
  ): Promise<DevelopmentPlan> {
    return this.service.reschedulePlanItem(planId, itemId, targetDate, reason.trim());
  }

  /**
   * FASE 2 (quinta rodada) — check-in registra o processo, sem mudar campo
   * nenhum do item. Autor e data são do servidor, nunca do cliente; o texto
   * vai sem espaços nas pontas (quem chama já bloqueia texto vazio).
   */
  addCheckin(planId: string, itemId: string, text: string): Promise<DevelopmentPlan> {
    return this.service.addPlanItemCheckin(planId, itemId, text.trim());
  }

  /**
   * ORIENTACAO-NONA-RODADA, Seção 4/11 (ENT-09-001/006) — único caminho para
   * criar item de PDI a partir de GAP: `currentLevel`/`targetLevel`/
   * `priority` nunca são enviados, o servidor deriva os três do assessment
   * oficial (`assessmentId` + `competencyId`). O envelope invariante (id de
   * cliente, `startDate`) mora no colaborador compartilhado com
   * `MentoringViewModel.sendToPlan` (`plan-item-from-gap.ts`); o objetivo em
   * pt-BR desta tela ("Evoluir X do nível A para o nível B") é montado aqui.
   */
  createItemFromGap(
    architectId: string,
    gap: Gap,
    draft: NewPlanItemDraft,
    ownerName: string,
  ): Promise<DevelopmentPlan> {
    return createPlanItemFromGap(this.service, architectId, {
      assessmentId: gap.assessmentId,
      competencyId: gap.item.competencyId,
      objective: `Evoluir ${gap.competency?.name} do nível ${gap.item.final} para o nível ${gap.item.target}`,
      actionType: draft.actionType,
      actionPlan: draft.actionPlan,
      targetDate: draft.targetDate,
      owner: ownerName,
      dedicationHoursPerWeek: draft.dedicationHoursPerWeek,
    });
  }
}
