import { describe, expect, it } from "vitest";

import { CHART_FIGURE_HEIGHT_PX, PaneRhythm } from "@/lib/design";
import { Bloco } from "../helpers/folha-de-estilo";
import { Varredura } from "../helpers/catraca";

/**
 * `--pane-item-h` valia 5.75rem (92px) para TRÊS listas de itens diferentes, e
 * o número nunca foi medido: era um chute, como o recuo de página que morreu
 * em `becfd24`.
 *
 * MEDIDO no navegador, com o CSS compilado, janela 1440×900 (o harness da
 * fatia: `vite dev` com a API servida por fixture, e o Playwright lendo
 * `getBoundingClientRect` de cada item e o PASSO entre itens vizinhos — item
 * mais intervalo, que é o que uma caixa precisa por item):
 *
 * | caixa                                        | item        | passo       |
 * |----------------------------------------------|-------------|-------------|
 * | Catálogo → capacidades (`SectionCard`)       | 94,89       | 110,89      |
 * | Prioridades → lista de prioridades (`li`)    | 118 a 158   | 126 a 166   |
 * | Capacitação → treinamentos (`CompetencyGapCard`) | 148 a 164 | 160 a 176 |
 * | Prioridades → radar (uma figura, não lista)  | 320         | —           |
 *
 * Três números distintos e uma figura: um token só para os quatro era chute
 * por construção. Cada TIPO de item ganha o seu ritmo, e o valor é o passo
 * MEDIDO — no item de altura variável, o passo do maior espécime medido,
 * porque a promessa da caixa é "cabem n itens", não "cabem n em média".
 */
const MEDIDO: Record<string, string> = {
  "--pane-card-h": "112px",
  "--pane-priority-h": "168px",
  "--pane-distance-card-h": "176px",
  "--pane-figure-h": "320px",
};

/** O token que era chute — some, e ninguém o lê. */
const CHUTE = "--pane-item-h";

describe("o ritmo do item é medido, e é um por tipo de item", () => {
  it("styles.css declara o ritmo de cada tipo de item com o passo medido", () => {
    const raiz = Bloco.de(":root {");
    for (const [token, valor] of Object.entries(MEDIDO)) {
      expect(`${token}=${String(raiz.valorDe(token))}`).toBe(`${token}=${valor}`);
    }
  });

  it("cada ritmo declarado tem um objeto que o nomeia, e vice-versa", () => {
    const tokens = PaneRhythm.ALL.map((ritmo) => ritmo.token).sort();
    expect(tokens).toEqual(["--pane-row-h", ...Object.keys(MEDIDO)].sort());
  });

  /**
   * A figura declara a própria altura em JS e a caixa a repete em CSS. Dois
   * lugares para o mesmo número é como o `74px` do cabeçalho nasceu — aqui os
   * dois são cobrados juntos.
   */
  it("o ritmo da figura vale exatamente o que a figura mede", () => {
    expect(Bloco.de(":root {").valorDe(PaneRhythm.FIGURE.token)).toBe(
      `${String(CHART_FIGURE_HEIGHT_PX)}px`,
    );
  });

  it("o token único morreu: ninguém o declara e ninguém o lê", () => {
    expect(Bloco.de(":root {").valorDe(CHUTE)).toBeNull();
    // Só DECLARAÇÃO e LEITURA — a menção em comentário é o registro do chute.
    const usos = new Varredura().contagem((arquivo) =>
      arquivo.ocorrencias(new RegExp(`var\\(${CHUTE}\\)|^\\s*${CHUTE}\\s*:`, "gm")),
    );
    expect(usos).toEqual({});
  });
});
