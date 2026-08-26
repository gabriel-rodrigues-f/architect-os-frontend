import type { DevelopmentPlan } from "../domain";
import type { Gap } from "../selectors";
import type { Api } from "../store";

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
 */

/**
 * Fatia de `useStore()` que este ViewModel precisa. OO3-10 — derivada de
 * `Api` (`store.tsx`, agora exportada) via `Pick`, em vez de recopiar as
 * assinaturas à mão: qualquer divergência vira erro de compilação.
 */
export type DevelopmentPlanService = Pick<Api, "updatePlanStatus" | "reopenPlan">;

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
}
