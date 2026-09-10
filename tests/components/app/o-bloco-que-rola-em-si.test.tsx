import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ScrollPane } from "@/components/app/ScrollPane";
import { PageFillingPane, PaneHeight, PaneRhythm, ScrollPaneStyle } from "@/lib/design";
import { Bloco } from "../../helpers/folha-de-estilo";

/**
 * O componente único da padronização pedida pelo dono em 2026-09-09
 * (*"mantermos os títulos das páginas sempre visíveis"*). Estes testes
 * nascem VERDES — o componente é código novo, e a rede que prova o vermelho é
 * a régua `o-titulo-da-pagina-fica-sempre-visivel`, que falhou nos catorze
 * blocos antes da fatia. O que se guarda aqui são os quatro invariantes que
 * cada tela deixaria escapar se montasse a caixa à mão.
 */
describe("o bloco que rola em si mesmo", () => {
  afterEach(cleanup);

  /** As classes que, juntas, montam a caixa presa. */
  const DA_CAIXA = /(?:^|:)overflow-y-auto$|(?:^|:)max-h-/;

  const caixa = (): HTMLElement => screen.getByRole("region", { name: "Bloco" });

  it("mede em ITENS e não em pixel: o número mora no token do ritmo", () => {
    render(
      <ScrollPane label="Bloco" height={PaneHeight.items(3, PaneRhythm.CARD)}>
        conteúdo
      </ScrollPane>,
    );
    expect(caixa().getAttribute("style")).toContain(
      `${PaneHeight.TOKEN}: calc(3 * var(${PaneRhythm.CARD.token}))`,
    );
    // Cada ritmo é um comprimento declarado na folha — nenhum número solto na
    // tela. Em `rem` quando o ritmo acompanha o texto (a linha de tabela), em
    // `px` quando é o passo MEDIDO de um item que não escala com a fonte.
    for (const rhythm of PaneRhythm.ALL) {
      expect(Bloco.de(":root {").valorDe(rhythm.token)).toMatch(/^[\d.]+(?:rem|px)$/);
    }
  });

  it("a linha do cabeçalho de colunas entra na conta e não conta como item lido", () => {
    expect(PaneHeight.rowsWithColumnHeader(10).css).toBe(`calc(11 * var(${PaneRhythm.ROW.token}))`);
    expect(PaneHeight.items(10).css).toBe(`calc(10 * var(${PaneRhythm.ROW.token}))`);
  });

  it("altura em itens recusa medida que não é item — zero, negativo ou quebrado", () => {
    for (const invalido of [0, -1, 2.5]) {
      expect(() => PaneHeight.items(invalido)).toThrow(RangeError);
    }
  });

  /*
   * 2026-09-10, dono: *"Em Contas e Acessos, ainda preciso rolar para baixo
   * para ver a lista."* A caixa somava `100dvh − cabeçalho − 16rem de faixa
   * suposta`; os 16rem eram um chute único para sete topos diferentes. Agora
   * ela não tem TETO: é o filho que ocupa o resto de uma coluna de altura
   * cheia, e quem mede é o navegador. Prova do vermelho contra o código
   * antigo: `style` trazia `--pane-max-h: calc(100dvh - var(--shell-header-h)
   * - var(--pane-page-inset-h));` e não havia marcador nenhum.
   */
  it("a caixa que ocupa o resto não declara teto: sem variável, sem conta", () => {
    render(
      <ScrollPane label="Bloco" height={PaneHeight.restOfPage()}>
        conteúdo
      </ScrollPane>,
    );
    expect(caixa().getAttribute("style")).toBeNull();
    expect(caixa().className).not.toContain("max-h");
  });

  it("ela se anuncia ao quadro e é o filho que estica e encolhe", () => {
    render(
      <ScrollPane label="Bloco" height={PaneHeight.restOfPage()}>
        conteúdo
      </ScrollPane>,
    );
    expect(caixa().hasAttribute(PageFillingPane.MARKER)).toBe(true);
    for (const classe of PageFillingPane.paneClass.split(/\s+/)) {
      expect(caixa().className.split(/\s+/)).toContain(classe);
    }
  });

  it("em tela estreita não sobra caixa nenhuma: tudo que a monta é `xl:`", () => {
    render(
      <ScrollPane label="Bloco" height={PaneHeight.items(3)} table horizontal>
        conteúdo
      </ScrollPane>,
    );
    const daCaixa = caixa()
      .className.split(/\s+/)
      .filter((classe) => DA_CAIXA.test(classe));
    expect(daCaixa.length).toBeGreaterThanOrEqual(2);
    for (const classe of daCaixa) expect(classe.startsWith("xl:")).toBe(true);
    for (const classe of ScrollPaneStyle.pinnedColumnHeaderClass.split(/\s+/)) {
      expect(classe.startsWith("xl:")).toBe(true);
    }
  });

  /*
   * A mesma regra vale para o mecanismo NOVO, e ali ela é maior: quem monta a
   * coluna não é só a caixa — é a casca e o quadro também. Em tela estreita a
   * página rola, e nenhuma das três pode valer.
   */
  it("nem a casca nem o quadro montam coluna em tela estreita", () => {
    const doMecanismo = [
      PageFillingPane.paneClass,
      PageFillingPane.frameClass,
      PageFillingPane.shellClass,
    ]
      .join(" ")
      .split(/\s+/);
    expect(doMecanismo.length).toBeGreaterThanOrEqual(6);
    for (const classe of doMecanismo) expect(classe.startsWith("xl:")).toBe(true);
  });

  it("é alcançável por teclado, com a barra e o anel de foco da casa", () => {
    render(
      <ScrollPane label="Bloco" height={PaneHeight.restOfPage()}>
        conteúdo
      </ScrollPane>,
    );
    expect(caixa().tabIndex).toBe(0);
    expect(caixa().className.split(/\s+/)).toContain("scroll-visible");
    expect(caixa().className).toContain("focus-visible:focus-ring");
  });

  it("onde há tabela, o cabeçalho de coluna fica preso no topo do bloco", () => {
    render(
      <ScrollPane label="Bloco" height={PaneHeight.items(2)} table>
        <table>
          <thead>
            <tr>
              <th scope="col">Coluna</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>linha</td>
            </tr>
          </tbody>
        </table>
      </ScrollPane>,
    );
    expect(caixa().className).toContain("xl:[&_thead_th]:sticky");
    expect(caixa().className).toContain("xl:[&_thead_th]:top-0");
  });

  it("a tabela larga rola nos DOIS eixos no mesmo elemento — senão o cabeçalho preso se solta", () => {
    render(
      <ScrollPane label="Bloco" height={PaneHeight.items(2)} table horizontal>
        conteúdo
      </ScrollPane>,
    );
    const classes = caixa().className.split(/\s+/);
    expect(classes).toContain("overflow-x-auto");
    expect(classes).toContain("xl:overflow-y-auto");
  });
});
