import { describe, expect, it } from "vitest";

import { ACTION_TYPES, EVIDENCE_TYPES, LEARNING_ITEM_TYPES } from "@/lib/domain";
import {
  DEFAULT_VOCABULARIES,
  Vocabulary,
  VOCABULARY_NAMES,
  VocabularyCatalog,
  type VocabularyItem,
} from "@/lib/vocabularies";

/**
 * CFG-06 — o vocabulário efetivo (servidor com fallback): default
 * byte-idêntico ao seed (que por sua vez espelha os arrays antigos de
 * `domain.ts` — fonte única), fallback POR vocabulário, opções de escrita
 * só com itens ativos por sortOrder, e rótulo labelKey→i18n com fallback
 * para o code.
 */
describe("vocabularies (CFG-06)", () => {
  it("o default espelha os arrays antigos de domain.ts, na mesma ordem (fonte única)", () => {
    expect(DEFAULT_VOCABULARIES.EVIDENCE_TYPE.map((i) => i.code)).toEqual([...EVIDENCE_TYPES]);
    expect(DEFAULT_VOCABULARIES.LEARNING_ITEM_TYPE.map((i) => i.code)).toEqual([
      ...LEARNING_ITEM_TYPES,
    ]);
    expect(DEFAULT_VOCABULARIES.ACTION_TYPE.map((i) => i.code)).toEqual([...ACTION_TYPES]);
  });

  it("o default tem os tamanhos do seed (11/10/6), todos ativos, sortOrder = posição", () => {
    expect(DEFAULT_VOCABULARIES.EVIDENCE_TYPE).toHaveLength(11);
    expect(DEFAULT_VOCABULARIES.LEARNING_ITEM_TYPE).toHaveLength(10);
    expect(DEFAULT_VOCABULARIES.ACTION_TYPE).toHaveLength(6);
    for (const name of VOCABULARY_NAMES) {
      DEFAULT_VOCABULARIES[name].forEach((item, index) => {
        expect(item.vocabulary).toBe(name);
        expect(item.active).toBe(true);
        expect(item.sortOrder).toBe(index + 1);
        expect(item.labelKey.length).toBeGreaterThan(0);
      });
    }
  });

  it("sem resposta carregada, devolve o default inteiro", () => {
    expect(VocabularyCatalog.resolve(undefined)).toEqual(DEFAULT_VOCABULARIES);
  });

  it("fallback é POR vocabulário: lista vazia/ausente cai no default sem invalidar as servidas", () => {
    const served: VocabularyItem[] = [
      {
        vocabulary: "ACTION_TYPE",
        code: "Shadow",
        labelKey: "actionType.shadow",
        sortOrder: 1,
        active: true,
      },
    ];
    const effective = VocabularyCatalog.resolve({ ACTION_TYPE: served, EVIDENCE_TYPE: [] });
    expect(effective.ACTION_TYPE).toEqual(served);
    expect(effective.EVIDENCE_TYPE).toEqual(DEFAULT_VOCABULARIES.EVIDENCE_TYPE);
    expect(effective.LEARNING_ITEM_TYPE).toEqual(DEFAULT_VOCABULARIES.LEARNING_ITEM_TYPE);
  });

  it("opções de escrita: só ativos, ordenados por sortOrder", () => {
    const items: VocabularyItem[] = [
      { vocabulary: "ACTION_TYPE", code: "B", labelKey: "b", sortOrder: 2, active: true },
      { vocabulary: "ACTION_TYPE", code: "C", labelKey: "c", sortOrder: 3, active: false },
      { vocabulary: "ACTION_TYPE", code: "A", labelKey: "a", sortOrder: 1, active: true },
    ];
    expect(Vocabulary.of("ACTION_TYPE", items).activeOptions.map((i) => i.code)).toEqual([
      "A",
      "B",
    ]);
  });

  it("rótulo: labelKey→i18n; sem mensagem cai no code; code fora do catálogo idem", () => {
    const items: VocabularyItem[] = [
      {
        vocabulary: "ACTION_TYPE",
        code: "Learn",
        labelKey: "actionType.learn",
        sortOrder: 1,
        active: true,
      },
      {
        vocabulary: "ACTION_TYPE",
        code: "Shadow",
        labelKey: "actionType.shadow",
        sortOrder: 7,
        active: true,
      },
    ];
    const translate = (labelKey: string) =>
      labelKey === "actionType.learn" ? "Aprender" : undefined;
    const vocabulary = Vocabulary.of("ACTION_TYPE", items);
    expect(vocabulary.labelOf("Learn", translate)).toBe("Aprender");
    expect(vocabulary.labelOf("Shadow", translate)).toBe("Shadow");
    expect(vocabulary.labelOf("Inexistente", translate)).toBe("Inexistente");
  });
});
