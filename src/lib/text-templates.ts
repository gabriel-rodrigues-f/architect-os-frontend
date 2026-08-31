import { BASE_LOCALE } from "./i18n/registry";

export const TEXT_TEMPLATE_KEYS = ["pdi.objective.fromGap"] as const;
export type TextTemplateKey = (typeof TEXT_TEMPLATE_KEYS)[number];

export const TEXT_TEMPLATE_VARIABLES: Record<TextTemplateKey, readonly string[]> = {
  "pdi.objective.fromGap": ["competencia", "atual", "alvo"],
};

export type TextTemplates = Record<TextTemplateKey, Record<string, string>>;

export type ServedTextTemplates = Record<string, Record<string, string> | undefined>;

const BASE_LOCALE_TEXT_TEMPLATES: Record<TextTemplateKey, string> = {
  "pdi.objective.fromGap": "Evoluir {competencia} do nível {atual} para o nível {alvo}",
};

export const DEFAULT_TEXT_TEMPLATES: TextTemplates = {
  "pdi.objective.fromGap": {
    [BASE_LOCALE]: BASE_LOCALE_TEXT_TEMPLATES["pdi.objective.fromGap"],
    en: "Evolve {competencia} from level {atual} to level {alvo}",
  },
};

const VARIABLE_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

type ObjectiveFromGapVariables = {
  competencia: string;
  atual: string | number;
  alvo: string | number;
};

export type RenderObjectiveFromGap = (variables: ObjectiveFromGapVariables) => string;

export class TextTemplate {
  private constructor(readonly text: string) {}

  static of(text: string): TextTemplate {
    return new TextTemplate(text);
  }

  get variableNames(): string[] {
    return [
      ...new Set(
        [...this.text.matchAll(VARIABLE_PATTERN)]
          .map((match) => match[1])
          .filter((name) => name !== undefined),
      ),
    ];
  }

  render(variables: Record<string, string | number>): string {
    return this.text.replace(VARIABLE_PATTERN, (placeholder, name: string) => {
      const value = variables[name];
      return value === undefined ? placeholder : String(value);
    });
  }
}

export class TextTemplateRenderer {
  private constructor(
    readonly templates: TextTemplates,
    private readonly locale: string,
  ) {}

  static resolve(loaded?: ServedTextTemplates): TextTemplates {
    const served = (key: TextTemplateKey): Record<string, string> => {
      const nonBlank = Object.entries(loaded?.[key] ?? {}).filter(
        ([, template]) => template.trim().length > 0,
      );
      return { ...DEFAULT_TEXT_TEMPLATES[key], ...Object.fromEntries(nonBlank) };
    };
    return { "pdi.objective.fromGap": served("pdi.objective.fromGap") };
  }

  static over(templates: TextTemplates, locale: string): TextTemplateRenderer {
    return new TextTemplateRenderer(templates, locale);
  }

  static fromLoaded(
    loaded?: ServedTextTemplates,
    locale: string = BASE_LOCALE,
  ): TextTemplateRenderer {
    return TextTemplateRenderer.over(TextTemplateRenderer.resolve(loaded), locale);
  }

  static get defaults(): TextTemplateRenderer {
    return TextTemplateRenderer.over(DEFAULT_TEXT_TEMPLATES, BASE_LOCALE);
  }

  templateFor(key: TextTemplateKey): TextTemplate {
    const byLocale = this.templates[key];
    return TextTemplate.of(
      byLocale[this.locale] ?? byLocale[BASE_LOCALE] ?? BASE_LOCALE_TEXT_TEMPLATES[key],
    );
  }

  get objectiveFromGap(): RenderObjectiveFromGap {
    const template = this.templateFor("pdi.objective.fromGap");
    return (variables) => template.render(variables);
  }
}

export const defaultObjectiveFromGap: RenderObjectiveFromGap =
  TextTemplateRenderer.defaults.objectiveFromGap;
