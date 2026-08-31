import type { TeamLevelRule } from "../domain";

export type ProgressionMinimumReading =
  | { readonly kind: "absent" }
  | { readonly kind: "agreed"; readonly minimum: number }
  | {
      readonly kind: "divergent";
      readonly lowest: number;
      readonly highest: number;
      readonly listed: string;
    };

export class ProgressionMinimumPresenter {
  private readonly rules: readonly TeamLevelRule[];

  private constructor(rules: readonly TeamLevelRule[]) {
    this.rules = rules;
  }

  static forCareerLevel(
    teamLevelRules: readonly TeamLevelRule[],
    careerLevelId: string,
  ): ProgressionMinimumPresenter {
    return new ProgressionMinimumPresenter(
      teamLevelRules.filter((rule) => rule.careerLevelId === careerLevelId),
    );
  }

  get reading(): ProgressionMinimumReading {
    const [lowest, ...rest] = this.minimums;
    if (lowest === undefined) return { kind: "absent" };
    const highest = rest[rest.length - 1];
    if (highest === undefined) return { kind: "agreed", minimum: lowest };
    return {
      kind: "divergent",
      lowest,
      highest,
      listed: this.minimums.join(" · "),
    };
  }

  get agreedMinimum(): number | undefined {
    const reading = this.reading;
    return reading.kind === "agreed" ? reading.minimum : undefined;
  }

  get soleTeamRule(): TeamLevelRule | undefined {
    return this.rules.length === 1 ? this.rules[0] : undefined;
  }

  get configuredByEachTeam(): boolean {
    return this.rules.length > 1;
  }

  unreachableMinimum(readyCapabilities: number): number | undefined {
    const reading = this.reading;
    const highest =
      reading.kind === "absent"
        ? undefined
        : reading.kind === "agreed"
          ? reading.minimum
          : reading.highest;
    return highest !== undefined && highest > readyCapabilities ? highest : undefined;
  }

  private get minimums(): number[] {
    return [...new Set(this.rules.map((rule) => rule.minimumQualifiedCapabilities))].sort(
      (first, second) => first - second,
    );
  }
}
