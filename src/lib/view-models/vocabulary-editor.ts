import type { VocabularyItemInput, VocabularyItemPatch } from "../gateways/config.gateway";
import type { VocabularyItem } from "../vocabularies";

/**
 * CFG-06 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.2) — ViewModels da aba
 * "Vocabulários" de /settings, na régua da casa (payload/validação em
 * classe testável, render na tela; mesmo formato de
 * `OperationalSettingsEditor`/`TextTemplateEditor`).
 *
 * Dois editores porque são dois gestos distintos da aba:
 *
 * - `NewVocabularyCodeEditor`: cadastrar um code NOVO (code + labelKey →
 *   POST). O code é a identidade persistida — imutável depois; o labelKey é
 *   a chave de i18n do rótulo (um code sem mensagem neste build aparece
 *   como o próprio code, honesto e legível).
 * - `VocabularyItemEditor`: editar um item existente (labelKey/sortOrder →
 *   PATCH só do que mudou). `active` NÃO passa por aqui — o toggle da lista
 *   é um PATCH direto de um campo só, sem rascunho.
 *
 * A validação client-side espelha o VO do backend (`DomainVocabulary`):
 * code/labelKey não vazios, sortOrder inteiro. Duplicata (409
 * `DUPLICATE_VOCABULARY_CODE`) é negócio do servidor — a aba mostra o erro
 * em `role="alert"`. Imutáveis de propósito (cada edição devolve um editor
 * novo) — encaixam em `useState` sem `useEffect` de sincronização.
 */
export class NewVocabularyCodeEditor {
  private constructor(
    readonly code: string,
    readonly labelKey: string,
  ) {}

  static empty(): NewVocabularyCodeEditor {
    return new NewVocabularyCodeEditor("", "");
  }

  withCode(code: string): NewVocabularyCodeEditor {
    return new NewVocabularyCodeEditor(code, this.labelKey);
  }

  withLabelKey(labelKey: string): NewVocabularyCodeEditor {
    return new NewVocabularyCodeEditor(this.code, labelKey);
  }

  get isValid(): boolean {
    return this.code.trim().length > 0 && this.labelKey.trim().length > 0;
  }

  /** `null` enquanto inválido; o servidor preenche sortOrder (próximo) e active (true). */
  payload(): { code: string; input: VocabularyItemInput } | null {
    if (!this.isValid) return null;
    return { code: this.code.trim(), input: { labelKey: this.labelKey.trim() } };
  }
}

export class VocabularyItemEditor {
  private constructor(
    private readonly baseline: VocabularyItem,
    readonly labelKey: string,
    /** Rascunho textual do sortOrder (input controlado; inválido fica visível até corrigir). */
    readonly sortOrder: string,
  ) {}

  static from(item: VocabularyItem): VocabularyItemEditor {
    return new VocabularyItemEditor(item, item.labelKey, String(item.sortOrder));
  }

  get code(): string {
    return this.baseline.code;
  }

  withLabelKey(labelKey: string): VocabularyItemEditor {
    return new VocabularyItemEditor(this.baseline, labelKey, this.sortOrder);
  }

  withSortOrder(text: string): VocabularyItemEditor {
    return new VocabularyItemEditor(this.baseline, this.labelKey, text);
  }

  private parsedSortOrder(): number | null {
    if (this.sortOrder.trim().length === 0) return null;
    const value = Number(this.sortOrder);
    return Number.isInteger(value) ? value : null;
  }

  /** Chave i18n do erro de validação client-side, ou `null` quando o rascunho é válido. */
  get errorKey(): "config.vocab.error.labelKey" | "config.vocab.error.sortOrder" | null {
    if (this.labelKey.trim().length === 0) return "config.vocab.error.labelKey";
    if (this.parsedSortOrder() === null) return "config.vocab.error.sortOrder";
    return null;
  }

  get isValid(): boolean {
    return this.errorKey === null;
  }

  /**
   * O PATCH a fazer — só os campos que MUDARAM em relação ao item efetivo;
   * `null` quando o rascunho é inválido; `{}`-vazio nunca sai daqui (o
   * backend recusa patch vazio): quando nada mudou, devolve lista de zero
   * chaves e a tela trata como no-op.
   */
  payload(): VocabularyItemPatch | null {
    const sortOrder = this.parsedSortOrder();
    if (sortOrder === null || !this.isValid) return null;
    const patch: VocabularyItemPatch = {};
    if (this.labelKey.trim() !== this.baseline.labelKey) patch.labelKey = this.labelKey.trim();
    if (sortOrder !== this.baseline.sortOrder) patch.sortOrder = sortOrder;
    return patch;
  }
}
