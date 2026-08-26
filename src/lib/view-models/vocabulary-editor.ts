import type { VocabularyItemInput, VocabularyItemPatch } from "../gateways/config.gateway";
import type { VocabularyItem } from "../vocabularies";

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

  payload(): { code: string; input: VocabularyItemInput } | null {
    if (!this.isValid) return null;
    return { code: this.code.trim(), input: { labelKey: this.labelKey.trim() } };
  }
}

export class VocabularyItemEditor {
  private constructor(
    private readonly baseline: VocabularyItem,
    readonly labelKey: string,

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

  get errorKey(): "config.vocab.error.labelKey" | "config.vocab.error.sortOrder" | null {
    if (this.labelKey.trim().length === 0) return "config.vocab.error.labelKey";
    if (this.parsedSortOrder() === null) return "config.vocab.error.sortOrder";
    return null;
  }

  get isValid(): boolean {
    return this.errorKey === null;
  }

  payload(): VocabularyItemPatch | null {
    const sortOrder = this.parsedSortOrder();
    if (sortOrder === null || !this.isValid) return null;
    const patch: VocabularyItemPatch = {};
    if (this.labelKey.trim() !== this.baseline.labelKey) patch.labelKey = this.labelKey.trim();
    if (sortOrder !== this.baseline.sortOrder) patch.sortOrder = sortOrder;
    return patch;
  }
}
