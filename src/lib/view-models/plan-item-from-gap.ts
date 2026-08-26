import type { DevelopmentPlan, DevelopmentPlanItem } from "../domain";
import type { Api } from "../store";
import { defaultDateFormatter } from "../text";

/**
 * OO3-10b (Fase OO-3) — colaborador compartilhado entre
 * `MentoringViewModel.sendToPlan` e
 * `DevelopmentPlansViewModel.createItemFromGap`: os dois montavam o MESMO
 * envelope do único caminho de criação de item de PDI a partir de um GAP
 * oficial (ORIENTACAO-NONA-RODADA, Seção 4/11/12, ENT-09-001/006) — id de
 * cliente `pdi-${architectId}-${competencyId}-${Date.now()}` (padrão
 * pré-existente deste sub-recurso, preservado byte a byte), `startDate` de
 * hoje, e a delegação para `createPlanItemFromGap` (sem otimismo: o
 * servidor deriva `currentLevel`/`targetLevel`/`priority` do assessment
 * referenciado e pode recusar — o erro sobe para quem chama). O que varia
 * entre as duas telas (objetivo, tipo de ação, plano, prazo, dedicação)
 * entra pelo `draft`; o que é invariante do envelope mora aqui, uma vez só.
 */

/** Fatia de `useStore()` que a montagem do envelope precisa — derivada de `Api` via `Pick` (OO3-10a). */
export type PlanItemFromGapService = Pick<Api, "createPlanItemFromGap">;

export interface PlanItemFromGapDraft {
  assessmentId: string;
  competencyId: string;
  objective: string;
  actionType: DevelopmentPlanItem["actionType"];
  actionPlan: string;
  targetDate: string;
  owner: string;
  /**
   * Só a tela de PDI coleta dedicação — quando ausente (mentoria), a chave
   * nem entra no corpo, exatamente como antes da extração; quando presente
   * (inclusive `null`, "campo deixado em branco"), vai como veio.
   */
  dedicationHoursPerWeek?: number | null;
}

export function createPlanItemFromGap(
  service: PlanItemFromGapService,
  architectId: string,
  draft: PlanItemFromGapDraft,
): Promise<DevelopmentPlan> {
  return service.createPlanItemFromGap(architectId, {
    id: `pdi-${architectId}-${draft.competencyId}-${Date.now()}`,
    assessmentId: draft.assessmentId,
    competencyId: draft.competencyId,
    objective: draft.objective,
    actionType: draft.actionType,
    actionPlan: draft.actionPlan,
    startDate: defaultDateFormatter.todayIso(),
    targetDate: draft.targetDate,
    owner: draft.owner,
    ...(draft.dedicationHoursPerWeek !== undefined
      ? { dedicationHoursPerWeek: draft.dedicationHoursPerWeek }
      : {}),
  });
}
