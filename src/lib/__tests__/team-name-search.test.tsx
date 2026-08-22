import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

import { Route as TeamRoute } from "@/routes/team";
import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1-12/B-13 — "achar a
 * Marina" entre dezenas de cards não tinha como ser resolvido pelos filtros
 * de composição por caixinha (Status/Papel/Especialização/Capacidade); o
 * `DataViewToolbar` já tinha um campo de busca pronto, só não conectado.
 */
const fetchMock = vi.fn();

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AuthReady>
            <StoreProvider>{children}</StoreProvider>
          </AuthReady>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function AuthReady({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

const TeamPage = TeamRoute.options.component as () => ReactNode;

describe("Time — busca por nome", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockImplementation((url: string) => {
      const href = String(url);
      if (href.endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith("/api/auth/users")) {
        return Promise.resolve(
          new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
        );
      }
      if (href.endsWith("/api/state")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureState satisfies AppState), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("filtra a lista pelo nome digitado e o chip 'Buscar por nome' limpa a busca", async () => {
    render(
      <Wrapper>
        <TeamPage />
      </Wrapper>,
    );
    await screen.findByText("Ana Martins");
    expect(screen.getByText("Bruno Almeida")).toBeTruthy();

    await userEvent.type(screen.getByLabelText("Buscar por nome"), "ana");

    await waitFor(() => expect(screen.queryByText("Bruno Almeida")).toBeNull());
    expect(screen.getByText("Ana Martins")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: /Buscar por nome: ana/ }));

    expect(await screen.findByText("Bruno Almeida")).toBeTruthy();
    expect(screen.getByText("Ana Martins")).toBeTruthy();
  });
});
