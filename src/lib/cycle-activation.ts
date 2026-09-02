import type { DevelopmentCycle } from "./domain";

export interface CycleSelectionState {
  cycles: DevelopmentCycle[];
  activeCycleId: string;
}

export class CycleActivation {
  private constructor(private readonly cycleId: string) {}

  static of(cycleId: string): CycleActivation {
    return new CycleActivation(cycleId);
  }

  appliedTo<S extends CycleSelectionState>(state: S): S {
    return {
      ...state,
      activeCycleId: this.cycleId,
      cycles: state.cycles.map((cycle) => this.statusAfterActivation(cycle)),
    };
  }

  private statusAfterActivation(cycle: DevelopmentCycle): DevelopmentCycle {
    if (cycle.id === this.cycleId) return { ...cycle, status: "Active" };
    if (cycle.status === "Active") return { ...cycle, status: "Closed" };
    return cycle;
  }
}
