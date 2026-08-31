import type { MessageKey } from "../i18n";
import type {
  GapClosure,
  GapClosureVelocity,
  GapClosureWaterfall,
  GapMovement,
  GapMovementKind,
} from "../gateways/analytics.gateway";

export interface GapMovementRow {
  kind: GapMovementKind;
  labelKey: MessageKey;
  pairCount: number;
  amount: number;
}

export class GapClosureViewModel {
  private static readonly MOVEMENT_LABEL: Readonly<Record<GapMovementKind, MessageKey>> = {
    CLOSED: "gapClosure.movement.closed",
    REDUCED: "gapClosure.movement.reduced",
    INCREASED: "gapClosure.movement.increased",
    OPENED: "gapClosure.movement.opened",
    DROPPED: "gapClosure.movement.dropped",
    STABLE: "gapClosure.movement.stable",
  };

  comparable(closure: GapClosure): closure is GapClosure & {
    waterfall: GapClosureWaterfall;
    velocity: GapClosureVelocity;
  } {
    return closure.waterfall !== null && closure.velocity !== null;
  }

  movements(waterfall: GapClosureWaterfall): GapMovementRow[] {
    return waterfall.movements
      .filter((movement) => movement.pairCount > 0)
      .map((movement) => this.row(movement));
  }

  closureRatePercent(velocity: GapClosureVelocity): number | null {
    return velocity.closureRate === null ? null : Math.round(velocity.closureRate * 100);
  }

  private row(movement: GapMovement): GapMovementRow {
    return {
      kind: movement.kind,
      labelKey: GapClosureViewModel.MOVEMENT_LABEL[movement.kind],
      pairCount: movement.pairCount,
      amount: movement.amount,
    };
  }
}
