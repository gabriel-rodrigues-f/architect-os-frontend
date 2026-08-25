import { CONTRAST, Oklch } from "./color";

/**
 * Sistema de tokens semânticos do Synapse.
 *
 * ## Por que assim
 *
 * A alternativa óbvia — resolver cor em runtime, num objeto de tema que cada
 * componente consulta — foi descartada de propósito. O navegador já resolve
 * cascata e troca de tema por variáveis CSS, de graça e sem re-render. Uma
 * camada de objetos por cima disso custaria performance e quebraria no SSR,
 * onde não há tema definido no primeiro render.
 *
 * O que a orientação a objetos resolve bem aqui é o **outro** lado: declarar as
 * cores uma vez, derivar a variante escura por regra em vez de por chute, e
 * conseguir *testar* essas regras. É o que esta biblioteca faz — ela produz o
 * CSS, não o consome.
 *
 * ## Padrões usados
 *
 * - **Strategy** (`ThemeStrategy`): cada tema decide como derivar uma escala a
 *   partir da mesma definição semântica. Trocar de tema é trocar a estratégia,
 *   não espalhar `if (dark)` pelo código.
 * - **Template Method** (`BaseThemeStrategy.derive`): o esqueleto da derivação
 *   é único; as subclasses só preenchem os passos que diferem.
 * - **Builder** (`StylesheetBuilder`): acumula tokens e emite o bloco CSS final.
 * - **Registry/Singleton** (`tokenRegistry`): ponto único de verdade sobre
 *   quais tokens existem, para que teste e geração leiam a mesma lista.
 */

/* ------------------------------------------------------------------ */
/* Definição semântica                                                 */
/* ------------------------------------------------------------------ */

/** Papel do token — determina como cada tema o deriva. */
export type TokenRole =
  /** Fundo de superfície (página, card, popover). */
  | "surface"
  /** Texto ou ícone sobre uma superfície. */
  | "content"
  /** Preenchimento com cor de significado (badge, faixa, quadrante). */
  | "fill"
  /** Traço: borda, divisória, anel de foco. */
  | "stroke"
  /**
   * Tinta de dado num gráfico — linha, área, ponto, fatia.
   *
   * Não é `fill`: um preenchimento de badge carrega texto por cima e por isso
   * escurece no tema escuro. Uma série é o oposto — precisa *saltar* da
   * superfície do gráfico, então clareia. E, ao contrário de tudo mais, o
   * matiz é a identidade da série: se o azul virar roxo ao trocar de tema, a
   * pessoa perde a referência do que estava lendo.
   */
  | "series";

export interface TokenDefinition {
  /** Nome da variável CSS, sem os hífens iniciais. */
  readonly name: string;
  readonly role: TokenRole;
  /** Valor no tema claro — a fonte da verdade da identidade da cor. */
  readonly light: Oklch;
  /**
   * Escurecido explícito. Só use quando a regra do tema não der o resultado
   * certo; o padrão é deixar a estratégia derivar.
   */
  readonly darkOverride?: Oklch;
  /** Token contra o qual este precisa ter contraste legível. */
  readonly contrastAgainst?: string;
  /** Exigência mínima: texto (4.5) ou elemento gráfico (3). */
  readonly minContrast?: number;
}

/* ------------------------------------------------------------------ */
/* Strategy                                                            */
/* ------------------------------------------------------------------ */

export interface ThemeStrategy {
  readonly id: "light" | "dark";
  /** Seletor CSS onde as variáveis deste tema são declaradas. */
  readonly selector: string;
  resolve(token: TokenDefinition): Oklch;
}

abstract class BaseThemeStrategy implements ThemeStrategy {
  abstract readonly id: "light" | "dark";
  abstract readonly selector: string;

  /**
   * Template Method: override explícito sempre vence; senão, delega ao papel.
   * Manter esta ordem num lugar só evita que cada tema reinvente a precedência.
   */
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

/** No claro a definição já é o valor final — não há nada a derivar. */
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

/**
 * Tema escuro derivado por regra.
 *
 * As três regras vêm de como o olho lê cor sobre fundo escuro:
 *
 * 1. **Superfícies invertem a escala** — o que era quase branco vira quase
 *    preto, preservando a *ordem* entre página, card e popover.
 * 2. **Preenchimentos tingidos escurecem e dessaturam; o texto sobre eles
 *    clareia.** É o inverso da intuição: um pastel claro (L 0.9) sobre fundo
 *    escuro vira mancha ofuscante. O par certo é fundo escuro do mesmo matiz
 *    com texto claro por cima.
 * 3. **Traços clareiam pouco.** Borda escura sobre fundo escuro some; borda
 *    clara demais vira grade e compete com o conteúdo.
 */
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
    // Texto sobre superfície tingida fica claro, com um resto de matiz para não
    // virar cinza. Branco absoluto cansa a leitura, daí parar em 0.88.
    return base.with({ l: 0.88 }).desaturate(0.45);
  }

  protected fill(base: Oklch): Oklch {
    /*
      Superfície tingida escurece — é o inverso do que a intuição sugere. Um
      pastel claro sobre fundo escuro vira mancha ofuscante; o tratamento certo
      é um tom escuro do mesmo matiz, com texto claro por cima.

      A faixa [0.26, 0.40] preserva a ordem relativa da escala clara, para que
      "pior → melhor" continue legível como progressão, e não só pelo matiz.
    */
    return base.with({ l: clamp(0.62 - base.l * 0.38, 0.26, 0.4) }).desaturate(0.3);
  }

  protected stroke(base: Oklch): Oklch {
    return base.with({ l: clamp(1 - base.l, 0.24, 0.42) }).desaturate(0.35);
  }

  protected series(base: Oklch): Oklch {
    /*
      Série clareia — ao contrário de `fill`, que escurece. A diferença é o que
      está por cima: um badge carrega texto e por isso vira fundo; uma linha de
      gráfico não carrega nada, ela *é* o dado, e precisa se destacar da
      superfície escura do card.

      O matiz não se move. É o ponto central: antes, o bloco `.dark` trocava a
      paleta inteira por outra (azul virava roxo, âmbar virava violeta), de
      modo que a mesma série mudava de cor ao alternar o tema e a legenda
      memorizada deixava de valer.

      Dessatura pouco (0.12): cor viva em traço fino é o que o separa do fundo,
      enquanto área grande de fundo tingido é o que precisa acalmar.
    */
    return base.with({ l: clamp(base.l + 0.2, 0.62, 0.8) }).desaturate(0.12);
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

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

  /** Só os que declaram exigência de contraste — o que a auditoria verifica. */
  withContrastRule(): TokenDefinition[] {
    return this.all().filter((t) => t.contrastAgainst);
  }

  byRole(role: TokenRole): TokenDefinition[] {
    return this.all().filter((t) => t.role === role);
  }
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

export class StylesheetBuilder {
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

/* ------------------------------------------------------------------ */
/* Tokens do produto                                                   */
/* ------------------------------------------------------------------ */

const o = (css: string) => Oklch.parse(css);

/**
 * Série de gráfico. Toda série carrega a mesma exigência — separar-se da
 * superfície do gráfico —, então a regra fica na fábrica em vez de repetida em
 * cada definição, onde uma omissão passaria despercebida.
 *
 * O mínimo é 3:1, e não 4.5:1: o critério do WCAG para linha e ponto é o de
 * componente gráfico (1.4.11), não o de texto.
 */
const series = (name: string, light: string): TokenDefinition => ({
  name,
  role: "series",
  light: o(light),
  contrastAgainst: "chart-surface",
  minContrast: CONTRAST.large,
});

/**
 * Escala de proficiência e severidade de lacuna — o vocabulário visual próprio
 * do Synapse. Eram justamente estes os tokens que o bloco `.dark` do
 * projeto não redefinia, e por isso apareciam em pastel claro sobre fundo
 * escuro.
 */
export const tokenRegistry = new TokenRegistry().register(
  // Faixas de proficiência: fundo da faixa.
  { name: "level-0", role: "fill", light: o("oklch(0.95 0.006 245)") },
  {
    name: "level-1",
    role: "fill",
    light: o("oklch(0.9 0.06 25)"),
    contrastAgainst: "level-1-fg",
    minContrast: 4.5,
  },
  {
    name: "level-2",
    role: "fill",
    light: o("oklch(0.9 0.07 65)"),
    contrastAgainst: "level-2-fg",
    minContrast: 4.5,
  },
  {
    name: "level-3",
    role: "fill",
    light: o("oklch(0.9 0.07 110)"),
    contrastAgainst: "level-3-fg",
    minContrast: 4.5,
  },
  {
    name: "level-4",
    role: "fill",
    light: o("oklch(0.82 0.11 165)"),
    contrastAgainst: "level-4-fg",
    minContrast: 4.5,
  },
  {
    name: "level-5",
    role: "fill",
    light: o("oklch(0.68 0.13 195)"),
    contrastAgainst: "level-5-fg",
    minContrast: 4.5,
  },

  // Texto sobre a faixa correspondente.
  { name: "level-1-fg", role: "content", light: o("oklch(0.4 0.14 25)") },
  { name: "level-2-fg", role: "content", light: o("oklch(0.42 0.11 65)") },
  { name: "level-3-fg", role: "content", light: o("oklch(0.38 0.1 130)") },
  { name: "level-4-fg", role: "content", light: o("oklch(0.3 0.08 170)") },
  /*
    Era quase branco sobre a faixa teal (2.6:1) — reprovava no AA e era o único
    nível com texto claro. Escurecer resolve o contraste e alinha o nível 5 aos
    outros quatro: toda a escala passa a ser texto escuro sobre faixa tingida.
  */
  { name: "level-5-fg", role: "content", light: o("oklch(0.28 0.08 195)") },

  /*
    Severidade de lacuna. O fundo do badge passa a ser o token puro — antes o
    componente aplicava o token a 20% de opacidade, que no escuro compunha com
    a página até virar um vinho quase preto. Opacidade sobre fundo variável não
    é cor previsível.
  */
  {
    name: "gap-ok",
    role: "fill",
    light: o("oklch(0.9 0.06 155)"),
    contrastAgainst: "gap-ok-fg",
    minContrast: 4.5,
  },
  {
    name: "gap-low",
    role: "fill",
    light: o("oklch(0.91 0.06 95)"),
    contrastAgainst: "gap-low-fg",
    minContrast: 4.5,
  },
  {
    name: "gap-high",
    role: "fill",
    light: o("oklch(0.9 0.07 55)"),
    contrastAgainst: "gap-high-fg",
    minContrast: 4.5,
  },
  {
    name: "gap-critical",
    role: "fill",
    light: o("oklch(0.89 0.07 25)"),
    contrastAgainst: "gap-critical-fg",
    minContrast: 4.5,
  },

  /*
    Texto do badge. Estes tokens não existiam: o componente trazia OKLCH
    literal no className, que ficava vermelho-escuro em qualquer tema e
    tornava o badge ilegível no escuro.
  */
  { name: "gap-ok-fg", role: "content", light: o("oklch(0.38 0.12 155)") },
  { name: "gap-low-fg", role: "content", light: o("oklch(0.4 0.11 95)") },
  { name: "gap-high-fg", role: "content", light: o("oklch(0.4 0.14 55)") },
  { name: "gap-critical-fg", role: "content", light: o("oklch(0.4 0.16 25)") },

  /*
    R2-VIS-01 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — status genérico (situação
    da avaliação, papel de usuário) pegava emprestado `level-*`, o vocabulário
    de PROFICIÊNCIA. "Avaliação Concluída" e "nível 5 de competência" acabavam
    na mesma cor por coincidência de contagem de estados, não por relação de
    sentido — e mudar a escala de proficiência (5 níveis) quebraria silenciosamente
    o badge de status (3 estados) por tabela. Paleta própria, com metade dos
    tons: neutro (rascunho/papel-base) → em andamento (revisão/liderança) →
    concluído (aprovado/admin).
  */
  {
    name: "status-neutral",
    role: "fill",
    light: o("oklch(0.93 0.01 250)"),
    contrastAgainst: "status-neutral-fg",
    minContrast: 4.5,
  },
  {
    name: "status-progress",
    role: "fill",
    light: o("oklch(0.88 0.09 85)"),
    contrastAgainst: "status-progress-fg",
    minContrast: 4.5,
  },
  {
    name: "status-done",
    role: "fill",
    light: o("oklch(0.87 0.09 300)"),
    contrastAgainst: "status-done-fg",
    minContrast: 4.5,
  },
  { name: "status-neutral-fg", role: "content", light: o("oklch(0.42 0.03 250)") },
  { name: "status-progress-fg", role: "content", light: o("oklch(0.4 0.12 85)") },
  { name: "status-done-fg", role: "content", light: o("oklch(0.38 0.13 300)") },

  /*
    Fundo do gráfico — plano de fundo do tooltip e âncora de contraste das
    séries. Existe como token próprio porque o tooltip do Recharts traz
    `background: #fff` embutido no estilo inline: sem sobrescrever, o tema
    escuro exibia uma caixa branca no meio do gráfico.

    O escuro é fixado no mesmo valor de `--card` em vez de derivado, para o
    tooltip não flutuar num tom ligeiramente diferente do card que o contém.
  */
  {
    name: "chart-surface",
    role: "surface",
    light: o("oklch(1 0 0)"),
    darkOverride: o("oklch(0.208 0.042 265.755)"),
  },

  /*
    Paleta categórica.

    A ordem não é estética, é de legibilidade: azul e âmbar vêm primeiro
    porque são o par que continua distinguível na deuteranopia — a forma mais
    comum de daltonismo. Verde só aparece na quinta posição, longe do
    vermelho/magenta, justamente para não formar o par que some.

    Todas contrastam com a superfície do gráfico nos dois temas (auditado em
    `design-tokens.test.ts`), porque uma linha de 2px que não se separa do
    fundo é um dado que não existe.
  */
  series("chart-1", "oklch(0.52 0.15 245)"),
  series("chart-2", "oklch(0.58 0.14 65)"),
  series("chart-3", "oklch(0.56 0.11 195)"),
  series("chart-4", "oklch(0.55 0.18 340)"),
  series("chart-5", "oklch(0.55 0.13 150)"),
  series("chart-6", "oklch(0.5 0.15 290)"),

  /*
    Série de referência (o nível esperado, no radar). Fica quase acromática de
    propósito: referência é pano de fundo contra o qual se lê o valor real, e
    disputar cor com as séries faria o alvo competir com o dado.
  */
  series("chart-reference", "oklch(0.55 0.02 250)"),
);

/** CSS de um tema, pronto para colar no stylesheet. */
export function renderTheme(strategy: ThemeStrategy): string {
  return new StylesheetBuilder(strategy).addAll(tokenRegistry.all()).build();
}
