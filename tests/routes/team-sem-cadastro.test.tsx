import { cleanup, screen } from "@testing-library/react";
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
import { Route as TeamRoute } from "@/routes/team";
import { fixtureAdminUser, fixtureState, fixtureTeamId } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  emptyAuthUsersRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * ONDA 37, pedido literal do dono: *"podemos remover a criação do menu de
 * Cadastro de profissionais"* — e, no desdobramento, **Menu Time perde**
 * "Cadastrar profissional", "Editar profissional" e "Desativar
 * profissional"; fica **só** "Mudar time ou nível".
 *
 * A razão de o teste ser de AUSÊNCIA: o botão que sobreviver a esta fatia é
 * uma segunda porta para a mesma pessoa, e é exatamente a duplicidade que o
 * dono mandou acabar ("o que fazemos em Time e em Usuários precisa estar
 * conectado"). Editar continua existindo — em Usuários, sobre a conta.
 *
 * **Reativar fica**, e é decisão declarada: a tela Time é o único lugar com
 * o filtro "Inativos" (a exceção registrada na fatia `inativo-some`), então
 * tirá-la daqui tornaria a desativação irreversível pela interface. O dono
 * listou três botões, e reativar não é um deles.
 */
const fetchMock = vi.fn();

const TeamPage = TeamRoute.options.component as () => ReactNode;

const times = [{ id: fixtureTeamId, name: "Time Plataforma", active: true }];

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(times)
    : undefined;

function renderTeam(state = fixtureState) {
  mockAppFetch(fetchMock, {
    user: fixtureAdminUser,
    state,
    routes: [rotaDeTimes, emptyAuthUsersRoute, careerLevelsRoute],
  });
  return renderWithApp(<TeamPage />);
}

describe("Time perde o cadastro, a edição e a desativação de profissional", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("não há mais botão de cadastrar profissional no cabeçalho", async () => {
    renderTeam();
    await screen.findByText("Ana Martins");
    expect(screen.queryByRole("button", { name: "Cadastrar profissional" })).toBeNull();
  });

  it("a linha da pessoa não oferece editar nem desativar", async () => {
    renderTeam();
    await screen.findByText("Ana Martins");
    expect(screen.queryByRole("button", { name: /^Editar Ana Martins$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Desativar Ana Martins$/ })).toBeNull();
  });

  it("a linha da pessoa continua oferecendo mudar time ou nível", async () => {
    renderTeam();
    await screen.findByText("Ana Martins");
    expect(screen.getByRole("button", { name: "Mudar time ou nível de Ana Martins" })).toBeTruthy();
  });

  it("o vazio aponta para Usuários, que é onde a pessoa nasce", async () => {
    renderTeam({ ...fixtureState, architects: [] });
    expect(await screen.findByText("Nenhuma pessoa cadastrada")).toBeTruthy();
    const atalho = await screen.findByRole("link", {
      name: "Cadastre a primeira pessoa em Usuários",
    });
    expect(atalho.getAttribute("href")).toBe("/users");
  });
});

describe("nenhuma tela de Time fala em especialização da pessoa", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o filtro e a coluna de Especialização saíram do roster", async () => {
    renderTeam();
    await screen.findByText("Ana Martins");
    expect(screen.queryByText("Especialização")).toBeNull();
    expect(screen.queryByText("Especialização principal")).toBeNull();
  });
});
