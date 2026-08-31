import { ACTION_TYPES, EVIDENCE_TYPES, LEARNING_ITEM_TYPES } from "./domain";

export const VOCABULARY_NAMES = ["EVIDENCE_TYPE", "LEARNING_ITEM_TYPE", "ACTION_TYPE"] as const;
export type VocabularyName = (typeof VOCABULARY_NAMES)[number];

export interface VocabularyItem {
  vocabulary: VocabularyName;

  code: string;

  labelKey: string;
  sortOrder: number;

  active: boolean;
}

export type Vocabularies = Record<VocabularyName, VocabularyItem[]>;

type TranslateLabelKey = (labelKey: string) => string | undefined;

const SEED_LABEL_KEYS: Record<VocabularyName, readonly string[]> = {
  EVIDENCE_TYPE: [
    "evidenceType.architectureDesign",
    "evidenceType.adr",
    "evidenceType.technicalPresentation",
    "evidenceType.workshop",
    "evidenceType.project",
    "evidenceType.certification",
    "evidenceType.course",
    "evidenceType.proofOfConcept",
    "evidenceType.architectureReview",
    "evidenceType.mentoring",
    "evidenceType.technicalArticle",
  ],
  LEARNING_ITEM_TYPE: [
    "learningItemType.curso",
    "learningItemType.video",
    "learningItemType.livro",
    "learningItemType.artigo",
    "learningItemType.laboratorio",
    "learningItemType.desafio",
    "learningItemType.projeto",
    "learningItemType.certificacao",
    "learningItemType.apresentacao",
    "learningItemType.workshop",
  ],
  ACTION_TYPE: [
    "actionType.learn",
    "actionType.practice",
    "actionType.apply",
    "actionType.teach",
    "actionType.mentor",
    "actionType.lead",
  ],
};

const SEED_CODES: Record<VocabularyName, readonly string[]> = {
  EVIDENCE_TYPE: EVIDENCE_TYPES,
  LEARNING_ITEM_TYPE: LEARNING_ITEM_TYPES,
  ACTION_TYPE: ACTION_TYPES,
};

export class Vocabulary {
  private constructor(
    readonly name: VocabularyName,
    readonly items: VocabularyItem[],
  ) {}

  static of(name: VocabularyName, items: VocabularyItem[]): Vocabulary {
    return new Vocabulary(name, items);
  }

  static seeded(name: VocabularyName): Vocabulary {
    const labelKeys = SEED_LABEL_KEYS[name];
    return Vocabulary.of(
      name,
      SEED_CODES[name].flatMap((code, index) => {
        const labelKey = labelKeys[index];
        return labelKey === undefined
          ? []
          : [{ vocabulary: name, code, labelKey, sortOrder: index + 1, active: true }];
      }),
    );
  }

  get activeOptions(): VocabularyItem[] {
    return this.items
      .filter((item) => item.active)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  }

  labelOf(code: string, translate: TranslateLabelKey): string {
    const item = this.items.find((candidate) => candidate.code === code);
    if (!item) return code;
    return translate(item.labelKey) ?? code;
  }
}

export class VocabularyCatalog {
  private constructor(readonly vocabularies: Vocabularies) {}

  static over(vocabularies: Vocabularies): VocabularyCatalog {
    return new VocabularyCatalog(vocabularies);
  }

  static get seeded(): VocabularyCatalog {
    return VocabularyCatalog.over(
      Object.fromEntries(
        VOCABULARY_NAMES.map((name) => [name, Vocabulary.seeded(name).items]),
      ) as Vocabularies,
    );
  }

  static resolve(loaded?: Partial<Vocabularies>): Vocabularies {
    if (!loaded) return DEFAULT_VOCABULARIES;
    return Object.fromEntries(
      VOCABULARY_NAMES.map((name) => {
        const items = loaded[name];
        return [name, items && items.length > 0 ? items : DEFAULT_VOCABULARIES[name]];
      }),
    ) as Vocabularies;
  }

  static fromLoaded(loaded?: Partial<Vocabularies>): VocabularyCatalog {
    return VocabularyCatalog.over(VocabularyCatalog.resolve(loaded));
  }

  named(name: VocabularyName): Vocabulary {
    return Vocabulary.of(name, this.vocabularies[name]);
  }
}

export const DEFAULT_VOCABULARIES: Vocabularies = VocabularyCatalog.seeded.vocabularies;
