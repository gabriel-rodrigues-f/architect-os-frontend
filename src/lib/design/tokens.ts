import { CONTRAST, Oklch } from "./color";

type TokenRole = "surface" | "content" | "fill" | "stroke" | "series";

/**
 * `theme`: a identidade — superfícies, texto, ação, estado, foco (shadcn e
 * sidebar inclusos). Um matiz de ação (235), neutros e as cores de estado.
 * `vocabulary`: a escala de proficiência, a distância e o status — cada uma
 * com o próprio matiz por definição. `chart`: as séries e a superfície do
 * gráfico.
 */
export type TokenGroup = "theme" | "vocabulary" | "chart";

export interface TokenDefinition {
  readonly name: string;
  readonly role: TokenRole;
  readonly group: TokenGroup;

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

  register(group: TokenGroup, ...definitions: Omit<TokenDefinition, "group">[]): this {
    for (const definition of definitions) {
      this.tokens.set(definition.name, { ...definition, group });
    }
    return this;
  }

  byGroup(group: TokenGroup): TokenDefinition[] {
    return this.all().filter((t) => t.group === group);
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

type Definition = Omit<TokenDefinition, "group">;

const series = (name: string, light: string): Definition => ({
  name,
  role: "series",
  light: parseOklch(light),
  contrastAgainst: "chart-surface",
  minContrast: CONTRAST.large,
});

/** Um token com valor explícito nos dois temas — o bloco shadcn/sidebar e os semânticos de camada. */
class ThemedToken {
  static pair(
    name: string,
    role: TokenRole,
    light: string,
    dark: string,
    contrast?: { against: string; min?: number },
  ): Definition {
    return {
      name,
      role,
      light: parseOklch(light),
      darkOverride: parseOklch(dark),
      ...(contrast
        ? { contrastAgainst: contrast.against, minContrast: contrast.min ?? CONTRAST.text }
        : {}),
    };
  }
}
const pair = ThemedToken.pair;

/**
 * O primário é o azul da identidade nos DOIS temas ([P-01]): o escuro herdava
 * a paleta shadcn de fábrica (primário quase branco) e o login só era azul
 * porque `auth-stage` sobrescrevia. Agora `auth-stage` não redefine nada.
 * O `--primary-foreground` do escuro é branco puro: com 0.99 o par ficava em
 * 4.44 e o AA pede 4.5.
 */
const PRIMARY_LIGHT = "oklch(0.45 0.13 235)";
const PRIMARY_DARK = "oklch(0.55 0.15 235)";
const RING_LIGHT = "oklch(0.55 0.11 235)";
const RING_DARK = "oklch(0.62 0.13 235)";

export const tokenRegistry = new TokenRegistry();

tokenRegistry.register(
  "theme",
  pair("background", "surface", "oklch(0.985 0.004 240)", "oklch(0.129 0.042 264.695)", {
    against: "foreground",
  }),
  pair("foreground", "content", "oklch(0.22 0.03 250)", "oklch(0.984 0.003 247.858)"),
  pair("card", "surface", "oklch(1 0 0)", "oklch(0.208 0.042 265.755)", {
    against: "card-foreground",
  }),
  pair("card-foreground", "content", "oklch(0.22 0.03 250)", "oklch(0.984 0.003 247.858)"),
  pair("popover", "surface", "oklch(1 0 0)", "oklch(0.208 0.042 265.755)", {
    against: "popover-foreground",
  }),
  pair("popover-foreground", "content", "oklch(0.22 0.03 250)", "oklch(0.984 0.003 247.858)"),
  /* Camada acima do card — o que flutua: popover, menu, tooltip. */
  pair("surface-elevated", "surface", "oklch(1 0 0)", "oklch(0.25 0.04 265)", {
    against: "foreground",
  }),
  pair("primary", "fill", PRIMARY_LIGHT, PRIMARY_DARK, { against: "primary-foreground" }),
  pair("primary-foreground", "content", "oklch(0.99 0.005 240)", "oklch(1 0 0)"),
  /*
    Hover: o MESMO azul um degrau mais luminoso — no escuro sobe para 0.61
    (como o CTA do login, +8% de luz) e o par com o texto branco fica em
    ~3.5: contraste de texto grande, para um estado transitório. Active:
    um degrau mais escuro, AA cheio.
  */
  pair("primary-hover", "fill", "oklch(0.5 0.13 235)", "oklch(0.61 0.15 235)", {
    against: "primary-foreground",
    min: CONTRAST.large,
  }),
  pair("primary-active", "fill", "oklch(0.41 0.13 235)", "oklch(0.5 0.15 235)", {
    against: "primary-foreground",
  }),
  /* Faixa tingida com o primário por cima (chip, linha selecionada). */
  pair("primary-subtle", "fill", "oklch(0.94 0.03 235)", "oklch(0.24 0.05 235)", {
    against: "primary",
    min: CONTRAST.large,
  }),
  pair("secondary", "surface", "oklch(0.955 0.008 240)", "oklch(0.279 0.041 260.031)", {
    against: "secondary-foreground",
  }),
  pair("secondary-foreground", "content", "oklch(0.3 0.03 250)", "oklch(0.984 0.003 247.858)"),
  pair("muted", "surface", "oklch(0.962 0.006 240)", "oklch(0.279 0.041 260.031)", {
    against: "muted-foreground",
  }),
  pair("muted-foreground", "content", "oklch(0.52 0.025 250)", "oklch(0.704 0.04 256.788)"),
  /* Texto de apoio: entre o texto e o `muted-foreground`. */
  pair("text-secondary", "content", "oklch(0.4 0.03 250)", "oklch(0.8 0.02 250)"),
  /*
    O hover de `outline`/`ghost` ([P-04]): era ciano 195 no claro — um
    segundo matiz em 103 botões. Agora é a superfície de hover no neutro da
    casa; o ciano fica só como `chart-3`.
  */
  pair("accent", "surface", "oklch(0.94 0.012 240)", "oklch(0.279 0.041 260.031)", {
    against: "accent-foreground",
  }),
  pair("accent-foreground", "content", "oklch(0.28 0.03 250)", "oklch(0.984 0.003 247.858)"),
  /*
    O destrutivo do escuro era 0.704 (2.8 contra o branco). Em 0.64 o botão
    fica em 3.6 — contraste de texto grande — e o mesmo vermelho como TEXTO
    sobre o card passa AA nos dois temas (teste próprio abaixo).
  */
  pair("destructive", "fill", "oklch(0.577 0.245 27.325)", "oklch(0.64 0.2 25)", {
    against: "destructive-foreground",
    min: CONTRAST.large,
  }),
  pair(
    "destructive-foreground",
    "content",
    "oklch(0.984 0.003 247.858)",
    "oklch(0.984 0.003 247.858)",
  ),
  pair("danger-subtle", "fill", "oklch(0.95 0.03 25)", "oklch(0.24 0.05 25)", {
    against: "destructive",
    min: CONTRAST.large,
  }),
  pair("info", "fill", "oklch(0.93 0.04 235)", "oklch(0.28 0.06 235)", { against: "info-fg" }),
  pair("info-fg", "content", "oklch(0.38 0.12 235)", "oklch(0.85 0.08 235)"),
  pair("border-subtle", "stroke", "oklch(0.95 0.006 245)", "oklch(1 0 0 / 0.06)"),
  pair("border", "stroke", "oklch(0.918 0.008 245)", "oklch(1 0 0 / 0.1)"),
  pair("border-strong", "stroke", "oklch(0.84 0.014 245)", "oklch(1 0 0 / 0.2)"),
  pair("input", "stroke", "oklch(0.918 0.008 245)", "oklch(1 0 0 / 0.15)"),
  pair("ring", "stroke", RING_LIGHT, RING_DARK),
  /* O anel de foco da casa ([A-01]) — o mesmo azul do `ring`, com nome próprio para a utility `focus-ring`. */
  pair("focus-ring", "stroke", RING_LIGHT, RING_DARK),
  pair("sidebar", "surface", "oklch(0.24 0.035 250)", "oklch(0.208 0.042 265.755)", {
    against: "sidebar-foreground",
  }),
  pair("sidebar-foreground", "content", "oklch(0.9 0.015 240)", "oklch(0.984 0.003 247.858)"),
  pair("sidebar-accent", "surface", "oklch(0.31 0.04 250)", "oklch(0.279 0.041 260.031)", {
    against: "sidebar-accent-foreground",
  }),
  pair(
    "sidebar-accent-foreground",
    "content",
    "oklch(0.97 0.01 240)",
    "oklch(0.984 0.003 247.858)",
  ),
  pair("sidebar-border", "stroke", "oklch(0.33 0.03 250)", "oklch(1 0 0 / 0.1)"),
  pair("sidebar-ring", "stroke", RING_LIGHT, RING_DARK),
  pair("warning", "fill", "oklch(0.9 0.08 80)", "oklch(0.278 0.056 80)", { against: "warning-fg" }),
  pair("success", "fill", "oklch(0.89 0.07 152)", "oklch(0.282 0.049 152)", {
    against: "success-fg",
  }),
  pair("warning-fg", "content", "oklch(0.4 0.13 70)", "oklch(0.88 0.072 70)"),
  pair("success-fg", "content", "oklch(0.39 0.12 152)", "oklch(0.88 0.066 152)"),
);

tokenRegistry.register(
  "vocabulary",
  {
    name: "level-0",
    role: "fill",
    light: parseOklch("oklch(0.965 0.004 245)"),
    darkOverride: parseOklch("oklch(0.19 0.004 245)"),
  },
  {
    name: "level-1",
    role: "fill",
    light: parseOklch("oklch(0.955 0.02 25)"),
    darkOverride: parseOklch("oklch(0.25 0.01 25)"),
    contrastAgainst: "level-1-fg",
    minContrast: 4.5,
  },
  {
    name: "level-2",
    role: "fill",
    light: parseOklch("oklch(0.92 0.075 95)"),
    darkOverride: parseOklch("oklch(0.29 0.055 95)"),
    contrastAgainst: "level-2-fg",
    minContrast: 4.5,
  },
  {
    name: "level-3",
    role: "fill",
    light: parseOklch("oklch(0.82 0.1 155)"),
    darkOverride: parseOklch("oklch(0.35 0.06 155)"),
    contrastAgainst: "level-3-fg",
    minContrast: 4.5,
  },
  {
    name: "level-4",
    role: "fill",
    light: parseOklch("oklch(0.795 0.125 195)"),
    darkOverride: parseOklch("oklch(0.4 0.065 195)"),
    contrastAgainst: "level-4-fg",
    minContrast: 4.5,
  },
  {
    name: "level-5",
    role: "fill",
    light: parseOklch("oklch(0.78 0.13 235)"),
    darkOverride: parseOklch("oklch(0.435 0.09 235)"),
    contrastAgainst: "level-5-fg",
    minContrast: 4.5,
  },

  {
    name: "level-1-fg",
    role: "content",
    light: parseOklch("oklch(0.43 0.13 25)"),
    darkOverride: parseOklch("oklch(0.755 0.04 25)"),
  },
  {
    name: "level-2-fg",
    role: "content",
    light: parseOklch("oklch(0.39 0.08 95)"),
    darkOverride: parseOklch("oklch(0.79 0.06 95)"),
  },
  {
    name: "level-3-fg",
    role: "content",
    light: parseOklch("oklch(0.31 0.075 155)"),
    darkOverride: parseOklch("oklch(0.855 0.06 155)"),
  },
  {
    name: "level-4-fg",
    role: "content",
    light: parseOklch("oklch(0.295 0.05 195)"),
    darkOverride: parseOklch("oklch(0.925 0.06 195)"),
  },
  {
    name: "level-5-fg",
    role: "content",
    light: parseOklch("oklch(0.275 0.055 235)"),
    darkOverride: parseOklch("oklch(0.975 0.01 235)"),
  },

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
);

tokenRegistry.register(
  "chart",
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
