import type { CurationPolicy } from "../curation-policy";

/** Os três campos editáveis — mesmos nomes do payload do PUT. */
export type CurationPolicyField = keyof CurationPolicy;

export const CURATION_POLICY_FIELDS: readonly CurationPolicyField[] = [
  "maxActiveCompetencies",
  "requiredRestrictive",
  "requiredNonRestrictive",
];

/**
 * CFG-04 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.2) — ViewModel do editor da
 * política de curadoria do catálogo na aba "Catálogo" de /settings. Segue a
 * régua da casa (payload/validação em classe testável, render na tela;
 * mesmo formato de `ScoringBandsEditor`/`TextTemplateEditor`): a tela só
 * liga inputs a `withField` e botões a `payload()`.
 *
 * A validação client-side espelha o VO do backend
 * (`CatalogCurationPolicy.create`): inteiros, máximo positivo, contagens
 * não negativas e soma que fecha
 * (`requiredRestrictive + requiredNonRestrictive = maxActiveCompetencies` —
 * senão READY fica inalcançável ou ambíguo). O 400
 * `INVALID_CATALOG_CURATION_POLICY` do backend continua a autoridade final.
 *
 * Imutável de propósito (cada edição devolve um editor novo) — encaixa em
 * `useState` sem `useEffect` de sincronização.
 */
export class CurationPolicyEditor {
  private constructor(
    /** Rascunho textual de cada campo (o input é controlado; vazio/não-número fica visível até corrigir). */
    readonly drafts: Readonly<Record<CurationPolicyField, string>>,
  ) {}

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

  /** Chave i18n do erro de validação client-side, ou `null` quando o rascunho é válido. */
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

  /** O corpo do `PUT /api/config/curation-policy`; `null` quando o rascunho é inválido. */
  payload(): CurationPolicy | null {
    return this.isValid ? this.parsed() : null;
  }
}
