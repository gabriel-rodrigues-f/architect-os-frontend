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
 * tabela clara.
 *
 * ONDA22/paleta-de-niveis mexeu nesta suíte, e vale registrar exatamente o
 * quê e por quê.
 *
 * A cláusula que saiu era a "FAIXA ÚNICA": os cinco níveis presos numa faixa
 * de 0,03 de claridade, porque "o que separa um nível do outro é o MATIZ e a
 * hachura". A hachura foi embora a pedido do dono ("sem xadrez ou listras"),
 * e sem ela o matiz sozinho não separa: medido com o simulador do projeto, os
 * pares vizinhos daquela paleta ficavam entre ΔE 0,19 e 5,16 — o par 2-3
 * praticamente na mesma cor. A cláusula da faixa única deixou de proteger e
 * passou a IMPEDIR o conserto, porque a saída é justamente deixar a claridade
 * variar com o nível. Ela foi substituída pela rampa monotônica de
 * `tests/lib/accessibility/paleta-de-niveis.test.ts`.
 *
 * O piso de claridade também desceu, de 0,88 para 0,75, e isso é uma escolha
 * com preço medido. Com o piso em 0,88 não existe paleta que separe os cinco
 * níveis sob dicromacia: varrendo o espaço OKLCH, o melhor par vizinho
 * alcançável era ΔE 4,3, abaixo do piso de 6 do projeto. A separação de 6 só
 * aparece com o piso em torno de 0,76. O pedido do dono era "enxergar o
 * número preto", e o que MEDE esse pedido é a razão de contraste — não o
 * número 0,88, que foi proxy escolhido aqui, não palavra dele. As duas
 * cláusulas abaixo guardam o pedido pelo que ele diz:
 *
 *  1. FUNDO CLARO — no tema claro toda faixa continua na metade clara da
 *     escala, bem acima do meio: é papel para tinta escura, não ladrilho.
 *  2. NÚMERO LEGÍVEL — a razão de contraste entre o número e a faixa alcança
 *     AAA (7:1) nos dois temas, não só o AA de 4,5 que `design-tokens` já
 *     cobra. O número é pequeno (14 px) e é o único portador do nível depois
 *     que a hachura saiu: o piso de texto corrido não basta.
 */

const PISO_DE_CLARIDADE_NO_TEMA_CLARO = 0.75;
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
