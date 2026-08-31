import { TextTemplate, TEXT_TEMPLATE_VARIABLES, type TextTemplateKey } from "../text-templates";

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

  get allowedVariables(): readonly string[] {
    return TEXT_TEMPLATE_VARIABLES[this.key];
  }

  get unknownVariables(): string[] {
    return TextTemplate.of(this.draft).variableNames.filter(
      (name) => !this.allowedVariables.includes(name),
    );
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

  preview(sampleVariables: Record<string, string | number>): string {
    return TextTemplate.of(this.draft).render(sampleVariables);
  }
}
