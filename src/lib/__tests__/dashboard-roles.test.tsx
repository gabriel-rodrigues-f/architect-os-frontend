import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de team-deactivate.test.tsx: `<Link>` exige RouterProvider real. */
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
import { type AppState, type SessionUser } from "../api";
import { AuthProvider } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureMemberUser, fixtureState } from "./fixtures";

/**
 * FASE 2 (quinta rodada) — "homes distintas Member/Lead/Admin": antes, todo
 * mundo via a mesma visão executiva de time, mesmo enxergando só uma fatia
 * dos registros (roster é dado de diretório, sem filtro; assessments/PDIs/
 * evidências, sim). Member vê "Minha Evolução" (agenda pessoal); Lead vê
 * "Pendências do Lead" (fila do que depende de uma decisão dele); Admin
 * mantém a visão executiva original. Ver AUDITORIA-QUINTA-RODADA-360-
 * SYNAPSE-2026-08-19.md, Seção 7 e 33.
 */

const fetchMock = vi.fn();

const fixtureLeadOfAna: SessionUser = {
  id: "test-lead-de-ana",
  email: "lead-de-ana@company.com",
  name: "Lead de Ana",
  role: "lead",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <StoreProvider>{children}</StoreProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

function renderAs(user: SessionUser, state: AppState = fixtureState) {
  fetchMock.mockImplementation((url: string) => {
    const href = String(url);
    if (href.endsWith("/api/auth/me")) {
      return Promise.resolve(
        new Response(JSON.stringify(user), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    if (href.endsWith("/api/state")) {
      return Promise.resolve(
        new Response(JSON.stringify(state satisfies AppState), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  return render(
    <Wrapper>
      <DashboardPage />
    </Wrapper>,
  );
}

describe("Painel — Home por papel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("admin vê a visão executiva de time (inalterada)", async () => {
    renderAs(fixtureAdminUser);
    await screen.findByText("Painel de Capacidades de Arquitetura");
    expect(screen.getByText("Arquitetos")).toBeTruthy();
  });

  it("member vê 'Minha Evolução', não a visão de time", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Minha Evolução");
    expect(screen.queryByText("Painel de Capacidades de Arquitetura")).toBeNull();
    expect(screen.queryByText("Arquitetos")).toBeNull();
    expect(await screen.findByText("Meu PDI")).toBeTruthy();
  });

  it("member sem architectId vinculado vê o estado de conta não vinculada", async () => {
    const unlinked: SessionUser = { ...fixtureMemberUser, architectId: null };
    renderAs(unlinked);
    await screen.findByText("Minha Evolução");
    expect(
      await screen.findByText("Sua conta ainda não está vinculada a um perfil profissional"),
    ).toBeTruthy();
  });

  it("lead sem pessoa atribuída vê o estado vazio, não a visão de time", async () => {
    renderAs(fixtureLeadOfAna);
    await screen.findByText("Pendências do Lead");
    expect(screen.queryByText("Painel de Capacidades de Arquitetura")).toBeNull();
    expect(await screen.findByText("Nenhuma pessoa sob sua liderança ainda")).toBeTruthy();
  });

  it("lead com pessoa atribuída vê a evidência Pending dela na fila", async () => {
    const state: AppState = {
      ...fixtureState,
      architects: fixtureState.architects.map((a) =>
        a.id === "ana" ? { ...a, leadUserId: fixtureLeadOfAna.id } : a,
      ),
    };
    renderAs(fixtureLeadOfAna, state);
    await screen.findByText("Pendências do Lead");
    // "e1" na fixture: evidência Pending de "ana", título "ADR-014".
    expect(await screen.findByText(/ADR-014/)).toBeTruthy();
  });
});
