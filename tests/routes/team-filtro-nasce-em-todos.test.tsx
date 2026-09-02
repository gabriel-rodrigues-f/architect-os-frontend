import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

import { apiPath } from "@/lib/api-path";
import { Route as TeamRoute } from "@/routes/team";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  emptyAuthUsersRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Onda 35 — achado 6 do dono (2026-09-02), com captura: em /team o filtro
 * "Especialização" começa em "Nenhum" e esconde todo mundo — "0 de 1".
 *
 * O caminho que reproduz: a tela abre SEM ninguém cadastrado (o hook do
 * roster nasce com a lista de filtros vazia, porque as opções vêm dos
 * profissionais), o administrador cadastra a primeira pessoa na mesma tela,
 * e o filtro continua preso no vazio que fotografou no primeiro render.
 * Pedido: nasce em "Todos" — com um profissional cadastrado, a lista mostra
 * 1 de 1 ao abrir.
 */
const fetchMock = vi.fn();

const TeamPage = TeamRoute.options.component as () => ReactNode;

const cadastro: FetchRoute = (href, init) => {
  if (init?.method === "POST" && href.endsWith(apiPath("/architects"))) {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    return jsonResponse({ ...body, id: "nova", active: true, version: 1 }, 201);
  }
  return undefined;
};

const semNinguem = { ...fixtureState, architects: [], assessments: [], mentoringSessions: [] };

describe("/team — os filtros nascem em 'Todos', também depois do primeiro cadastro", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: semNinguem,
      routes: [careerLevelsRoute, emptyAuthUsersRoute, cadastro],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a tela abre vazia, a primeira pessoa é cadastrada com especialização, e a lista mostra 1 de 1 sem filtro ativo", async () => {
    renderWithApp(<TeamPage />);
    const vazio = await screen.findByText(/^Nenhum (arquiteto|profissional) cadastrad[oa]$/);
    expect(vazio).toBeTruthy();

    const [abrir] = screen.getAllByRole("button", {
      name: /^Cadastrar (arquiteto|profissional)$/,
    });
    if (!abrir) throw new Error("sem botão de cadastro");
    await userEvent.click(abrir);
    const dialogo = within(await screen.findByRole("dialog"));
    await userEvent.type(dialogo.getByLabelText("Nome"), "Primeira Pessoa");
    await userEvent.type(dialogo.getByLabelText("E-mail"), "primeira@company.com");
    await userEvent.type(dialogo.getByLabelText(/Tempo de experiência/), "3");
    await userEvent.click(dialogo.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Primeira Pessoa")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("1 no total")).toBeTruthy());
    expect(screen.queryByText(/Especialização: Nenhum/)).toBeNull();
    expect(screen.queryByText(/Capacidade: Nenhum/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).toBeNull();
  });
});
