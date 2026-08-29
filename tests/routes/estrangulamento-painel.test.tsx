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
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

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
 */
const fetchMock = vi.fn();

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

describe("estrangulamento fase 1 — o Painel vive sem o blob /state", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: fixtureState });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renderiza o painel do admin pelos contextos, sem nenhuma chamada a /state", async () => {
    renderWithApp(<DashboardPage />, { storeMode: "contexts" });

    expect(await screen.findByText("Painel de Capacidades de Arquitetura")).toBeTruthy();
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Bruno Almeida")).length).toBeGreaterThan(0);

    const requestedPaths = fetchMock.mock.calls.map((call) =>
      call[0] instanceof Request ? call[0].url : String(call[0]),
    );
    expect(requestedPaths.some((href) => href.endsWith(apiPath("/state")))).toBe(false);
    expect(requestedPaths.some((href) => href.endsWith(apiPath("/architects")))).toBe(true);
  });
});
