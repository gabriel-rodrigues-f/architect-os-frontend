import type { CurationPolicy } from "../curation-policy";

export type CurationPolicyField = keyof CurationPolicy;

export const CURATION_POLICY_FIELDS: readonly CurationPolicyField[] = ["maxActiveCompetencies"];

export class CurationPolicyEditor {
  private constructor(readonly drafts: Readonly<Record<CurationPolicyField, string>>) {}

  static from(policy: CurationPolicy): CurationPolicyEditor {
    return new CurationPolicyEditor({
      maxActiveCompetencies: String(policy.maxActiveCompetencies),
    });
  }

  withField(field: CurationPolicyField, text: string): CurationPolicyEditor {
    return new CurationPolicyEditor({ ...this.drafts, [field]: text });
  }

  private parsed(): CurationPolicy | null {
    const text = this.drafts.maxActiveCompetencies;
    if (text.trim().length === 0) return null;
    const value = Number(text);
    if (!Number.isInteger(value)) return null;
    return { maxActiveCompetencies: value };
  }

  get errorKey(): "config.curation.error.number" | null {
    const values = this.parsed();
    if (values === null || values.maxActiveCompetencies <= 0) {
      return "config.curation.error.number";
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
