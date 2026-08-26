import { BASE_LOCALE } from "./i18n/registry";

export const TEXT_TEMPLATE_KEYS = ["pdi.objective.fromGap"] as const;
export type TextTemplateKey = (typeof TEXT_TEMPLATE_KEYS)[number];

export const TEXT_TEMPLATE_VARIABLES: Record<TextTemplateKey, readonly string[]> = {
  "pdi.objective.fromGap": ["competencia", "atual", "alvo"],
};

export type TextTemplates = Record<TextTemplateKey, Record<string, string>>;

export const DEFAULT_TEXT_TEMPLATES: TextTemplates = {
  "pdi.objective.fromGap": {
    pt: "Evoluir {competencia} do nível {atual} para o nível {alvo}",
    en: "Evolve {competencia} from level {atual} to level {alvo}",
  },
};

const VARIABLE_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

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

export const templateTextFor = (
  templates: TextTemplates,
  key: TextTemplateKey,
  locale: string,
): string =>
  templates[key][locale] ??
  templates[key][BASE_LOCALE] ??
  DEFAULT_TEXT_TEMPLATES[key][BASE_LOCALE]!;

export type ObjectiveFromGapVariables = {
  competencia: string;
  atual: string | number;
  alvo: string | number;
};

export type RenderObjectiveFromGap = (variables: ObjectiveFromGapVariables) => string;

export const objectiveFromGapRenderer =
  (templates: TextTemplates, locale: string): RenderObjectiveFromGap =>
  (variables) =>
    renderTemplate(templateTextFor(templates, "pdi.objective.fromGap", locale), variables);

export const defaultObjectiveFromGap: RenderObjectiveFromGap = objectiveFromGapRenderer(
  DEFAULT_TEXT_TEMPLATES,
  BASE_LOCALE,
);
