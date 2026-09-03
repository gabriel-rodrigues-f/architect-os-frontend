export interface CurationPolicy {
  maxActiveCompetencies: number;
}

export class CompetencyCountRange {
  static readonly MINIMUM_ACTIVE_COMPETENCIES = 3;

  private constructor(
    readonly min: number,
    readonly max: number,
  ) {}

  static of(policy: CurationPolicy): CompetencyCountRange {
    return new CompetencyCountRange(
      CompetencyCountRange.MINIMUM_ACTIVE_COMPETENCIES,
      policy.maxActiveCompetencies,
    );
  }

  admits(count: number): boolean {
    return count >= this.min && count <= this.max;
  }

  missingToMinimum(count: number): number {
    return Math.max(0, this.min - count);
  }

  aboveMaximum(count: number): number {
    return Math.max(0, count - this.max);
  }

  atCapacity(count: number): boolean {
    return count >= this.max;
  }
}

export class EffectiveCurationPolicy {
  static readonly defaults: CurationPolicy = {
    maxActiveCompetencies: 6,
  };

  static resolve(loaded?: CurationPolicy): CurationPolicy {
    return loaded ?? EffectiveCurationPolicy.defaults;
  }
}
