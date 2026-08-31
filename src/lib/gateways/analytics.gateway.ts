import { gapClosureExplanationResponseSchema, gapClosureResponseSchema } from "../api-schemas";
import type { ApiClient } from "../api-client";
import type { DataOrigin, OriginatedData } from "./data-origin";

export type GapMovementKind = "CLOSED" | "REDUCED" | "INCREASED" | "OPENED" | "DROPPED" | "STABLE";

export interface GapMovement {
  kind: GapMovementKind;
  pairCount: number;
  amount: number;
}

export interface GapCycleTotal {
  cycleId: string;
  cycleName: string;
  totalGap: number;
  pairCount: number;
}

export interface GapClosureWaterfall {
  from: GapCycleTotal;
  to: GapCycleTotal;
  movements: GapMovement[];
}

export interface GapClosureVelocity {
  fromCycleId: string;
  toCycleId: string;
  gapsOpenAtStart: number;
  gapsClosed: number;
  gapsOpened: number;
  netClosed: number;
  closureRate: number | null;
  elapsedDays: number;
  closedPerDay: number | null;
}

export interface GapClosure extends OriginatedData {
  waterfall: GapClosureWaterfall | null;
  velocity: GapClosureVelocity | null;
}

export interface GapClosureExplanation {
  subject: string;
  text: string;
}

export interface GapClosureScope {
  cycleId?: string;
  capabilityIds?: string[];
}

export interface AnalyticsGateway {
  readonly dataOrigin: DataOrigin;
  gapClosure(scope: GapClosureScope): Promise<GapClosure>;
  explainGapClosure(scope: GapClosureScope): Promise<GapClosureExplanation>;
}

export class HttpAnalyticsGateway implements AnalyticsGateway {
  readonly dataOrigin: DataOrigin = "organization";

  constructor(private readonly client: ApiClient) {}

  gapClosure = (scope: GapClosureScope): Promise<GapClosure> =>
    this.client
      .post<unknown>("/analytics/gap-closure", scope)
      .then((data) => ({ ...gapClosureResponseSchema.parse(data), dataOrigin: this.dataOrigin }));

  explainGapClosure = (scope: GapClosureScope): Promise<GapClosureExplanation> =>
    this.client
      .post<unknown>("/analytics/gap-closure/explanation", scope)
      .then((data) => gapClosureExplanationResponseSchema.parse(data));
}
