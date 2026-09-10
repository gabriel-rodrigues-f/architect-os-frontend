import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `estrangulamento-team.test.tsx`: `<Link>` exige RouterProvider real. */
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

import { Route as TeamRoute } from "@/routes/team";
import { PageFillingPane } from "@/lib/design";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Dono (2026-09-09, com captura), bloco 1 da padronização: *"Gestão →
 * Talentos do Time → lista de talentos: rolar o grupo, nas duas visões
 * (linhas e blocos)"*. A régua desta tela é a mesma da coluna de apoio do PDI
 * (`a-coluna-de-apoio-do-pdi-rola-em-si`), agora pelo COMPONENTE único.
 *
 * Prova do vermelho contra o código antigo (`team-shared.tsx` da main), nos
 * quatro testes: `Test timed out in 5000ms` no `findByRole("region", { name:
 * "Lista de talentos" })` — não havia caixa nenhuma para achar. Quem rolava
 * era o DOCUMENTO, e o título da página saía da janela junto com a lista.
 *
 * O invariante: em tela larga a lista rola DENTRO de si; em tela estreita nada
 * disso vale, porque caixa que rola dentro de página que já rola é pior que o
 * defeito original — e por isso toda classe que monta a caixa carrega o `xl:`
 * colado no literal.
 *
 * 2026-09-10: o teto SAIU. A caixa media `janela − cabeçalho − recuo suposto`,
 * e o recuo era um chute; agora ela é o filho que ocupa o resto da coluna do
 * quadro (`PageFillingPane`) e a altura é medida. Medido na réplica desta
 * tela (1440×900): antes a caixa vazava 67px abaixo da dobra e a paginação
 * ficava 115px fora da janela; agora tudo cabe, com 48px de folga abaixo da
 * paginação — que é irmã da caixa, e por isso o "resto" a leva em conta
 * sozinho, coisa que teto fixo nenhum faria.
 */
const fetchMock = vi.fn();
const TeamPage = TeamRoute.options.component as () => ReactNode;

/** As classes que, juntas, montam a caixa presa. */
const DA_CAIXA = /(?:^|:)overflow-y-auto$|(?:^|:)(?:max-h|min-h|flex-1)/;

describe("a lista de talentos rola em si, nas duas visões", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: fixtureState });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const lista = async (): Promise<HTMLElement> =>
    screen.findByRole("region", { name: "Lista de talentos" });

  /** A tela abre em BLOCOS; a visão em linhas é a segunda do alternador. */
  const emLinhas = async (): Promise<HTMLElement> => {
    await lista();
    await userEvent.click(await screen.findByRole("button", { name: "Tabela" }));
    return lista();
  };

  it("a visão em linhas rola dentro de si, e ocupa o resto sem teto nenhum", async () => {
    renderWithApp(<TeamPage />);
    const caixa = await emLinhas();

    expect(caixa.getAttribute("style")).toBeNull();
    expect(caixa.hasAttribute(PageFillingPane.MARKER)).toBe(true);
    expect(caixa.className.split(/\s+/)).toContain("scroll-visible");
    expect(caixa.tabIndex).toBe(0);
  });

  it("o cabeçalho de colunas fica preso no topo do bloco", async () => {
    renderWithApp(<TeamPage />);
    const caixa = await emLinhas();

    expect(caixa.querySelector("thead")).not.toBeNull();
    expect(caixa.className).toContain("xl:[&_thead_th]:sticky");
    expect(caixa.className).toContain("xl:[&_thead_th]:top-0");
  });

  it("a visão em blocos também rola, e é a MESMA caixa — um componente, não dois", async () => {
    renderWithApp(<TeamPage />);
    const caixa = await lista();

    expect(caixa.querySelector("table")).toBeNull();
    expect(caixa.className.split(/\s+/)).toContain("scroll-visible");
    expect(caixa.hasAttribute(PageFillingPane.MARKER)).toBe(true);
  });

  it("em tela estreita não sobra caixa de rolagem: tudo que a monta é `xl:`", async () => {
    renderWithApp(<TeamPage />);
    const caixa = await lista();

    const daCaixa = caixa.className.split(/\s+/).filter((classe) => DA_CAIXA.test(classe));
    expect(daCaixa.length).toBeGreaterThanOrEqual(2);
    for (const classe of daCaixa) expect(classe.startsWith("xl:")).toBe(true);
  });
});
