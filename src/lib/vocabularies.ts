import { ACTION_TYPES, EVIDENCE_TYPES, LEARNING_ITEM_TYPES } from "./domain";

/**
 * CFG-06 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.1 tabela 3 / A7, A8, A9) — os
 * vocabulários de domínio (tipos de evidência, tipos de item de trilha e
 * tipos de ação do PDI) deixaram de ser arrays fixos no código: a
 * autoridade é a tabela `domain_vocabularies` do backend, servida por
 * `GET /api/config/vocabularies` (`ConfigGateway.vocabularies`). Este
 * módulo é o lado do frontend dessa fatia, no MESMO formato de
 * `operational-settings.ts` (CFG-05):
 *
 * - o TIPO espelha o domínio do backend
 *   (`backend/src/modules/config/domain/domain-vocabularies.ts`);
 * - `DEFAULT_VOCABULARIES` é o ÚNICO lugar onde os arrays antigos
 *   sobrevivem como itens completos (code + labelKey), byte-idêntico ao
 *   seed da migration do backend — os codes derivam dos arrays de
 *   `domain.ts` (`EVIDENCE_TYPES`/`LEARNING_ITEM_TYPES`/`ACTION_TYPES`),
 *   que agora são só espelho do seed, nunca mais fonte direta de UI;
 * - quem quer o vocabulário EFETIVO (servidor com fallback) usa
 *   `useVocabularies` (`store.tsx`).
 *
 * O front nunca REVALIDA os itens contra regra de negócio (duplicata,
 * labelKey vazio etc. são o VO `DomainVocabulary` do backend); aqui só se
 * decide, vocabulário a vocabulário, se o que veio é utilizável — lista
 * ausente/vazia cai no default daquele vocabulário, nunca derruba a tela.
 */

/** Espelho de `VOCABULARY_NAMES` do backend — o conjunto de vocabulários É modelo. */
export const VOCABULARY_NAMES = ["EVIDENCE_TYPE", "LEARNING_ITEM_TYPE", "ACTION_TYPE"] as const;
export type VocabularyName = (typeof VOCABULARY_NAMES)[number];

/** Uma linha do vocabulário — o shape exato de `DomainVocabularyItem` do backend. */
export interface VocabularyItem {
  vocabulary: VocabularyName;
  /** Valor canônico PERSISTIDO nas entidades — nunca muda depois de usado. */
  code: string;
  /** Chave de i18n deste frontend (ex.: `evidenceType.certification`) — o label nunca é persistido. */
  labelKey: string;
  sortOrder: number;
  /** Desativar em vez de deletar: histórico que referencia o code continua legível. */
  active: boolean;
}

/** O shape de `GET /api/config/vocabularies` — `grouped()` do backend. */
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

/** labelKey de cada code do seed — espelho EXATO da migration `domain-vocabularies.sql` do backend. */
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

/** Codes DEFAULT de cada vocabulário — os arrays antigos de `domain.ts`, a fonte única. */
const SEED_CODES: Record<VocabularyName, readonly string[]> = {
  EVIDENCE_TYPE: EVIDENCE_TYPES,
  LEARNING_ITEM_TYPE: LEARNING_ITEM_TYPES,
  ACTION_TYPE: ACTION_TYPES,
};

/**
 * O fallback único — espelho EXATO do seed da migration do backend
 * (`DEFAULT_DOMAIN_VOCABULARY_ITEMS` em `domain-vocabularies.ts`): codes na
 * ordem dos arrays antigos (sortOrder = posição), todos ativos. Se o seed
 * mudar lá, este arquivo muda junto; os testes de fallback denunciam
 * divergência.
 */
export const DEFAULT_VOCABULARIES: Vocabularies = Object.fromEntries(
  VOCABULARY_NAMES.map((name) => [
    name,
    seed(
      name,
      SEED_CODES[name].map((code, index) => [code, SEED_LABEL_KEYS[name][index]!] as const),
    ),
  ]),
) as Vocabularies;

/**
 * Vocabulários efetivos = servidor quando carregado, default por
 * VOCABULÁRIO enquanto não (mesmo espírito de
 * `withDefaultOperationalSettings` — sem flash: com o seed default o
 * comportamento é byte-idêntico ao hardcoded). Vocabulário a vocabulário de
 * propósito: uma lista ausente/vazia num ambiente recém-migrado não pode
 * invalidar as outras duas.
 */
export function withDefaultVocabularies(loaded?: Partial<Vocabularies>): Vocabularies {
  if (!loaded) return DEFAULT_VOCABULARIES;
  return Object.fromEntries(
    VOCABULARY_NAMES.map((name) => {
      const items = loaded[name];
      return [name, items && items.length > 0 ? items : DEFAULT_VOCABULARIES[name]];
    }),
  ) as Vocabularies;
}

/**
 * As opções de ESCRITA de um vocabulário: só itens `active`, ordenados por
 * `sortOrder` (desempate pelo code, estável). Item desativado some daqui —
 * mas continua no catálogo para rotular histórico (`vocabularyLabelOf`).
 */
export function activeVocabularyOptions(items: readonly VocabularyItem[]): VocabularyItem[] {
  return items
    .filter((item) => item.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

/** Traduz uma chave de i18n; devolve `undefined` quando não há mensagem (o `t` do app devolve a própria chave). */
export type TranslateLabelKey = (labelKey: string) => string | undefined;

/**
 * Rótulo de um code — labelKey→i18n com fallback para o próprio code
 * (um code recém-cadastrado pelo admin ainda não tem mensagem neste build;
 * mostrar o code cru é honesto e legível, nunca a chave crua). Resolve
 * também codes que NÃO estão no catálogo (histórico de um ambiente
 * anterior): caem direto no próprio code.
 */
export function vocabularyLabelOf(
  items: readonly VocabularyItem[],
  code: string,
  translate: TranslateLabelKey,
): string {
  const item = items.find((candidate) => candidate.code === code);
  if (!item) return code;
  return translate(item.labelKey) ?? code;
}
