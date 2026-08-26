import { describe, expect, it } from "vitest";

import { NewVocabularyCodeEditor, VocabularyItemEditor } from "@/lib/view-models/vocabulary-editor";
import type { VocabularyItem } from "@/lib/vocabularies";

const item: VocabularyItem = {
  vocabulary: "EVIDENCE_TYPE",
  code: "Certification",
  labelKey: "evidenceType.certification",
  sortOrder: 6,
  active: true,
};

/** CFG-06 — ViewModels da aba "Vocabulários": validação client-side e payload só do que mudou. */
describe("NewVocabularyCodeEditor (CFG-06)", () => {
  it("vazio é inválido; code + labelKey preenchidos viram payload com trim", () => {
    const empty = NewVocabularyCodeEditor.empty();
    expect(empty.isValid).toBe(false);
    expect(empty.payload()).toBeNull();

    const filled = empty.withCode("  Patente ").withLabelKey(" evidenceType.patente ");
    expect(filled.isValid).toBe(true);
    expect(filled.payload()).toEqual({
      code: "Patente",
      input: { labelKey: "evidenceType.patente" },
    });
  });

  it("só code ou só labelKey continua inválido", () => {
    expect(NewVocabularyCodeEditor.empty().withCode("X").isValid).toBe(false);
    expect(NewVocabularyCodeEditor.empty().withLabelKey("k").isValid).toBe(false);
  });
});

describe("VocabularyItemEditor (CFG-06)", () => {
  it("nasce do item efetivo e sem mudanças devolve patch vazio (no-op)", () => {
    const editor = VocabularyItemEditor.from(item);
    expect(editor.code).toBe("Certification");
    expect(editor.isValid).toBe(true);
    expect(editor.payload()).toEqual({});
  });

  it("payload só carrega o que mudou", () => {
    const editor = VocabularyItemEditor.from(item).withLabelKey("evidenceType.cert");
    expect(editor.payload()).toEqual({ labelKey: "evidenceType.cert" });

    const reordered = VocabularyItemEditor.from(item).withSortOrder("2");
    expect(reordered.payload()).toEqual({ sortOrder: 2 });
  });

  it("labelKey vazio e sortOrder não-inteiro são inválidos, com chave de erro própria", () => {
    const semLabel = VocabularyItemEditor.from(item).withLabelKey("  ");
    expect(semLabel.errorKey).toBe("config.vocab.error.labelKey");
    expect(semLabel.payload()).toBeNull();

    const sortQuebrado = VocabularyItemEditor.from(item).withSortOrder("1.5");
    expect(sortQuebrado.errorKey).toBe("config.vocab.error.sortOrder");
    expect(sortQuebrado.payload()).toBeNull();
  });
});
