export interface CurationPolicy {
  maxActiveCompetencies: number;
  requiredRestrictive: number;
  requiredNonRestrictive: number;
}

export class EffectiveCurationPolicy {
  static readonly defaults: CurationPolicy = {
    maxActiveCompetencies: 6,
    requiredRestrictive: 3,
    requiredNonRestrictive: 3,
  };

  static resolve(loaded?: CurationPolicy): CurationPolicy {
    return loaded ?? EffectiveCurationPolicy.defaults;
  }
}
