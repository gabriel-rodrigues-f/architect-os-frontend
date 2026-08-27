import type {
  ActionType,
  DevelopmentPlan,
  DevelopmentPlanEvent,
  DevelopmentPlanItem,
  DevelopmentPlanItemEvent,
} from "../domain";
import type { ApiClient } from "../api-client";

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
    this.client.post<DevelopmentPlan>(`/plans/${architectId}/items`, { cycleId, item });

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
    this.client.post<DevelopmentPlan>(`/plans/${architectId}/items/from-gap`, item);

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
    this.client.patch<DevelopmentPlan>(`/plans/${planId}/items/${itemId}`, {
      ...body,
      expectedVersion,
    });

  removePlanItem = (planId: string, itemId: string): Promise<void> =>
    this.client.del<void>(`/plans/${planId}/items/${itemId}`);

  updatePlanStatus = (
    planId: string,
    status: DevelopmentPlan["status"],
    expectedVersion: number,
  ): Promise<DevelopmentPlan> =>
    this.client.patch<DevelopmentPlan>(`/plans/${planId}/status`, { status, expectedVersion });

  reopenPlan = (
    planId: string,
    reason: string,
    expectedVersion: number,
  ): Promise<DevelopmentPlan> =>
    this.client.post<DevelopmentPlan>(`/plans/${planId}/reopen`, { reason, expectedVersion });

  planEvents = (planId: string): Promise<DevelopmentPlanEvent[]> =>
    this.client.request<DevelopmentPlanEvent[]>(`/plans/${planId}/events`);

  addPlanItemCheckin = (planId: string, itemId: string, text: string): Promise<DevelopmentPlan> =>
    this.client.post<DevelopmentPlan>(`/plans/${planId}/items/${itemId}/checkins`, { text });

  reschedulePlanItem = (
    planId: string,
    itemId: string,
    targetDate: string,
    reason: string,
    expectedVersion: number,
  ): Promise<DevelopmentPlan> =>
    this.client.post<DevelopmentPlan>(`/plans/${planId}/items/${itemId}/reschedule`, {
      targetDate,
      reason,
      expectedVersion,
    });

  planItemEvents = (planId: string, itemId: string): Promise<DevelopmentPlanItemEvent[]> =>
    this.client.request<DevelopmentPlanItemEvent[]>(`/plans/${planId}/items/${itemId}/events`);
}
