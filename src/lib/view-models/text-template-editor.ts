import {
  renderTemplate,
  templateVariablesIn,
  TEXT_TEMPLATE_VARIABLES,
  type TextTemplateKey,
} from "../text-templates";

/**
 * CFG-03 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.2) — ViewModel do editor de UM
 * template de texto (key + locale) na aba "Textos" de /settings. Mesma
 * régua do `ScoringBandsEditor` (CFG-02): payload/validação em classe
 * testável, render na tela — a tela só liga o textarea a `withDraft`,
 * mostra `preview()` e envia `draft` quando `isValid`.
 *
 * A validação client-side espelha o VO do backend (`TextTemplate.create`):
 * template não-vazio e referenciando só variáveis que a key fornece
 * (`TEXT_TEMPLATE_VARIABLES`). O backend continua a autoridade final (400
 * `INVALID_TEXT_TEMPLATE` / 404 key desconhecida). Imutável de propósito —
 * encaixa em `useState` sem `useEffect` de sincronização.
 */
export class TextTemplateEditor {
  private constructor(
    readonly key: TextTemplateKey,
    readonly locale: string,
    readonly original: string,
    readonly draft: string,
  ) {}

  static from(key: TextTemplateKey, locale: string, current: string): TextTemplateEditor {
    return new TextTemplateEditor(key, locale, current, current);
  }

  withDraft(text: string): TextTemplateEditor {
    return new TextTemplateEditor(this.key, this.locale, this.original, text);
  }

  /** As variáveis que a key FORNECE — a lista que a tela exibe ao admin. */
  get allowedVariables(): readonly string[] {
    return TEXT_TEMPLATE_VARIABLES[this.key];
  }

  /** Variáveis referenciadas no rascunho que a key NÃO fornece (ficariam literais para sempre). */
  get unknownVariables(): string[] {
    return templateVariablesIn(this.draft).filter((name) => !this.allowedVariables.includes(name));
  }

  get isEmpty(): boolean {
    return this.draft.trim().length === 0;
  }

  get isValid(): boolean {
    return !this.isEmpty && this.unknownVariables.length === 0;
  }

  get isDirty(): boolean {
    return this.draft !== this.original;
  }

  /** O rascunho interpolado com valores de exemplo — o preview da tela (mesmo interpolador do app). */
  preview(sampleVariables: Record<string, string | number>): string {
    return renderTemplate(this.draft, sampleVariables);
  }
}
