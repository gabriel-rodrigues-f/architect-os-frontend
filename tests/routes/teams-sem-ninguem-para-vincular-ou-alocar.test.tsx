import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params: _params,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { apiPath } from "@/lib/api-path";
import { Route as TeamsRoute } from "@/routes/teams";
import { fixtureAdminUser, fixtureState, fixtureTeamId } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Onda 35 — achado 4 do dono (2026-09-02), literal: "Times › Vincular pessoa
 * sem ninguém disponível: em vez do combobox, 'Nenhuma pessoa cadastrada.
 * Clique para cadastrar uma pessoa' → tela de cadastro." O mesmo tratamento
 * em "Alocar pessoa" (profissionais), com link para /team. Só o estado vazio
 * muda: com gente disponível, o combobox continua.
 */
const fetchMock = vi.fn();

const TeamsPage = TeamsRoute.options.component as () => ReactNode;

const times = [{ id: fixtureTeamId, name: "Time Plataforma", active: true }];

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(times)
    : undefined;

const rotaSemContas: FetchRoute = (href) =>
  href.endsWith(apiPath("/auth/users")) ? jsonResponse([]) : undefined;

const rotaDoQuadroVazio: FetchRoute = (href, init) =>
  href.endsWith(apiPath(`/teams/${fixtureTeamId}/memberships`)) && (init?.method ?? "GET") === "GET"
    ? jsonResponse([])
    : undefined;

async function abrirOQuadro() {
  await screen.findByText("Time Plataforma");
  await userEvent.click(screen.getByLabelText("Quadro de Time Plataforma"));
  await screen.findByText("Pessoas do time");
}

describe("/teams — sem ninguém para vincular ou alocar, a tela aponta o cadastro", () => {
  beforeEach(() => {
    try {
      window.localStorage.removeItem("synapse:section-open:teams.registry");
      window.localStorage.removeItem("synapse:section-open:teams.roster");
    } catch {
      return;
    }
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [rotaDeTimes, rotaSemContas, rotaDoQuadroVazio],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("'Vincular pessoa' sem conta disponível: no lugar do combobox, o texto e o link para /users", async () => {
    renderWithApp(<TeamsPage />);
    await abrirOQuadro();

    const secao = within(screen.getByText("Vincular pessoa").closest("div") as HTMLElement);
    expect(secao.getByText("Nenhuma pessoa cadastrada.")).toBeTruthy();
    const link = secao.getByRole("link", { name: "Clique para cadastrar uma pessoa" });
    expect(link.getAttribute("href")).toBe("/users");
    expect(secao.queryByLabelText("Pessoa")).toBeNull();
    expect(secao.queryByRole("button", { name: "Vincular" })).toBeNull();
  });

  it("'Alocar pessoa' sem profissional disponível: o texto e o link para /team, sem combobox", async () => {
    renderWithApp(<TeamsPage />);
    await abrirOQuadro();

    await userEvent.click(screen.getByRole("button", { name: "Alocar pessoa" }));
    const dialogo = within(await screen.findByRole("dialog"));
    const link = dialogo.getByRole("link", { name: "Clique para cadastrar uma pessoa" });
    expect(link.getAttribute("href")).toBe("/team");
    expect(dialogo.queryByLabelText("Pessoa")).toBeNull();
  });
});
