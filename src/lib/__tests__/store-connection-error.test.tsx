import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de outros testes de página: `<Link>` exige RouterProvider real. */
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
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser } from "./fixtures";

/**
 * REVISAO-360-FRONTEND-UI-UX-ENTERPRISE-SYNAPSE-2026-08-22.md, FE-360-012
 * (P2) — a tela de "não consegui carregar" não pode instruir quem usa o
 * produto a rodar `docker compose` ou conferir `VITE_API_URL`. Isso é
 * instrução de desenvolvedor vazando pra tela de um usuário enterprise; o
 * detalhe técnico só pode aparecer em build de desenvolvimento.
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

describe("Tela de conexão indisponível — sem instrução de desenvolvedor em produção", () => {
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
      if (href.endsWith("/api/state")) {
        return Promise.resolve(new Response("erro interno", { status: 500 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("em produção, mostra mensagem genérica e nunca 'docker compose'/'VITE_API_URL'", async () => {
    vi.stubEnv("DEV", false);
    render(
      <Wrapper>
        <TeamPage />
      </Wrapper>,
    );

    expect(
      await screen.findByText("Não foi possível acessar o serviço", {}, { timeout: 5000 }),
    ).toBeTruthy();
    expect(screen.queryByText(/docker compose/i)).toBeNull();
    expect(screen.queryByText(/VITE_API_URL/)).toBeNull();
    expect(screen.getByRole("button", { name: "Recarregar" })).toBeTruthy();
  });
});
