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

import { Route as TeamRoute } from "@/routes/team";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * ADR-0011, fase 1 — mesma dupla de invariantes do Painel
 * (`estrangulamento-painel.test.tsx`), agora para /team: a tela renderiza o
 * roster completo alimentada só pelos contextos E nenhuma requisição a
 * `/api/v1/state` acontece. Nasceu VERMELHO: sem o ContextScope, /team em
 * modo "contexts" caía no estado vazio ("Nenhum arquiteto cadastrado").
 */
const fetchMock = vi.fn();

const TeamPage = TeamRoute.options.component as () => ReactNode;

describe("estrangulamento fase 1 — /team vive sem o blob /state", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: fixtureState });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renderiza o roster pelos contextos, sem nenhuma chamada a /state", async () => {
    renderWithApp(<TeamPage />);

    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Bruno Almeida")).length).toBeGreaterThan(0);

    const requestedPaths = fetchMock.mock.calls.map((call) =>
      call[0] instanceof Request ? call[0].url : String(call[0]),
    );
    expect(requestedPaths.some((href) => href.endsWith(apiPath("/state")))).toBe(false);
    expect(requestedPaths.some((href) => href.endsWith(apiPath("/architects")))).toBe(true);
  });
});
