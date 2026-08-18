import { describe, expect, it } from "vitest";

import { ChartPalette, SERIES_COUNT, tooltipStyle } from "../design/chart";

describe("ChartPalette", () => {
  it("distribui uma cor por série, na ordem dos tokens", () => {
    const p = new ChartPalette();
    expect(p.at(0).color).toBe("var(--chart-1)");
    expect(p.at(2).color).toBe("var(--chart-3)");
  });

  /**
   * O comportamento que a versão anterior não tinha: cada tela montava seu
   * array de cores e a sexta série reaparecia com a cor da primeira, sem
   * nenhuma pista de que eram séries diferentes.
   */
  it("ao repetir a cor, muda o traçado", () => {
    const p = new ChartPalette();
    expect(p.at(0).dash).toBeUndefined();

    const repetida = p.at(SERIES_COUNT);
    expect(repetida.color).toBe("var(--chart-1)");
    expect(repetida.dash).toBeDefined();
  });

  /** A cor precisa seguir a chave, não a posição: reordenar os dados não pode repintar o gráfico. */
  it("a mesma chave recebe sempre a mesma cor", () => {
    const p = new ChartPalette();
    const primeira = p.forKey("Integração");
    p.forKey("Dados");
    expect(p.forKey("Integração")).toEqual(primeira);
  });

  it("chaves distintas recebem cores distintas até a paleta virar", () => {
    const p = new ChartPalette();
    const chaves = Array.from({ length: SERIES_COUNT }, (_, i) => `d${String(i)}`);
    const cores = p.forKeys(chaves).map((e) => e.color);
    expect(new Set(cores).size).toBe(SERIES_COUNT);
  });
});

describe("tooltip", () => {
  /**
   * O Recharts injeta `background: #fff` no estilo inline do container. Sem
   * sobrescrever, o tema escuro exibia uma caixa branca sobre o gráfico.
   */
  it("declara fundo e texto próprios, senão o Recharts impõe branco", () => {
    expect(tooltipStyle.background).toContain("--chart-surface");
    expect(tooltipStyle.color).toContain("--color-foreground");
  });

  it("usa o raio da escala, e não um valor solto", () => {
    expect(tooltipStyle.borderRadius).toBe("var(--radius-md)");
  });
});
