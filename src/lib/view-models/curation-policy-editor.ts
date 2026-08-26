import type { CurationPolicy } from "../curation-policy";

export type CurationPolicyField = keyof CurationPolicy;

export const CURATION_POLICY_FIELDS: readonly CurationPolicyField[] = [
  "maxActiveCompetencies",
  "requiredRestrictive",
  "requiredNonRestrictive",
];

export class CurationPolicyEditor {
  private constructor(readonly drafts: Readonly<Record<CurationPolicyField, string>>) {}

  static from(policy: CurationPolicy): CurationPolicyEditor {
    return new CurationPolicyEditor({
      maxActiveCompetencies: String(policy.maxActiveCompetencies),
      requiredRestrictive: String(policy.requiredRestrictive),
      requiredNonRestrictive: String(policy.requiredNonRestrictive),
    });
  }

  withField(field: CurationPolicyField, text: string): CurationPolicyEditor {
    return new CurationPolicyEditor({ ...this.drafts, [field]: text });
  }

  private parsed(): CurationPolicy | null {
    const values = {} as Record<CurationPolicyField, number>;
    for (const field of CURATION_POLICY_FIELDS) {
      const text = this.drafts[field];
      if (text.trim().length === 0) return null;
      const value = Number(text);
      if (!Number.isInteger(value)) return null;
      values[field] = value;
    }
    return values;
  }

  get errorKey(): "config.curation.error.number" | "config.curation.error.sum" | null {
    const values = this.parsed();
    if (
      values === null ||
      values.maxActiveCompetencies <= 0 ||
      values.requiredRestrictive < 0 ||
      values.requiredNonRestrictive < 0
    ) {
      return "config.curation.error.number";
    }
    if (
      values.requiredRestrictive + values.requiredNonRestrictive !==
      values.maxActiveCompetencies
    ) {
      return "config.curation.error.sum";
    }
    return null;
  }

  get isValid(): boolean {
    return this.errorKey === null;
  }

  payload(): CurationPolicy | null {
    return this.isValid ? this.parsed() : null;
  }
}
