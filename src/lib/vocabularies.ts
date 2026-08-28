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

const seed = (
  vocabulary: VocabularyName,
  entries: readonly (readonly [code: string, labelKey: string])[],
): VocabularyItem[] =>
  entries.map(([code, labelKey], index) => ({
    vocabulary,
    code,
    labelKey,
    sortOrder: index + 1,
    active: true,
  }));

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

export const DEFAULT_VOCABULARIES: Vocabularies = Object.fromEntries(
  VOCABULARY_NAMES.map((name) => [
    name,
    seed(
      name,
      SEED_CODES[name].flatMap((code, index) => {
        const labelKey = SEED_LABEL_KEYS[name][index];
        return labelKey === undefined ? [] : [[code, labelKey] as const];
      }),
    ),
  ]),
) as Vocabularies;

export function withDefaultVocabularies(loaded?: Partial<Vocabularies>): Vocabularies {
  if (!loaded) return DEFAULT_VOCABULARIES;
  return Object.fromEntries(
    VOCABULARY_NAMES.map((name) => {
      const items = loaded[name];
      return [name, items && items.length > 0 ? items : DEFAULT_VOCABULARIES[name]];
    }),
  ) as Vocabularies;
}

export function activeVocabularyOptions(items: readonly VocabularyItem[]): VocabularyItem[] {
  return items
    .filter((item) => item.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

type TranslateLabelKey = (labelKey: string) => string | undefined;

export function vocabularyLabelOf(
  items: readonly VocabularyItem[],
  code: string,
  translate: TranslateLabelKey,
): string {
  const item = items.find((candidate) => candidate.code === code);
  if (!item) return code;
  return translate(item.labelKey) ?? code;
}
