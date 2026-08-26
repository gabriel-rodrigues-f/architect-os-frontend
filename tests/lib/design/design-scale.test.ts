import { describe, expect, it } from "vitest";

import { fontSize, fontWeight, radius, SCALES, spacing } from "@/lib/design/scale";
import { renderScales } from "@/lib/design/stylesheet";

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
});

describe("tipografia", () => {
  it("os tamanhos cobrem a hierarquia pedida, de metadado a KPI", () => {
    expect(fontSize.get("meta")).toBe(11);
    expect(fontSize.get("body")).toBe(14);
    expect(fontSize.get("section")).toBe(18);
    expect(fontSize.get("page")).toBe(28);
    expect(fontSize.get("kpi")).toBe(32);
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

describe("geração do CSS", () => {
  it("emite um bloco :root com todas as escalas", () => {
    const css = renderScales();
    expect(css.startsWith(":root {")).toBe(true);
    for (const escala of SCALES) {
      for (const [step] of escala.entries()) {
        expect(css).toContain(`--${escala.prefix}-${step}:`);
      }
    }
  });
});
