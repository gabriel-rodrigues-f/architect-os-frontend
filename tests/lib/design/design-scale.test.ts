import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  fontSize,
  fontWeight,
  MICRO_STEPS,
  radius,
  renderScales,
  SCALES,
  ShellHeader,
  spacing,
} from "@/lib/design";

/**
 * As escalas viram regra verificável, não convenção de documento. Um valor que
 * escapa da escala quebra o build, em vez de virar `p-[13px]` num componente
 * que ninguém revisa depois.
 */

describe("escalas", () => {
  it("todas sobem — degrau fora de ordem confunde quem escolhe o token", () => {
    for (const escala of SCALES) {
      expect(escala.isMonotonic(), escala.prefix).toBe(true);
    }
  });

  it("emitem uma variável CSS por degrau", () => {
    expect(radius.toCssLines()).toContain("  --radius-md: 6px;");
    expect(spacing.toCssLines()).toContain("  --space-4: 16px;");
  });

  it("peso sai sem unidade — `400px` não é peso de fonte", () => {
    expect(fontWeight.toCssLines()).toContain("  --weight-semibold: 600;");
  });
});

describe("raio", () => {
  /**
   * O documento de UX aponta o arredondamento como um dos sinais de template.
   * A base antiga era 10px e o card usava 14px.
   */
  it("nenhum degrau passa de 12px", () => {
    for (const [step, valor] of radius.entries()) {
      expect(valor, `radius-${step}`).toBeLessThanOrEqual(12);
    }
  });

  it("controles usam raio discreto", () => {
    expect(radius.get("sm")).toBe(4);
    expect(radius.get("md")).toBe(6);
    expect(radius.get("lg")).toBe(8);
  });

  /** [R-01]: `xs` (3px) nunca teve uso — degrau sem consumidor é ruído na escolha. */
  it("a escala é sm/md/lg/xl — sem xs", () => {
    expect(radius.entries().map(([step]) => step)).toEqual(["sm", "md", "lg", "xl"]);
  });
});

describe("espaçamento", () => {
  it("segue a escala 4/8/12/16/24/32/48/64", () => {
    expect(spacing.entries().map(([, v]) => v)).toEqual([4, 8, 12, 16, 24, 32, 48, 64]);
  });

  it("todo degrau é múltiplo de 4 — a grade não admite meio passo", () => {
    for (const [step, valor] of spacing.entries()) {
      expect(valor % 4, `space-${step}`).toBe(0);
    }
  });

  /**
   * [S-01]: os únicos meio-passos admitidos são 2 e 6 px, para o respiro
   * interno de ícone e badge. Documentados aqui; qualquer outro (2.5, 3.5,
   * 5, 7, 10) conta na catraca `espacamento-na-grade`.
   */
  it("admite exatamente dois micro-degraus, ambos pares e abaixo de 8", () => {
    expect(Object.keys(MICRO_STEPS)).toEqual(["0.5", "1.5"]);
    for (const valor of Object.values(MICRO_STEPS)) {
      expect(valor % 2).toBe(0);
      expect(valor).toBeLessThan(8);
      expect(valor % 4).not.toBe(0);
    }
  });
});

describe("tipografia", () => {
  it("os tamanhos cobrem a hierarquia pedida, de metadado a display", () => {
    expect(fontSize.get("meta")).toBe(11);
    expect(fontSize.get("label")).toBe(12);
    expect(fontSize.get("table")).toBe(13);
    expect(fontSize.get("body")).toBe(14);
    expect(fontSize.get("subtitle")).toBe(16);
    expect(fontSize.get("section")).toBe(20);
    expect(fontSize.get("page")).toBe(24);
    expect(fontSize.get("kpi")).toBe(32);
  });

  /** [T-02]: 10 px em badge de contagem e cabeçalho de grupo não se lê. */
  it("nada abaixo de 11 px", () => {
    for (const [step, valor] of fontSize.entries()) {
      expect(valor, `text-${step}`).toBeGreaterThanOrEqual(11);
    }
  });

  /**
   * [T-03]: a altura de linha é token, e múltiplo de 4 para a grade vertical
   * fechar — `text-meta`, `text-sm` e `text-xs` na mesma linha deixam de
   * alternar altura. Prova do vermelho: a escala anterior não tinha altura.
   */
  it("todo degrau emite altura de linha múltipla de 4 e maior que o tamanho", () => {
    for (const [step, altura] of fontSize.lineHeights()) {
      expect(altura % 4, `text-${step}--line-height`).toBe(0);
      expect(altura, `text-${step}--line-height`).toBeGreaterThan(fontSize.get(step));
    }
    expect(fontSize.lineHeight("body")).toBe(20);
    expect(fontSize.lineHeight("kpi")).toBe(40);
  });

  it("a altura de linha sai como `--text-X--line-height`, no :root e na ponte do Tailwind", () => {
    expect(fontSize.toCssLines()).toContain("  --text-body--line-height: 20px;");
    expect(fontSize.toThemeLines()).toContain(
      "  --text-body--line-height: var(--text-body--line-height);",
    );
  });

  /** `700` como padrão achata a hierarquia: se tudo é forte, nada se destaca. */
  it("não existe peso acima de 600", () => {
    for (const [step, valor] of fontWeight.entries()) {
      expect(valor, `weight-${step}`).toBeLessThanOrEqual(600);
    }
  });

  it("o corpo é menor que a seção, que é menor que a página", () => {
    expect(fontSize.get("body")).toBeLessThan(fontSize.get("section"));
    expect(fontSize.get("section")).toBeLessThan(fontSize.get("page"));
  });
});

const styles = () => readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("geração do CSS", () => {
  it("emite um bloco :root com todas as escalas e a altura do cabeçalho", () => {
    const css = renderScales();
    expect(css.startsWith(":root {")).toBe(true);
    for (const escala of SCALES) {
      for (const [step] of escala.entries()) {
        expect(css).toContain(`--${escala.prefix}-${step}:`);
      }
    }
    expect(css).toContain(ShellHeader.cssLine);
  });

  /** As linhas geradas precisam estar coladas em `styles.css` — não há passo de build que o refaça. */
  it("o styles.css está em dia com as escalas", () => {
    const css = styles();
    for (const escala of SCALES) {
      for (const linha of escala.toCssLines()) {
        expect(css, `${escala.prefix} — regenere e cole em :root`).toContain(linha);
      }
    }
    expect(css).toContain(ShellHeader.cssLine);
    expect(css).not.toContain("--radius-xs");
  });
});

/**
 * Declarar a escala em `:root` não cria utility nenhuma: o Tailwind só gera
 * `p-4` ou `text-body` a partir do que está registrado num bloco `@theme`. Sem
 * a ponte, a escala existia como documentação e a tela continuava governada
 * pelo padrão do framework.
 */
describe("registro das utilities", () => {
  it("espaçamento e tipografia declaram o namespace de utility do Tailwind", () => {
    expect(spacing.utilityNamespace).toBe("spacing");
    expect(fontSize.utilityNamespace).toBe("text");
  });

  it("a ponte aponta a utility para a variável da escala, sem duplicar o valor", () => {
    expect(spacing.toThemeLines()).toContain("  --spacing-4: var(--space-4);");
    expect(fontSize.toThemeLines()).toContain("  --text-body: var(--text-body);");
  });

  it("escala sem namespace não inventa utility", () => {
    expect(fontWeight.toThemeLines()).toEqual([]);
  });

  /**
   * [T-01]: as classes do Tailwind são aliases da escala da casa até a troca
   * por papel (PR 10) — `text-sm` É `text-body`, tamanho e altura.
   */
  it("as classes do Tailwind resolvem para a escala da casa, com altura de linha", () => {
    const css = styles();
    for (const [alias, papel] of [
      ["xs", "label"],
      ["sm", "body"],
      ["base", "subtitle"],
      ["lg", "section"],
      ["xl", "section"],
      ["2xl", "page"],
    ]) {
      expect(css).toContain(`--text-${alias}: var(--text-${papel});`);
      expect(css).toContain(`--text-${alias}--line-height: var(--text-${papel}--line-height);`);
    }
  });

  it("todo degrau registrado está no styles.css", () => {
    const css = styles();
    for (const escala of SCALES) {
      for (const linha of escala.toThemeLines()) {
        expect(css, `${escala.prefix} — registre a ponte em @theme inline`).toContain(linha);
      }
    }
  });

  it("nenhum degrau da escala fica de fora do registro", () => {
    const css = styles();
    for (const escala of SCALES.filter((e) => e.utilityNamespace)) {
      expect(escala.toThemeLines().length, escala.prefix).toBeGreaterThanOrEqual(
        escala.entries().length,
      );
      for (const [step] of escala.entries()) {
        expect(css, `${escala.utilityNamespace ?? ""}-${step}`).toContain(
          `--${escala.utilityNamespace ?? ""}-${step}:`,
        );
      }
    }
  });
});
