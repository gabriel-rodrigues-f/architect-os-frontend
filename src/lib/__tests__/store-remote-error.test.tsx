import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown }) => <a {...rest}>{children}</a>,
  };
});

import { Toaster } from "@/components/ui/sonner";
import { Route as TeamRoute } from "@/routes/team";
import { setAuthToken, type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * EPIC L — Trustworthy mutations: uma escrita otimista que falha no servidor
 * não pode voltar em silêncio. Antes, `remote()` só dava `console.error` e
 * revalidava — a tela corrigia sozinha, mas ninguém via aviso nenhum de que
 * a ação não tinha ido para o banco. Ver AUDITORIA-TERCEIRA-RODADA-
 * RECONSTRUCAO-PRODUTO-SYNAPSE.md.
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
            <Toaster theme="light" position="bottom-right" duration={3000} />
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

describe("store.remote — erro do servidor não fica em silêncio", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-de-teste");

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
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
      // O servidor recusa a desativação — simula uma regra de negócio.
      if (init?.method === "PATCH" && href.includes("/api/architects/")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: "Conflict", message: "Não é possível desativar agora." }),
            { status: 409, headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it("desativar que falha no servidor mostra a mensagem de erro e mantém a pessoa ativa", async () => {
    render(
      <Wrapper>
        <TeamPage />
      </Wrapper>,
    );
    const nome = fixtureState.architects[0]!.name;
    await screen.findByText(nome);

    await userEvent.click(screen.getByLabelText(`Desativar ${nome}`));
    await userEvent.click(await screen.findByRole("button", { name: "Desativar" }));

    expect(await screen.findByText("Não é possível desativar agora.")).toBeTruthy();

    // A revalidação devolve o estado real do servidor — a pessoa continua ativa.
    await waitFor(() => expect(screen.getAllByText(nome).length).toBeGreaterThan(0));
  });
});
