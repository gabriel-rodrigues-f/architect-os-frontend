import { describe, expect, it } from "vitest";

import { SEPARATION, worstSeparation } from "@/lib/accessibility";
import { ChartPalette, DarkTheme, LightTheme, SERIES_COUNT, tokenRegistry } from "@/lib/design";

/**
 * O invariante desta suíte não é "a paleta é segura" — é "onde a cor sozinha
 * não separa, existe um segundo canal que separa". Ele continua valendo se o
 * time de design melhorar os tokens (aí o ramo condicional simplesmente não
 * dispara) e falha no dia em que alguém tirar o traço ou o símbolo achando
 * que a cor basta.
 *
 * A escala de níveis do heatmap SAIU daqui em onda22/paleta-de-niveis. Ela
 * não tem mais segundo canal para conferir: o dono pediu a paleta sem hachura
 * ("sem xadrez ou listras"), e no lugar do padrão a própria cor passou a
 * separar — claridade, croma e matiz andando juntos. Quem cobra isso agora é
 * `tests/lib/accessibility/paleta-de-niveis.test.ts`, com um piso por par
 * adjacente em vez de um ramo condicional.
 *
 * Medida: ΔE em OKLab ×100 sobre a cor simulada em protanopia e deuteranopia
 * (Machado 2009, severidade 1.0), pela pior das duas.
 */

const temas = [new LightTheme(), new DarkTheme()];

const tokenDe = (color: string) => {
  const nome = /var\(--(.+)\)/.exec(color)?.[1] ?? color;
  const token = tokenRegistry.get(nome);
  if (!token) throw new Error(`token de série inexistente: ${nome}`);
  return token;
};

describe("séries de gráfico", () => {
  const estilos = Array.from({ length: SERIES_COUNT }, (_, i) => new ChartPalette().at(i));

  it("cada série tem símbolo próprio dentro de uma volta da paleta", () => {
    expect(new Set(estilos.map((e) => e.symbol)).size).toBe(SERIES_COUNT);
  });

  /** Ao repetir a cor na volta seguinte, traço e símbolo precisam mudar juntos. */
  it("a cor repetida volta com traço e símbolo diferentes", () => {
    const palette = new ChartPalette();
    const primeira = palette.at(0);
    const repetida = palette.at(SERIES_COUNT);

    expect(repetida.color).toBe(primeira.color);
    expect(repetida.dash).not.toBe(primeira.dash);
    expect(repetida.symbol).not.toBe(primeira.symbol);
  });

  it("todo par que a cor não separa sob dicromacia é separado por traço ou símbolo", () => {
    for (const tema of temas) {
      for (let i = 0; i < estilos.length; i++) {
        for (let j = i + 1; j < estilos.length; j++) {
          const uma = estilos[i]!;
          const outra = estilos[j]!;
          const separacao = worstSeparation(
            tema.resolve(tokenDe(uma.color)),
            tema.resolve(tokenDe(outra.color)),
          );
          if (separacao.distance >= SEPARATION.distinguishable) continue;

          const canalExtra = uma.dash !== outra.dash || uma.symbol !== outra.symbol;
          expect(
            canalExtra,
            `séries ${String(i + 1)} e ${String(j + 1)} no tema ${tema.id}: ΔE ${separacao.distance.toFixed(1)} sob ${separacao.deficiency}`,
          ).toBe(true);
        }
      }
    }
  });
});
