import type { Competency } from "../domain";

export type CapabilitySelectionState = "none" | "some" | "all";

export class CompetencySelection {
  private constructor(private readonly chosen: ReadonlySet<string>) {}

  static empty(): CompetencySelection {
    return new CompetencySelection(new Set());
  }

  get count(): number {
    return this.chosen.size;
  }

  get isEmpty(): boolean {
    return this.chosen.size === 0;
  }

  get ids(): string[] {
    return [...this.chosen];
  }

  has(competencyId: string): boolean {
    return this.chosen.has(competencyId);
  }

  toggle(competencyId: string): CompetencySelection {
    const next = new Set(this.chosen);
    if (next.has(competencyId)) next.delete(competencyId);
    else next.add(competencyId);
    return new CompetencySelection(next);
  }

  toggleCapability(capabilityId: string, competencies: readonly Competency[]): CompetencySelection {
    const members = CompetencySelection.activeOf(capabilityId, competencies);
    const next = new Set(this.chosen);
    if (this.capabilityState(capabilityId, competencies) === "all") {
      for (const member of members) next.delete(member.id);
    } else {
      for (const member of members) next.add(member.id);
    }
    return new CompetencySelection(next);
  }

  capabilityState(
    capabilityId: string,
    competencies: readonly Competency[],
  ): CapabilitySelectionState {
    const members = CompetencySelection.activeOf(capabilityId, competencies);
    if (members.length === 0) return "none";
    const marked = members.filter((member) => this.chosen.has(member.id)).length;
    if (marked === 0) return "none";
    return marked === members.length ? "all" : "some";
  }

  capabilityCheckbox(
    capabilityId: string,
    competencies: readonly Competency[],
  ): boolean | "indeterminate" {
    const state = this.capabilityState(capabilityId, competencies);
    if (state === "all") return true;
    return state === "some" ? "indeterminate" : false;
  }

  chosenFrom(competencies: readonly Competency[]): Competency[] {
    return competencies.filter((competency) => this.chosen.has(competency.id));
  }

  private static activeOf(capabilityId: string, competencies: readonly Competency[]): Competency[] {
    return competencies.filter(
      (competency) => competency.capabilityId === capabilityId && competency.active,
    );
  }
}
