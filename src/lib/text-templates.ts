import { BASE_LOCALE } from "./i18n/registry";

/**
 * CFG-03 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.1 tabela 4 / C1) — templates
 * de TEXTO DE DOMÍNIO (texto que vira DADO persistido, ex. o objetivo de um
 * item de PDI) deixaram de ser literais no código: a autoridade é a tabela
 * `text_templates` do backend, servida por `GET /api/config/templates`
 * (`ConfigGateway.templates`), agrupada `key → locale → template`. Este
 * módulo é o lado do frontend dessa fatia, no MESMO formato de
 * `scoring-bands.ts` (CFG-02):
 *
 * - os TIPOS e a SEMÂNTICA de interpolação espelham o domínio do backend
 *   (`backend/src/modules/config/domain/text-templates.ts`): placeholder
 *   `{var}` (nome começa com letra), variável fornecida entra no lugar,
 *   variável SEM valor fica LITERAL no texto — nunca lança, nunca vira
 *   "undefined";
 * - `DEFAULT_TEXT_TEMPLATES` é o ÚNICO lugar onde o texto antigo sobrevive,
 *   como fallback byte-idêntico ao seed da migration do backend
 *   (`20260826010000000_text-templates.sql`, espelhado em
 *   `backend/src/modules/config/domain/default-text-templates.ts`) —
 *   enquanto a consulta não resolve (ou falha), tudo se comporta exatamente
 *   como antes, sem flash. Se o seed mudar lá, este arquivo muda junto;
 * - quem quer o template EFETIVO (servidor com fallback) no locale ATIVO
 *   usa `useTextTemplates`/`useObjectiveFromGap` (`store.tsx`); os exports
 *   `default*` daqui existem para código não-React e para preservar o
 *   comportamento default (mesma divisão de `defaultGapSeverityRuler`).
 */

/** As keys que ESTE build conhece — espelho de `TEXT_TEMPLATE_VARIABLES` do backend. */
export const TEXT_TEMPLATE_KEYS = ["pdi.objective.fromGap"] as const;
export type TextTemplateKey = (typeof TEXT_TEMPLATE_KEYS)[number];

/**
 * CFG-03 (admin UI) — as variáveis que cada key FORNECE, espelho de
 * `TEXT_TEMPLATE_VARIABLES` do backend (`config/domain/text-templates.ts`):
 * é a lista que a aba "Textos" exibe ao admin e que o
 * `TextTemplateEditor` usa para acusar `{variavel}` desconhecida antes do
 * PUT (o backend continua a autoridade — 400 `INVALID_TEXT_TEMPLATE`).
 */
export const TEXT_TEMPLATE_VARIABLES: Record<TextTemplateKey, readonly string[]> = {
  "pdi.objective.fromGap": ["competencia", "atual", "alvo"],
};

/** `key → locale → template`, a MESMA forma serializada por `GET /api/config/templates`. */
export type TextTemplates = Record<TextTemplateKey, Record<string, string>>;

/**
 * O fallback único — espelho EXATO do seed da migration do backend (que por
 * sua vez espelha, no pt, o literal que `createItemFromGap` tinha antes da
 * fatia, byte a byte). Os testes de fallback denunciam qualquer divergência.
 */
export const DEFAULT_TEXT_TEMPLATES: TextTemplates = {
  "pdi.objective.fromGap": {
    pt: "Evoluir {competencia} do nível {atual} para o nível {alvo}",
    en: "Evolve {competencia} from level {atual} to level {alvo}",
  },
};

/** `{variavel}` — MESMO padrão do backend: nome começa com letra; sem espaços. */
const VARIABLE_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

/**
 * Interpolação segura, espelho de `TextTemplate.render` do backend:
 * substitui `{var}` pelas variáveis fornecidas; placeholder sem valor
 * fornecido fica literal (não explode, não vira "undefined" no texto que a
 * pessoa lê — e que aqui vira DADO persistido no PDI).
 */
/** As variáveis REFERENCIADAS num template (`{var}`, dedup) — MESMO padrão do backend. */
export const templateVariablesIn = (template: string): string[] => [
  ...new Set([...template.matchAll(VARIABLE_PATTERN)].map((match) => match[1]!)),
];

export const renderTemplate = (
  template: string,
  variables: Record<string, string | number>,
): string =>
  template.replace(VARIABLE_PATTERN, (placeholder, name: string) => {
    const value = variables[name];
    return value === undefined ? placeholder : String(value);
  });

/**
 * Templates efetivos = servidor onde houver, default onde não houver. Por
 * key E por locale, não tudo-ou-nada (mesmo espírito de
 * `withDefaultScoringBands`): um `PUT` que só recalibrou o pt de uma key
 * não pode fazer o en dela cair no default — e um catálogo do servidor sem
 * uma key deste build (ambiente recém-migrado) não pode apagar o fallback.
 * Template vazio do servidor é descartado (o backend nem aceita gravar um).
 */
export const withDefaultTextTemplates = (
  loaded?: Record<string, Record<string, string> | undefined>,
): TextTemplates => {
  const pick = (key: TextTemplateKey): Record<string, string> => {
    const fromServer = Object.entries(loaded?.[key] ?? {}).filter(
      ([, template]) => template.trim().length > 0,
    );
    return { ...DEFAULT_TEXT_TEMPLATES[key], ...Object.fromEntries(fromServer) };
  };
  return { "pdi.objective.fromGap": pick("pdi.objective.fromGap") };
};

/**
 * O texto do template de `key` no `locale` — locale sem template cai no
 * idioma base (`pt`, que o default garante sempre presente): mesma regra do
 * `t()` do i18n, tradução ausente mostra o texto original, nunca quebra.
 */
export const templateTextFor = (
  templates: TextTemplates,
  key: TextTemplateKey,
  locale: string,
): string =>
  templates[key][locale] ??
  templates[key][BASE_LOCALE] ??
  DEFAULT_TEXT_TEMPLATES[key][BASE_LOCALE]!;

/** As variáveis que a key `pdi.objective.fromGap` fornece — espelho do backend (C1). */
export type ObjectiveFromGapVariables = {
  competencia: string;
  atual: string | number;
  alvo: string | number;
};

/** O contrato que os ViewModels recebem por injeção: template + locale já resolvidos. */
export type RenderObjectiveFromGap = (variables: ObjectiveFromGapVariables) => string;

/** Fecha template efetivo + locale ativo num renderer — o que o hook adaptador injeta no ViewModel. */
export const objectiveFromGapRenderer =
  (templates: TextTemplates, locale: string): RenderObjectiveFromGap =>
  (variables) =>
    renderTemplate(templateTextFor(templates, "pdi.objective.fromGap", locale), variables);

/**
 * O renderer default (seed, idioma base) — comportamento byte-idêntico ao
 * literal antigo; é o default do construtor de `DevelopmentPlansViewModel`
 * para código não-React/testes que não injetam nada.
 */
export const defaultObjectiveFromGap: RenderObjectiveFromGap = objectiveFromGapRenderer(
  DEFAULT_TEXT_TEMPLATES,
  BASE_LOCALE,
);
