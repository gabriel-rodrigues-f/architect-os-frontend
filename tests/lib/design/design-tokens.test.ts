import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { CONTRAST, DarkTheme, LightTheme, Oklch, renderTheme, tokenRegistry } from "@/lib/design";

/**
 * A auditoria de contraste roda como teste: uma cor que deixa de passar no
 * WCAG quebra o build, em vez de virar reclamação de usuário meses depois.
 */

const light = new LightTheme();
const dark = new DarkTheme();

describe("Oklch", () => {
  it("faz o ida e volta da notação CSS", () => {
    const cor = Oklch.parse("oklch(0.68 0.13 195)");
    expect(cor.l).toBeCloseTo(0.68);
    expect(cor.c).toBeCloseTo(0.13);
    expect(cor.h).toBeCloseTo(195);
    expect(cor.toCss()).toBe("oklch(0.68 0.13 195)");
  });

  it("entende luminosidade em porcentagem, como o Tailwind emite", () => {
    expect(Oklch.parse("oklch(12.9% 0.042 264.7)").l).toBeCloseTo(0.129);
  });

  it("preserva alpha", () => {
    expect(Oklch.parse("oklch(0.5 0.1 200 / 0.5)").toCss()).toBe("oklch(0.5 0.1 200 / 0.5)");
  });

  /** Referência conhecida: preto contra branco é 21:1 no WCAG. */
  it("calcula contraste na escala do WCAG", () => {
    const preto = Oklch.parse("oklch(0 0 0)");
    const branco = Oklch.parse("oklch(1 0 0)");
    expect(preto.contrastWith(branco)).toBeGreaterThan(20);
    expect(preto.contrastWith(preto)).toBeCloseTo(1);
  });

  it("clarear e escurecer mexem só na luminosidade", () => {
    const base = Oklch.parse("oklch(0.5 0.1 200)");
    expect(base.lighten(0.2).l).toBeCloseTo(0.7);
    expect(base.lighten(0.2).c).toBeCloseTo(0.1);
    expect(base.darken(0.2).l).toBeCloseTo(0.3);
  });

  it("não deixa a luminosidade sair de 0..1", () => {
    expect(Oklch.parse("oklch(0.9 0.1 200)").lighten(0.5).l).toBe(1);
    expect(Oklch.parse("oklch(0.1 0.1 200)").darken(0.5).l).toBe(0);
  });
});

describe("temas", () => {
  it("o claro devolve a definição sem alterar", () => {
    for (const token of tokenRegistry.all()) {
      expect(light.resolve(token).toCss()).toBe(token.light.toCss());
    }
  });

  /** O bug relatado: pastel claro sobre fundo escuro vira mancha ofuscante. */
  it("o escuro derruba a luminosidade dos preenchimentos claros", () => {
    const level1 = tokenRegistry.get("level-1")!;
    expect(level1.light.l).toBeGreaterThan(0.85);
    expect(dark.resolve(level1).l).toBeLessThan(0.7);
  });

  it("o escuro dessatura, para a cor não vibrar no fundo escuro", () => {
    for (const token of tokenRegistry.all().filter((t) => !t.darkOverride)) {
      expect(dark.resolve(token).c, token.name).toBeLessThanOrEqual(token.light.c);
    }
  });

  /**
   * Override fica de fora: ele existe justamente para escapar da regra. O
   * `chart-surface` é o caso — branco puro não tem matiz a preservar, e o
   * escuro precisa cair exatamente no tom do `--card`.
   */
  it("o escuro preserva o matiz — vermelho continua vermelho", () => {
    for (const token of tokenRegistry.all().filter((t) => !t.darkOverride)) {
      expect(dark.resolve(token).h, token.name).toBeCloseTo(token.light.h);
    }
  });

  it("um override explícito vence a regra do tema", () => {
    const forcado = {
      name: "teste",
      role: "fill" as const,
      light: Oklch.parse("oklch(0.9 0.1 25)"),
      darkOverride: Oklch.parse("oklch(0.42 0.05 25)"),
    };
    expect(dark.resolve(forcado).toCss()).toBe("oklch(0.42 0.05 25)");
  });
});

describe("contraste — auditoria WCAG", () => {
  /** Cada faixa de proficiência precisa ser legível com seu texto. */
  it("faixa e texto passam em AA nos dois temas", () => {
    for (const token of tokenRegistry.withContrastRule()) {
      const par = tokenRegistry.get(token.contrastAgainst!)!;
      const minimo = token.minContrast ?? CONTRAST.text;

      const claro = light.resolve(token).contrastWith(light.resolve(par));
      const escuro = dark.resolve(token).contrastWith(dark.resolve(par));

      expect(claro, `${token.name} no tema claro`).toBeGreaterThanOrEqual(minimo);
      expect(escuro, `${token.name} no tema escuro`).toBeGreaterThanOrEqual(minimo);
    }
  });

  /** Nenhum token de cor pode ficar sem par declarado de contraste. */
  it("todo preenchimento tingido declara com quem precisa contrastar", () => {
    const semRegra = tokenRegistry
      .all()
      .filter((t) => t.role === "fill" && t.name !== "level-0" && !t.contrastAgainst);
    expect(semRegra.map((t) => t.name)).toEqual([]);
  });

  /**
   * `warning-fg` e `success-fg` também aparecem como texto solto sobre o card
   * — "salvo", "+2", o aviso de limite. O par com o preenchimento não cobre
   * esse uso: é contra a superfície do card que eles precisam ser legíveis, e
   * era exatamente aí que o âmbar cru falhava no tema escuro.
   */
  it("aviso e sucesso são legíveis como texto sobre o card, nos dois temas", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    const cardDoBloco = (seletor: string) => {
      const bloco = new RegExp(`${seletor}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
      const valor = /--card:\s*([^;]+);/.exec(bloco)?.[1];
      if (!valor) throw new Error(`--card não encontrado em ${seletor}`);
      return Oklch.parse(valor);
    };

    const superficie = { light: cardDoBloco(":root"), dark: cardDoBloco("\\.dark") };

    for (const nome of ["warning-fg", "success-fg"]) {
      const token = tokenRegistry.get(nome)!;
      expect(
        light.resolve(token).contrastWith(superficie.light),
        `${nome} no claro`,
      ).toBeGreaterThanOrEqual(CONTRAST.text);
      expect(
        dark.resolve(token).contrastWith(superficie.dark),
        `${nome} no escuro`,
      ).toBeGreaterThanOrEqual(CONTRAST.text);
    }
  });

  /** Toda série precisa se separar da superfície do gráfico — linha invisível é dado perdido. */
  it("nenhuma série de gráfico fica sem regra de contraste", () => {
    const series = tokenRegistry.byRole("series");
    expect(series.length).toBeGreaterThan(0);
    for (const token of series) {
      expect(token.contrastAgainst, token.name).toBe("chart-surface");
    }
  });
});

/* ------------------------------------------------------------------ */
/* Gráficos                                                            */
/* ------------------------------------------------------------------ */

describe("paleta de gráficos", () => {
  /** Só as categóricas: `chart-reference` é moldura, não série de dado. */
  const series = () => tokenRegistry.byRole("series").filter((t) => /^chart-\d+$/.test(t.name));

  /**
   * O bug que originou esta suíte: o bloco `.dark` trocava `--chart-1..5` por
   * outra paleta inteira. Azul virava roxo, âmbar virava violeta — a mesma
   * série mudava de cor ao alternar o tema e a legenda memorizada deixava de
   * valer.
   */
  it("o matiz da série é o mesmo nos dois temas", () => {
    for (const token of series()) {
      expect(dark.resolve(token).h, token.name).toBeCloseTo(light.resolve(token).h);
    }
  });

  /** Série clareia no escuro — é o inverso de `fill`, que escurece por carregar texto. */
  it("a série clareia no tema escuro, ao contrário do preenchimento", () => {
    for (const token of series()) {
      expect(dark.resolve(token).l, token.name).toBeGreaterThan(light.resolve(token).l);
    }
    const fill = tokenRegistry.get("gap-critical")!;
    expect(dark.resolve(fill).l).toBeLessThan(light.resolve(fill).l);
  });

  /**
   * Duas séries vizinhas com matiz quase igual são indistinguíveis num traço
   * de 2px. A distância mínima aqui guarda a paleta de crescer para os lados
   * e virar seis tons do mesmo azul.
   */
  it("as séries são distinguíveis entre si", () => {
    const matizes = series().map((t) => t.light.h);
    for (let i = 0; i < matizes.length; i++) {
      for (let j = i + 1; j < matizes.length; j++) {
        const bruto = Math.abs((matizes[i] as number) - (matizes[j] as number));
        const distancia = Math.min(bruto, 360 - bruto);
        expect(distancia, `séries ${String(i + 1)} e ${String(j + 1)}`).toBeGreaterThan(30);
      }
    }
  });

  /** Referência não pode competir com dado: quase acromática, por definição. */
  it("a referência é praticamente sem cor", () => {
    expect(tokenRegistry.get("chart-reference")!.light.c).toBeLessThan(0.05);
  });

  /**
   * O tooltip do Recharts traz `background: #fff` no estilo inline. Sem uma
   * superfície própria declarada, o tema escuro exibia caixa branca sobre o
   * gráfico.
   */
  it("a superfície do gráfico acompanha o tema", () => {
    const surface = tokenRegistry.get("chart-surface")!;
    expect(light.resolve(surface).l).toBeGreaterThan(0.9);
    expect(dark.resolve(surface).l).toBeLessThan(0.3);
  });
});

describe("geração de CSS", () => {
  it("emite um bloco por tema, com todos os tokens", () => {
    const css = renderTheme(dark);
    expect(css.startsWith(".dark {")).toBe(true);
    for (const token of tokenRegistry.all()) {
      expect(css).toContain(`--${token.name}:`);
    }
  });

  it("o claro é emitido em :root", () => {
    expect(renderTheme(light).startsWith(":root {")).toBe(true);
  });

  /**
   * O `styles.css` é gerado a partir daqui e colado no arquivo — não há passo
   * de build que o refaça. Sem esta guarda, mexer num token e esquecer de
   * regenerar deixaria a lib e a folha de estilo dizendo coisas diferentes,
   * com a auditoria de contraste aprovando cores que a tela não usa.
   */
  it("o styles.css está em dia com os tokens da lib", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

    for (const token of tokenRegistry.all()) {
      for (const tema of [light, dark]) {
        const linha = `--${token.name}: ${tema.resolve(token).toCss()};`;
        expect(css, `${token.name} (${tema.id}) — rode a geração e cole em styles.css`).toContain(
          linha,
        );
      }
    }
  });
});
