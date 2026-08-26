export interface CurationPolicy {
  maxActiveCompetencies: number;
  requiredRestrictive: number;
  requiredNonRestrictive: number;
}

export const DEFAULT_CURATION_POLICY: CurationPolicy = {
  maxActiveCompetencies: 6,
  requiredRestrictive: 3,
  requiredNonRestrictive: 3,
};

export const withDefaultCurationPolicy = (loaded?: CurationPolicy): CurationPolicy =>
  loaded ?? DEFAULT_CURATION_POLICY;
