import type {
  ActionType,
  DevelopmentPlan,
  DevelopmentPlanEvent,
  DevelopmentPlanItem,
  DevelopmentPlanItemEvent,
} from "../domain";
import type { ApiClient } from "../api-client";

/**
 * OO-FE-02 — gateway do contexto "desenvolvimento" (PDI). Ver
 * `cycles.gateway.ts` para a explicação do padrão interface + `Http*` e do
 * porquê dos métodos serem arrow functions de campo (spread-safe na
 * fachada `api.ts`).
 */
export interface DevelopmentGateway {
  addPlanItem(
    architectId: string,
    cycleId: string,
    item: DevelopmentPlanItem,
  ): Promise<DevelopmentPlan>;
  createPlanItemFromGap(
    architectId: string,
    item: {
      id: string;
      assessmentId: string;
      competencyId: string;
      objective: string;
      actionType: ActionType;
      actionPlan: string;
      startDate: string;
      targetDate: string;
      owner: string;
      dedicationHoursPerWeek?: number | null;
    },
  ): Promise<DevelopmentPlan>;
  patchPlanItem(
    planId: string,
    itemId: string,
    body: Partial<
      Omit<
        DevelopmentPlanItem,
        "version" | "currentLevel" | "targetLevel" | "priority" | "sourceAssessmentId"
      >
    >,
    expectedVersion: number,
  ): Promise<DevelopmentPlan>;
  removePlanItem(planId: string, itemId: string): Promise<void>;
  updatePlanStatus(
    planId: string,
    status: DevelopmentPlan["status"],
    expectedVersion: number,
  ): Promise<DevelopmentPlan>;
  reopenPlan(planId: string, reason: string, expectedVersion: number): Promise<DevelopmentPlan>;
  planEvents(planId: string): Promise<DevelopmentPlanEvent[]>;
  addPlanItemCheckin(planId: string, itemId: string, text: string): Promise<DevelopmentPlan>;
  reschedulePlanItem(
    planId: string,
    itemId: string,
    targetDate: string,
    reason: string,
    expectedVersion: number,
  ): Promise<DevelopmentPlan>;
  planItemEvents(planId: string, itemId: string): Promise<DevelopmentPlanItemEvent[]>;
}

export class HttpDevelopmentGateway implements DevelopmentGateway {
  constructor(private readonly client: ApiClient) {}

  addPlanItem = (
    architectId: string,
    cycleId: string,
    item: DevelopmentPlanItem,
  ): Promise<DevelopmentPlan> =>
    this.client.post<DevelopmentPlan>(`/api/plans/${architectId}/items`, { cycleId, item });

  /**
   * ESPECIFICACAO-OITAVA-RODADA, Seção 15/25/28/34 — criação source-driven:
   * o cliente referencia o gap (assessment + competência); o servidor
   * deriva `currentLevel`/`targetLevel`/`priority` a partir do assessment
   * oficial. Nunca aceitar esses três do cliente aqui — não é só
   * convenção, o schema do backend nem tem esses campos.
   */
  createPlanItemFromGap = (
    architectId: string,
    item: {
      id: string;
      assessmentId: string;
      competencyId: string;
      objective: string;
      actionType: ActionType;
      actionPlan: string;
      startDate: string;
      targetDate: string;
      owner: string;
      dedicationHoursPerWeek?: number | null;
    },
  ): Promise<DevelopmentPlan> =>
    this.client.post<DevelopmentPlan>(`/api/plans/${architectId}/items/from-gap`, item);

  /**
   * `expectedVersion` sustenta concorrência otimista (ENT-DATA-012) —
   * sempre a versão do item já lido. `currentLevel`/`targetLevel`/
   * `priority`/`sourceAssessmentId` ficam de fora do tipo: são derivados
   * na criação (`createPlanItemFromGap`) e o backend nem aceita PATCH
   * neles (Seção 15/28) — o tipo aqui só espelha o que a rota de fato
   * recebe, para não sugerir uma escrita que sempre seria ignorada.
   */
  patchPlanItem = (
    planId: string,
    itemId: string,
    body: Partial<
      Omit<
        DevelopmentPlanItem,
        "version" | "currentLevel" | "targetLevel" | "priority" | "sourceAssessmentId"
      >
    >,
    expectedVersion: number,
  ): Promise<DevelopmentPlan> =>
    this.client.patch<DevelopmentPlan>(`/api/plans/${planId}/items/${itemId}`, {
      ...body,
      expectedVersion,
    });

  removePlanItem = (planId: string, itemId: string): Promise<void> =>
    this.client.del<void>(`/api/plans/${planId}/items/${itemId}`);

  updatePlanStatus = (
    planId: string,
    status: DevelopmentPlan["status"],
    expectedVersion: number,
  ): Promise<DevelopmentPlan> =>
    this.client.patch<DevelopmentPlan>(`/api/plans/${planId}/status`, { status, expectedVersion });

  /**
   * Reabertura de PDI concluído (ENT-PDI-001) — comando dedicado, não um
   * PATCH de status: exige motivo, e só o Tech Lead responsável.
   */
  reopenPlan = (
    planId: string,
    reason: string,
    expectedVersion: number,
  ): Promise<DevelopmentPlan> =>
    this.client.post<DevelopmentPlan>(`/api/plans/${planId}/reopen`, { reason, expectedVersion });

  planEvents = (planId: string): Promise<DevelopmentPlanEvent[]> =>
    this.client.request<DevelopmentPlanEvent[]>(`/api/plans/${planId}/events`);

  addPlanItemCheckin = (planId: string, itemId: string, text: string): Promise<DevelopmentPlan> =>
    this.client.post<DevelopmentPlan>(`/api/plans/${planId}/items/${itemId}/checkins`, { text });

  /**
   * Seção 17 — reprogramar prazo depois de `Approved` (quando o PATCH
   * genérico já bloqueia `targetDate`) é um comando dedicado: motivo
   * obrigatório, `expectedVersion` sustenta a mesma concorrência otimista
   * do resto do PDI.
   */
  reschedulePlanItem = (
    planId: string,
    itemId: string,
    targetDate: string,
    reason: string,
    expectedVersion: number,
  ): Promise<DevelopmentPlan> =>
    this.client.post<DevelopmentPlan>(`/api/plans/${planId}/items/${itemId}/reschedule`, {
      targetDate,
      reason,
      expectedVersion,
    });

  /** Histórico append-only de reprogramações de um item — prazos anteriores, com motivo. */
  planItemEvents = (planId: string, itemId: string): Promise<DevelopmentPlanItemEvent[]> =>
    this.client.request<DevelopmentPlanItemEvent[]>(`/api/plans/${planId}/items/${itemId}/events`);
}
