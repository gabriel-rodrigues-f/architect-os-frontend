import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesma razão de `dashboard-roles.test.tsx`: `<Link>` exige RouterProvider
 * real. Aqui o `to` vira `href`, porque o destino do botão É a asserção.
 */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { Route as DashboardRoute } from "@/routes/index";
import type { AppState, SessionUser } from "@/lib/api";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureState,
} from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 35, achado 1 do dono (literal): "Painel sem ciclo cadastrado mostra
 * seletor vazio → mensagem 'não há ciclos cadastrados' + botão 'Cadastrar
 * ciclo' → tela de ciclos."
 *
 * Antes: o Painel do admin desenhava "Ciclo —" e oito cartões em zero; o da
 * liderança, quatro filas vazias. Nenhum dos dois dizia que o motivo era não
 * existir ciclo nenhum. Só o ramo vazio muda: com ciclo cadastrado, o Painel
 * de cada persona continua o que era.
 */
const fetchMock = vi.fn();

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

const estadoSemCiclo: AppState = { ...fixtureState, cycles: [], activeCycleId: "" };

const MENSAGEM = "Não há ciclos cadastrados";
const BOTAO = "Cadastrar ciclo";

function prepararPainel(user: SessionUser, state: AppState) {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, { user, state });
  renderWithApp(<DashboardPage />, { storeMode: "contexts" });
}

describe("Painel sem nenhum ciclo cadastrado", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    ["admin", fixtureAdminUser],
    ["gestor", fixtureAssignedManagerUser],
    ["tech lead", fixtureAssignedTechLeadUser],
  ])("%s vê a mensagem e o botão que leva a /cycles", async (_papel, user) => {
    prepararPainel(user, estadoSemCiclo);

    expect(await screen.findByText(MENSAGEM)).toBeTruthy();
    const botao = screen.getByRole("link", { name: BOTAO });
    expect(botao.getAttribute("href")).toBe("/cycles");
  });

  it("o admin sem ciclo não vê os cartões de contagem em zero", async () => {
    prepararPainel(fixtureAdminUser, estadoSemCiclo);

    await screen.findByText(MENSAGEM);
    expect(screen.queryByText("PDIs ativos")).toBeNull();
  });

  it("com ciclo cadastrado, o Painel do admin continua o que era — sem a mensagem", async () => {
    prepararPainel(fixtureAdminUser, fixtureState);

    expect(await screen.findByText("Painel de Capacidades de Arquitetura")).toBeTruthy();
    expect(screen.queryByText(MENSAGEM)).toBeNull();
    expect(screen.queryByRole("link", { name: BOTAO })).toBeNull();
  });

  it("com ciclo cadastrado, a liderança continua vendo as pendências — sem a mensagem", async () => {
    prepararPainel(fixtureAssignedManagerUser, fixtureState);

    expect(await screen.findByText("Pendências do Lead")).toBeTruthy();
    expect(screen.queryByText(MENSAGEM)).toBeNull();
  });

  it("o profissional não é chamado a cadastrar ciclo — o Painel dele não muda", async () => {
    prepararPainel(fixtureMemberUser, estadoSemCiclo);

    expect(await screen.findByText("Minha Evolução")).toBeTruthy();
    expect(screen.queryByText(MENSAGEM)).toBeNull();
    expect(screen.queryByRole("link", { name: BOTAO })).toBeNull();
  });
});
