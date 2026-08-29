import { CONTRAST, Oklch } from "./color";

type TokenRole = "surface" | "content" | "fill" | "stroke" | "series";

export interface TokenDefinition {
  readonly name: string;
  readonly role: TokenRole;

  readonly light: Oklch;

  readonly darkOverride?: Oklch;

  readonly contrastAgainst?: string;

  readonly minContrast?: number;
}

export interface ThemeStrategy {
  readonly id: "light" | "dark";

  readonly selector: string;
  resolve(token: TokenDefinition): Oklch;
}

abstract class BaseThemeStrategy implements ThemeStrategy {
  abstract readonly id: "light" | "dark";
  abstract readonly selector: string;

  resolve(token: TokenDefinition): Oklch {
    const override = this.override(token);
    if (override) return override;

    switch (token.role) {
      case "surface":
        return this.surface(token.light);
      case "content":
        return this.content(token.light);
      case "fill":
        return this.fill(token.light);
      case "stroke":
        return this.stroke(token.light);
      case "series":
        return this.series(token.light);
    }
  }

  protected abstract override(token: TokenDefinition): Oklch | undefined;
  protected abstract surface(base: Oklch): Oklch;
  protected abstract content(base: Oklch): Oklch;
  protected abstract fill(base: Oklch): Oklch;
  protected abstract stroke(base: Oklch): Oklch;
  protected abstract series(base: Oklch): Oklch;
}

export class LightTheme extends BaseThemeStrategy {
  readonly id = "light" as const;
  readonly selector = ":root";

  protected override(): Oklch | undefined {
    return undefined;
  }
  protected surface(base: Oklch) {
    return base;
  }
  protected content(base: Oklch) {
    return base;
  }
  protected fill(base: Oklch) {
    return base;
  }
  protected stroke(base: Oklch) {
    return base;
  }
  protected series(base: Oklch) {
    return base;
  }
}

export class DarkTheme extends BaseThemeStrategy {
  readonly id = "dark" as const;
  readonly selector = ".dark";

  protected override(token: TokenDefinition): Oklch | undefined {
    return token.darkOverride;
  }

  protected surface(base: Oklch): Oklch {
    return base.with({ l: clamp(1 - base.l, 0.11, 0.32) }).desaturate(0.25);
  }

  protected content(base: Oklch): Oklch {
    return base.with({ l: 0.88 }).desaturate(0.45);
  }

  protected fill(base: Oklch): Oklch {
    return base.with({ l: clamp(0.62 - base.l * 0.38, 0.26, 0.4) }).desaturate(0.3);
  }

  protected stroke(base: Oklch): Oklch {
    return base.with({ l: clamp(1 - base.l, 0.24, 0.42) }).desaturate(0.35);
  }

  protected series(base: Oklch): Oklch {
    return base.with({ l: clamp(base.l + 0.2, 0.62, 0.8) }).desaturate(0.12);
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

class TokenRegistry {
  private readonly tokens = new Map<string, TokenDefinition>();

  register(...definitions: TokenDefinition[]): this {
    for (const definition of definitions) this.tokens.set(definition.name, definition);
    return this;
  }

  get(name: string): TokenDefinition | undefined {
    return this.tokens.get(name);
  }

  all(): TokenDefinition[] {
    return [...this.tokens.values()];
  }

  withContrastRule(): TokenDefinition[] {
    return this.all().filter((t) => t.contrastAgainst);
  }

  byRole(role: TokenRole): TokenDefinition[] {
    return this.all().filter((t) => t.role === role);
  }
}

class StylesheetBuilder {
  private readonly linhas: string[] = [];

  constructor(private readonly strategy: ThemeStrategy) {}

  add(token: TokenDefinition): this {
    this.linhas.push(`  --${token.name}: ${this.strategy.resolve(token).toCss()};`);
    return this;
  }

  addAll(tokens: TokenDefinition[]): this {
    for (const token of tokens) this.add(token);
    return this;
  }

  build(): string {
    return `${this.strategy.selector} {\n${this.linhas.join("\n")}\n}`;
  }
}

const parseOklch = (css: string) => Oklch.parse(css);

const series = (name: string, light: string): TokenDefinition => ({
  name,
  role: "series",
  light: parseOklch(light),
  contrastAgainst: "chart-surface",
  minContrast: CONTRAST.large,
});

export const tokenRegistry = new TokenRegistry().register(
  { name: "level-0", role: "fill", light: parseOklch("oklch(0.95 0.006 245)") },
  {
    name: "level-1",
    role: "fill",
    light: parseOklch("oklch(0.9 0.06 25)"),
    contrastAgainst: "level-1-fg",
    minContrast: 4.5,
  },
  {
    name: "level-2",
    role: "fill",
    light: parseOklch("oklch(0.9 0.07 65)"),
    contrastAgainst: "level-2-fg",
    minContrast: 4.5,
  },
  {
    name: "level-3",
    role: "fill",
    light: parseOklch("oklch(0.9 0.07 110)"),
    contrastAgainst: "level-3-fg",
    minContrast: 4.5,
  },
  {
    name: "level-4",
    role: "fill",
    light: parseOklch("oklch(0.82 0.11 165)"),
    contrastAgainst: "level-4-fg",
    minContrast: 4.5,
  },
  {
    name: "level-5",
    role: "fill",
    light: parseOklch("oklch(0.68 0.13 195)"),
    contrastAgainst: "level-5-fg",
    minContrast: 4.5,
  },

  { name: "level-1-fg", role: "content", light: parseOklch("oklch(0.4 0.14 25)") },
  { name: "level-2-fg", role: "content", light: parseOklch("oklch(0.42 0.11 65)") },
  { name: "level-3-fg", role: "content", light: parseOklch("oklch(0.38 0.1 130)") },
  { name: "level-4-fg", role: "content", light: parseOklch("oklch(0.3 0.08 170)") },

  { name: "level-5-fg", role: "content", light: parseOklch("oklch(0.28 0.08 195)") },

  {
    name: "gap-ok",
    role: "fill",
    light: parseOklch("oklch(0.9 0.06 155)"),
    contrastAgainst: "gap-ok-fg",
    minContrast: 4.5,
  },
  {
    name: "gap-low",
    role: "fill",
    light: parseOklch("oklch(0.91 0.06 95)"),
    contrastAgainst: "gap-low-fg",
    minContrast: 4.5,
  },
  {
    name: "gap-high",
    role: "fill",
    light: parseOklch("oklch(0.9 0.07 55)"),
    contrastAgainst: "gap-high-fg",
    minContrast: 4.5,
  },
  {
    name: "gap-critical",
    role: "fill",
    light: parseOklch("oklch(0.89 0.07 25)"),
    contrastAgainst: "gap-critical-fg",
    minContrast: 4.5,
  },

  { name: "gap-ok-fg", role: "content", light: parseOklch("oklch(0.38 0.12 155)") },
  { name: "gap-low-fg", role: "content", light: parseOklch("oklch(0.4 0.11 95)") },
  { name: "gap-high-fg", role: "content", light: parseOklch("oklch(0.4 0.14 55)") },
  { name: "gap-critical-fg", role: "content", light: parseOklch("oklch(0.4 0.16 25)") },

  {
    name: "status-neutral",
    role: "fill",
    light: parseOklch("oklch(0.93 0.01 250)"),
    contrastAgainst: "status-neutral-fg",
    minContrast: 4.5,
  },
  {
    name: "status-progress",
    role: "fill",
    light: parseOklch("oklch(0.88 0.09 85)"),
    contrastAgainst: "status-progress-fg",
    minContrast: 4.5,
  },
  {
    name: "status-done",
    role: "fill",
    light: parseOklch("oklch(0.87 0.09 300)"),
    contrastAgainst: "status-done-fg",
    minContrast: 4.5,
  },
  { name: "status-neutral-fg", role: "content", light: parseOklch("oklch(0.42 0.03 250)") },
  { name: "status-progress-fg", role: "content", light: parseOklch("oklch(0.4 0.12 85)") },
  { name: "status-done-fg", role: "content", light: parseOklch("oklch(0.38 0.13 300)") },

  {
    name: "warning",
    role: "fill",
    light: parseOklch("oklch(0.9 0.08 80)"),
    contrastAgainst: "warning-fg",
    minContrast: 4.5,
  },
  {
    name: "success",
    role: "fill",
    light: parseOklch("oklch(0.89 0.07 152)"),
    contrastAgainst: "success-fg",
    minContrast: 4.5,
  },
  { name: "warning-fg", role: "content", light: parseOklch("oklch(0.4 0.13 70)") },
  { name: "success-fg", role: "content", light: parseOklch("oklch(0.39 0.12 152)") },

  {
    name: "chart-surface",
    role: "surface",
    light: parseOklch("oklch(1 0 0)"),
    darkOverride: parseOklch("oklch(0.208 0.042 265.755)"),
  },

  series("chart-1", "oklch(0.52 0.15 245)"),
  series("chart-2", "oklch(0.58 0.14 65)"),
  series("chart-3", "oklch(0.56 0.11 195)"),
  series("chart-4", "oklch(0.55 0.18 340)"),
  series("chart-5", "oklch(0.55 0.13 150)"),
  series("chart-6", "oklch(0.5 0.15 290)"),

  series("chart-reference", "oklch(0.55 0.02 250)"),
);

export function renderTheme(strategy: ThemeStrategy): string {
  return new StylesheetBuilder(strategy).addAll(tokenRegistry.all()).build();
}
