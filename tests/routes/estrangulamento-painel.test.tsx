import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `dashboard-roles.test.tsx`: `<Link>` exige RouterProvider real. */
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

import { Route as DashboardRoute } from "@/routes/index";
import { apiPath } from "@/lib/api-path";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureState,
  fixtureTeamId,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch, operationsOverviewRoute, renderWithApp } from "../helpers/render-app";

/**
 * ADR-0011, fase 1 — o estrangulamento do `/state` sai do papel: o Painel é
 * consumidor dos endpoints POR CONTEXTO. O invariante tem duas metades,
 * ambas obrigatórias:
 *   1. a tela renderiza o MESMO conteúdo alimentada só pelos contextos
 *      (modo "contexts" do StoreProvider, o que o __root ativa nas rotas
 *      do livro-razão do estrangulamento);
 *   2. NENHUMA requisição a `/api/v1/state` acontece.
 * Nasceu VERMELHO: antes do ContextScope o Painel em modo "contexts"
 * renderizava o estado vazio (metade 1 falhava) — o blob era a única fonte.
 *
 * Revisão de papéis (dono, 2026-09-05, D1): o Painel com NOME de pessoa é o
 * da liderança vinculada (`LeadHome`), e é ele que vive dos contextos. O do
 * admin virou o Painel de operação, alimentado por `/operations/overview` —
 * também sem `/state`.
 */
const fetchMock = vi.fn();

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

const requestedPaths = () =>
  fetchMock.mock.calls.map((call) => (call[0] instanceof Request ? call[0].url : String(call[0])));

describe("estrangulamento fase 1 — o Painel vive sem o blob /state", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renderiza o painel da liderança vinculada pelos contextos, sem nenhuma chamada a /state", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: scopedFixtureStateFor(fixtureAssignedManagerUser, fixtureState, [fixtureTeamId]),
    });
    renderWithApp(<DashboardPage />);

    expect(await screen.findByText("Ações da Liderança")).toBeTruthy();
    // "e1" na fixture: evidência Pending de "ana", título "ADR-014".
    expect((await screen.findAllByText(/Ana Martins/)).length).toBeGreaterThan(0);

    expect(requestedPaths().some((href) => href.endsWith(apiPath("/state")))).toBe(false);
    expect(requestedPaths().some((href) => href.endsWith(apiPath("/architects")))).toBe(true);
  });

  it("D1 (dono, 2026-09-05): o Painel de operação do admin lê /operations/overview, sem /state", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [operationsOverviewRoute],
    });
    renderWithApp(<DashboardPage />);

    expect(await screen.findByText("Visão do Sistema")).toBeTruthy();
    expect(await screen.findByText("Pessoas ativas")).toBeTruthy();

    expect(requestedPaths().some((href) => href.endsWith(apiPath("/state")))).toBe(false);
    expect(requestedPaths().some((href) => href.endsWith(apiPath("/operations/overview")))).toBe(
      true,
    );
  });
});
