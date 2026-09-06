import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesmo motivo do team-deactivate.test.tsx: sem RouterProvider real, `<Link>` vira âncora comum. */
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
import type { AppState } from "@/lib/api";
import { Route as TeamRoute } from "@/routes/team";
import { fixtureAdminUser, fixtureState, fixtureTeamId } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  emptyAuthUsersRoute,
  type FetchRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
} from "../helpers/render-app";

const fetchMock = vi.fn();
const TeamPage = TeamRoute.options.component as () => ReactNode;

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse([{ id: fixtureTeamId, name: "Integração", active: true }])
    : undefined;

/**
 * Dono (2026-09-06), tela Time: a coluna Time mostra o NOME do time (não o
 * id) e "Senioridade" vira "Posição": time + senioridade para o
 * profissional, "Tech Lead" para o tech lead, "Gerente" para o gerente.
 */
const estado: AppState = {
  ...fixtureState,
  architects: [
    { ...fixtureState.architects[0]!, careerLevelId: "arquiteto-de-solucoes-ii", cargo: "member" },
    { ...fixtureState.architects[1]!, cargo: "tech_lead" },
    {
      ...fixtureState.architects[0]!,
      id: "gerente",
      name: "Gabriela Gerente",
      email: "gerente@company.com",
      role: null,
      careerLevelId: null,
      cargo: "manager",
    },
  ],
};

describe("Time — Posição e nome do time", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: estado,
      routes: [careerLevelsRoute, emptyAuthUsersRoute, rotaDeTimes],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const abrirTabela = async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");
    await userEvent.click(screen.getByRole("button", { name: "Tabela" }));
  };

  const linhaDe = async (nome: string) => {
    const nomeNaTabela = await screen.findByText(nome, { selector: "a" });
    return within(nomeNaTabela.closest("tr") as HTMLTableRowElement);
  };

  it("a coluna se chama Posição e a coluna Time mostra o nome, não o id", async () => {
    await abrirTabela();
    const linha = await linhaDe("Ana Martins");
    expect(screen.getByRole("columnheader", { name: "Posição" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Senioridade" })).toBeNull();
    expect(linha.getByText("Integração")).toBeTruthy();
    expect(linha.queryByText(fixtureTeamId)).toBeNull();
  });

  it("profissional: time + senioridade em romano; tech lead pela posição; o gerente NÃO é listado", async () => {
    await abrirTabela();
    expect((await linhaDe("Ana Martins")).getByText("Integração II")).toBeTruthy();
    expect((await linhaDe("Bruno Almeida")).getByText("Tech Lead")).toBeTruthy();
    // Dono (2026-09-06): "Manager não deveria poder se ver em Time" — o gerente nunca é sujeito.
    expect(screen.queryByText("Gabriela Gerente")).toBeNull();
  });
});
