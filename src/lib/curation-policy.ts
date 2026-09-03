export interface CurationPolicy {
  maxActiveCompetencies: number;
}

export class EffectiveCurationPolicy {
  static readonly defaults: CurationPolicy = {
    maxActiveCompetencies: 4,
  };

  static resolve(loaded?: CurationPolicy): CurationPolicy {
    return loaded ?? EffectiveCurationPolicy.defaults;
  }
}
