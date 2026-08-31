import { describe, expect, it } from "vitest";

import { DarkTheme, LightTheme, tokenRegistry } from "@/lib/design";
import { LEVELS } from "@/lib/domain";

/**
 * ONDA21/mapa-unico — pedido do dono, literal: "as cores precisam ser mais
 * claras no fundo... cores mais claras pra que seja possível enxergar o
 * número preto".
 *
 * A escala nascia desnivelada: L1–L3 em claridade 0,90 e L4/L5 mergulhando
 * para 0,82 e 0,68. Os dois últimos viravam ladrilhos escuros no meio de uma
 * tabela clara, e como a hachura de acessibilidade é desenhada com a TINTA do
 * próprio nível, quanto mais escuro o fundo mais a hachura vira listra em vez
 * de textura. O caminho é clarear o fundo, não tirar a hachura: ela é o canal
 * que separa os cinco níveis para quem não distingue as cores.
 *
 * Os três invariantes abaixo são o pedido do dono escrito como medida:
 *
 *  1. FUNDO CLARO — no tema claro nenhuma faixa desce de 0,88 de claridade;
 *     é papel para tinta escura, não ladrilho colorido.
 *  2. FAIXA ÚNICA — os cinco níveis ficam dentro de uma faixa estreita de
 *     claridade, nos dois temas. O que separa um nível do outro é o MATIZ e a
 *     hachura, nunca "este é mais escuro". Sem esta cláusula, clarear só o L5
 *     deixaria o L4 sozinho como ladrilho escuro.
 *  3. NÚMERO LEGÍVEL — a razão de contraste entre o número e a faixa alcança
 *     AAA (7:1) nos dois temas, não só o AA de 4,5 que `design-tokens` já
 *     cobra. O número é pequeno (14 px) e ainda por cima é lido POR CIMA da
 *     hachura, que come parte da margem: o piso de texto corrido não basta.
 */

const PISO_DE_CLARIDADE_NO_TEMA_CLARO = 0.88;
const FAIXA_DE_CLARIDADE = 0.03;
const CONTRASTE_AAA = 7;

const temas = [new LightTheme(), new DarkTheme()];
const niveis = LEVELS.map(({ level }) => level);
const faixaDoNivel = (level: number) => tokenRegistry.get(`level-${String(level)}`)!;
const tintaDoNivel = (level: number) => tokenRegistry.get(`level-${String(level)}-fg`)!;

describe("as faixas de nível são fundo claro para o número", () => {
  it("no tema claro nenhuma faixa é escura o bastante para engolir tinta escura", () => {
    const claro = new LightTheme();
    for (const level of niveis) {
      const claridade = claro.resolve(faixaDoNivel(level)).l;
      expect(claridade, `level-${String(level)} no tema claro`).toBeGreaterThanOrEqual(
        PISO_DE_CLARIDADE_NO_TEMA_CLARO,
      );
    }
  });

  it("os cinco níveis ficam numa faixa única de claridade — o que separa é o matiz", () => {
    for (const tema of temas) {
      const claridades = niveis.map((level) => tema.resolve(faixaDoNivel(level)).l);
      const amplitude = Math.max(...claridades) - Math.min(...claridades);
      expect(
        amplitude,
        `amplitude de claridade no tema ${tema.id}: ${claridades.map((valor) => valor.toFixed(3)).join(", ")}`,
      ).toBeLessThanOrEqual(FAIXA_DE_CLARIDADE);
    }
  });

  it("o número alcança AAA contra a própria faixa nos dois temas", () => {
    for (const tema of temas) {
      for (const level of niveis) {
        const razao = tema
          .resolve(faixaDoNivel(level))
          .contrastWith(tema.resolve(tintaDoNivel(level)));
        expect(razao, `level-${String(level)} no tema ${tema.id}`).toBeGreaterThanOrEqual(
          CONTRASTE_AAA,
        );
      }
    }
  });
});
