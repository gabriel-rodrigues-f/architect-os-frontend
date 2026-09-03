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
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown }) => <a {...rest}>{children}</a>,
  };
});

import { Route as TeamRoute } from "@/routes/team";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  emptyAuthUsersRoute,
  mockAppFetch,
  renderWithApp,
} from "../helpers/render-app";

/**
 * Onda 35 — achado 6 do dono (2026-09-02), com captura: em /team o filtro
 * "Especialização" começava em "Nenhum" e escondia todo mundo — "0 de 1".
 * A regra que nasceu dali vale para filtro novo: **o padrão é derivado das
 * opções no momento, nunca uma foto do estado inicial** (seleção nula = todas
 * as opções).
 *
 * ONDA 37 — o caminho que reproduzia o defeito (abrir a tela vazia e
 * cadastrar a primeira pessoa ali mesmo) deixou de existir: o cadastro saiu
 * de /team e a pessoa nasce em Usuários. **Limite declarado:** o que sobra
 * é o invariante, verificado sobre os filtros que ficaram — nenhum nasce
 * ativo e nenhum esconde ninguém. O filtro de Especialização saiu junto com
 * o campo: o dono tirou a especialização da pessoa do produto.
 */
const fetchMock = vi.fn();

const TeamPage = TeamRoute.options.component as () => ReactNode;

describe("/team — os filtros nascem em 'Todos', e nenhum esconde o roster", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [careerLevelsRoute, emptyAuthUsersRoute],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a tela abre com todo mundo, sem chip de filtro e sem 'Limpar filtros'", async () => {
    renderWithApp(<TeamPage />);

    expect(await screen.findByText("Ana Martins")).toBeTruthy();
    expect(screen.getByText("Bruno Almeida")).toBeTruthy();
    expect(screen.queryByText(/Capacidade: Nenhum/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
  });

  it("nenhum filtro de Especialização sobrou na tela", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");

    expect(screen.queryByLabelText("Especialização")).toBeNull();
  });
});
