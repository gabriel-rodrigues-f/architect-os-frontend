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
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-43 (§41, Fase 4/5) —
 * a busca livre por nome (B-13, `team-name-search.test.tsx`, removida) foi
 * substituída pela faceta "Arquiteto" (`ArchitectFilter`): mesmo contrato de
 * composição das outras facetas da toolbar (1, n ou todos), nunca texto
 * livre. O teste abaixo cobre exatamente o cenário que a busca resolvia
 * ("achar a Marina" entre vários cards) através do novo mecanismo.
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

describe("Time — filtro de Arquiteto (B-43)", () => {
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

  it("recorta a lista por composição (1 pessoa) e o chip 'Arquiteto' devolve o time inteiro", async () => {
    render(
      <Wrapper>
        <TeamPage />
      </Wrapper>,
    );
    await screen.findByText("Ana Martins");
    expect(screen.getByText("Bruno Almeida")).toBeTruthy();

    // Nasce com todo o time selecionado ("Todo o time (N)"); desmarca tudo,
    // depois marca só a Ana — exatamente o alternador de composição, nunca
    // um campo de texto livre.
    await userEvent.click(screen.getByLabelText("Arquiteto"));
    await userEvent.click(screen.getByRole("button", { name: "Todo o time" }));
    await userEvent.click(await screen.findByRole("option", { name: "Ana Martins" }));
    await userEvent.keyboard("{Escape}");

    // A partir daqui o próprio gatilho do filtro também mostra "Ana Martins"
    // (resumo de 1 selecionada) — duas ocorrências do texto confirmam que o
    // card continua lá, não só o resumo do gatilho.
    await waitFor(() => expect(screen.queryByText("Bruno Almeida")).toBeNull());
    expect(screen.getAllByText("Ana Martins")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: /Arquiteto: Ana Martins/ }));

    expect(await screen.findByText("Bruno Almeida")).toBeTruthy();
    expect(screen.getByText("Ana Martins")).toBeTruthy();
  });

  it("não existe mais campo de busca por texto livre na toolbar", async () => {
    render(
      <Wrapper>
        <TeamPage />
      </Wrapper>,
    );
    await screen.findByText("Ana Martins");
    expect(screen.queryByLabelText("Buscar por nome")).toBeNull();
  });
});
