import { describe, expect, it } from "vitest";

import { CONTRAST, Oklch } from "../design/color";
import { DarkTheme, LightTheme, renderTheme, tokenRegistry } from "../design/tokens";

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
    for (const token of tokenRegistry.all()) {
      expect(dark.resolve(token).c).toBeLessThanOrEqual(token.light.c);
    }
  });

  it("o escuro preserva o matiz — vermelho continua vermelho", () => {
    for (const token of tokenRegistry.all()) {
      expect(dark.resolve(token).h).toBeCloseTo(token.light.h);
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
});
