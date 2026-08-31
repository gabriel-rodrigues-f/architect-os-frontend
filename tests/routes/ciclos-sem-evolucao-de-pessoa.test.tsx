import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { Route as CyclesRoute } from "@/routes/cycles";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 21 / apagar-o-vazio — "Ciclos de Desenvolvimento" administra PERÍODOS,
 * e trazia colado embaixo o gráfico "Evolução por capacidade" de UMA pessoa:
 * mesmo título, mesmo componente e versão mais pobre do que a aba Evolução do
 * perfil, que tem filtros de período/fonte, os indicadores e o foco por
 * capacidade. A evolução de uma pessoa não tem razão para morar na tela de
 * administrar períodos.
 *
 * O que NÃO sai — e o teste prende isto para o corte não passar do ponto:
 * "Comparação de competências" mostra nível final POR CICLO, com dado real, e
 * é a única leitura da tela que fala de ciclo × ciclo.
 */

const fetchMock = vi.fn();

const CyclesPage = CyclesRoute.options.component as () => ReactNode;

const tituloDeSecao = (container: HTMLElement, titulo: string): Element[] =>
  [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter(
    (cabecalho) => cabecalho.textContent?.trim() === titulo,
  );

describe("Ciclos de Desenvolvimento — a tela administra períodos", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { routes: [careerLevelsRoute] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /**
   * A âncora é a FIGURA do gráfico, não o título: as chaves de locale do
   * bloco saíram junto, então um teste que procurasse o texto passaria com o
   * `EvolutionLine` ainda montado sob um cabeçalho vazio — medido, foi o
   * primeiro estado deste teste. A fixture tem um ciclo "Closed", então o
   * gráfico teria dado para desenhar.
   */
  it("não desenha gráfico nenhum — a tela de períodos não é relatório de pessoa", async () => {
    const { container } = renderWithApp(<CyclesPage />);
    await screen.findByText("Comparação de competências");

    expect(
      [...container.querySelectorAll("figure, [role='img']")],
      "a evolução da pessoa mora na aba Evolução do perfil, com filtros e foco",
    ).toEqual([]);
    expect(tituloDeSecao(container, "Evolução por capacidade")).toEqual([]);
  });

  it("a comparação de competências entre ciclos continua na tela", async () => {
    const { container } = renderWithApp(<CyclesPage />);

    expect(await screen.findByText("Comparação de competências")).toBeTruthy();
    expect(tituloDeSecao(container, "Comparação de competências")).toHaveLength(1);
  });
});
