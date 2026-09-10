import { cleanup, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { Route as CalibrationRoute } from "@/routes/calibration";
import {
  fixtureAssignedManagerUser,
  fixtureState,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * A CALIBRAÇÃO SE LÊ EM LINHAS — dono, 2026-09-10, com referência visual:
 * *"Não transformar cada avaliador em um grande dashboard individual. A
 * prioridade é comparação, densidade e leitura rápida."*
 *
 * A tela desenhava cada avaliador como um CARTÃO numa grade de até três
 * colunas (`md:grid-cols-2 xl:grid-cols-3`) — literalmente o grande dashboard
 * individual que ele mandou não fazer. Passa a ser LINHA, com os campos que
 * ele escreveu, nesta ordem: avaliador · média e desvio · distribuição L1–L5 ·
 * total de notas · avaliações.
 *
 * É o mesmo movimento do cartão de distância do PDI (`93bef69`), pelo mesmo
 * motivo: coluna estreita mata comparação.
 *
 * O TESTE DE ACEITAÇÃO é dele, e são cinco coisas que precisam saltar à vista
 * comparando duas linhas: concentração excessiva num nível · quem é mais
 * rigoroso · quem é mais permissivo · quem distribui muito diferente das
 * demais · quem NÃO usa determinados níveis. Cada caso abaixo pina uma delas.
 *
 * Os números não são inventados: são o mesmo recorte que a calibração já
 * usava. Média geral 162/52 = 3.12; Marina 4.00 (+0.88, 20 notas em 4
 * avaliações), Ricardo 3.00 (−0.12, 16 em 3), Paula 2.13 (−0.99, 16 em 3).
 */
const fetchMock = vi.fn();

const CalibrationPage = CalibrationRoute.options.component as () => ReactNode;

const distribuicaoDe = (
  counts: [number, number, number, number, number],
): Record<"1" | "2" | "3" | "4" | "5", number> => ({
  "1": counts[0],
  "2": counts[1],
  "3": counts[2],
  "4": counts[3],
  "5": counts[4],
});

const calibracaoDoServidor = {
  cycleId: "2026-h2",
  overall: { distribution: distribuicaoDe([5, 11, 16, 13, 7]), average: 162 / 52 },
  evaluators: [
    {
      userId: "evaluator-lenient",
      name: "Marina Lopes",
      teamIds: ["team-integration"],
      distribution: distribuicaoDe([0, 1, 4, 9, 6]),
      average: 4,
      itemsCount: 20,
      assessmentsCount: 4,
    },
    {
      userId: "evaluator-central",
      name: "Ricardo Nunes",
      teamIds: ["team-architecture"],
      distribution: distribuicaoDe([1, 3, 8, 3, 1]),
      average: 3,
      itemsCount: 16,
      assessmentsCount: 3,
    },
    {
      userId: "evaluator-severe",
      name: "Paula Souza",
      teamIds: ["team-platform"],
      distribution: distribuicaoDe([4, 7, 4, 1, 0]),
      average: 2.125,
      itemsCount: 16,
      assessmentsCount: 3,
    },
  ],
};

const teamsRoute: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse([
        { id: "team-integration", name: "Integração", active: true },
        { id: "team-architecture", name: "Arquitetura", active: true },
        { id: "team-platform", name: "Plataforma", active: true },
      ])
    : undefined;

const montarTela = (resposta: unknown = calibracaoDoServidor) => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user: fixtureAssignedManagerUser,
    state: scopedFixtureStateFor(fixtureAssignedManagerUser, fixtureState, ["time-plataforma"]),
    routes: [
      (href: string) =>
        href.includes(apiPath("/calibration")) ? jsonResponse(resposta) : undefined,
      teamsRoute,
    ],
  });
  renderWithApp(<CalibrationPage />);
};

const linhaDe = (name: string) =>
  screen.getByText(name).closest("[data-evaluator-row]") as HTMLElement;

const barraDe = (name: string, level: number) =>
  within(linhaDe(name)).getByTestId(`level-bar-${String(level)}`);

/** A altura que a barra pediu, em porcentagem da caixa do gráfico. */
const alturaDe = (name: string, level: number): number =>
  Number.parseFloat(barraDe(name, level).style.height);

beforeEach(() => {
  window.localStorage.setItem("synapse:locale", "pt");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("cada avaliador é uma LINHA, não um dashboard individual", () => {
  it("os três avaliadores saem como três linhas de uma lista só", async () => {
    montarTela();
    await screen.findByText("Marina Lopes");

    const linhas = document.querySelectorAll("[data-evaluator-row]");
    expect(linhas.length, "o dono pediu comparação e densidade: linha, não cartão").toBe(3);
  });

  it("a lista de avaliadores não é mais uma grade de colunas", async () => {
    montarTela();
    await screen.findByText("Marina Lopes");

    const lista = linhaDe("Marina Lopes").parentElement as HTMLElement;
    expect(
      lista.className,
      "coluna estreita mata comparação — é o motivo do 93bef69 no PDI",
    ).not.toMatch(/grid-cols-/);
  });

  it("a linha traz os cinco campos, na ordem que ele escreveu", async () => {
    montarTela();
    await screen.findByText("Marina Lopes");

    const marina = linhaDe("Marina Lopes");
    const campo = (nome: string) => within(marina).getByTestId(nome);

    expect(campo("evaluator-name").textContent).toContain("Marina Lopes");
    expect(campo("evaluator-average").textContent, "média").toContain("4.00");
    expect(campo("evaluator-average").textContent, "desvio").toContain("+0.88");
    expect(campo("evaluator-distribution")).toBeTruthy();
    expect(campo("evaluator-items").textContent, "total de notas").toContain("20");
    expect(campo("evaluator-assessments").textContent, "avaliações").toContain("4");

    const ordem = [
      "evaluator-name",
      "evaluator-average",
      "evaluator-distribution",
      "evaluator-items",
      "evaluator-assessments",
    ].map((nome) => campo(nome));
    for (let posicao = 1; posicao < ordem.length; posicao += 1) {
      const anterior = ordem[posicao - 1] as HTMLElement;
      const atual = ordem[posicao] as HTMLElement;
      expect(
        anterior.compareDocumentPosition(atual) & Node.DOCUMENT_POSITION_FOLLOWING,
        `campo ${String(posicao)}: a ordem é a que o dono escreveu`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("o gráfico: barras verticais compactas, L1 a L5, valor no topo", () => {
  it("todos os cinco níveis aparecem em toda linha", async () => {
    montarTela();
    await screen.findByText("Marina Lopes");

    for (const nome of ["Marina Lopes", "Ricardo Nunes", "Paula Souza"]) {
      const niveis = within(linhaDe(nome))
        .getAllByTestId(/^level-bar-/)
        .map((barra) => barra.getAttribute("data-level"));
      expect(niveis, nome).toEqual(["1", "2", "3", "4", "5"]);
    }
  });

  /**
   * O COMPORTAMENTO 5 do dono — *"ausência de utilização de determinados
   * níveis"*. Marina nunca deu L1; Paula nunca deu L5. A barra zerada É o
   * dado, e some junto com o resto se o gráfico esconder o nível vazio.
   */
  it("nível que o avaliador nunca usou aparece zerado, e o zero está escrito", async () => {
    montarTela();
    await screen.findByText("Marina Lopes");

    expect(barraDe("Marina Lopes", 1).getAttribute("data-count")).toBe("0");
    expect(alturaDe("Marina Lopes", 1)).toBe(0);
    expect(barraDe("Paula Souza", 5).getAttribute("data-count")).toBe("0");

    const rotulos = within(linhaDe("Marina Lopes"))
      .getAllByTestId(/^level-value-/)
      .map((rotulo) => rotulo.textContent);
    expect(rotulos, "valor absoluto no topo de CADA barra").toEqual(["0", "1", "4", "9", "6"]);
  });

  /**
   * O COMPORTAMENTO 4 — *"distribuição muito diferente das demais"* — e o 1,
   * *"concentração excessiva num nível"*. Os dois só se leem se as barras de
   * DUAS LINHAS medirem a mesma coisa: com escala por linha, o L4 de Marina
   * (9 notas) e o L3 de Ricardo (8) desenham a mesma altura, e a concentração
   * dela desaparece.
   */
  it("as linhas compartilham a escala: contagem igual, altura igual; maior, mais alta", async () => {
    montarTela();
    await screen.findByText("Marina Lopes");

    expect(alturaDe("Marina Lopes", 4), "o maior de todos ocupa a caixa inteira").toBe(100);
    expect(
      alturaDe("Ricardo Nunes", 3),
      "8 notas não podem desenhar tão alto quanto as 9 de Marina",
    ).toBeLessThan(alturaDe("Marina Lopes", 4));
    expect(alturaDe("Marina Lopes", 2), "1 nota aqui").toBe(alturaDe("Ricardo Nunes", 1));
  });

  it("o gráfico não rola na horizontal — os cinco níveis cabem na linha", async () => {
    montarTela();
    await screen.findByText("Marina Lopes");

    const grafico = barraDe("Marina Lopes", 1).closest("[data-level-chart]") as HTMLElement;
    expect(grafico.className).not.toMatch(/overflow-x-auto|overflow-x-scroll|overflow-auto/);
  });
});

/**
 * "Ausência não é zero." Avaliador com nota nenhuma não é um avaliador que deu
 * cinco zeros — e uma linha de cinco barras rentes ao chão afirma exatamente
 * isso, ainda por cima na escala compartilhada com quem tem notas.
 */
describe("avaliador sem nota nenhuma não vira linha de zeros", () => {
  const semNota = {
    ...calibracaoDoServidor,
    evaluators: [
      ...calibracaoDoServidor.evaluators,
      {
        userId: "evaluator-silent",
        name: "Helena Prado",
        teamIds: ["team-platform"],
        distribution: distribuicaoDe([0, 0, 0, 0, 0]),
        average: null,
        itemsCount: 0,
        assessmentsCount: 0,
      },
    ],
  };

  it("a linha dele diz que não há nota, e não desenha barra nenhuma", async () => {
    montarTela(semNota);
    await screen.findByText("Helena Prado");

    const helena = linhaDe("Helena Prado");
    expect(within(helena).getByText("Nenhuma nota neste ciclo")).toBeTruthy();
    expect(within(helena).queryAllByTestId(/^level-bar-/)).toEqual([]);
  });
});

/**
 * REDE, e está declarado: o pedido original trazia *"filtros Ciclo e
 * Profissional lado a lado"*, e o de Profissional morreu em `cc6ec91a`/
 * `7c9d687` com a leitura de apoio que ele alimentava. Sobrou um. Este caso
 * nasce VERDE — existe para que ninguém invente um segundo filtro só para
 * preencher a linha.
 */
describe("sobrou UM filtro, e é o de Ciclo", () => {
  it("a faixa de filtros tem exatamente um seletor", async () => {
    montarTela();
    await screen.findByText("Marina Lopes");

    const seletores = screen.getAllByRole("button", { name: /Ciclo/ });
    expect(seletores).toHaveLength(1);
    expect(screen.queryByText("Profissional para a leitura de apoio")).toBeNull();
  });
});
