/* eslint-disable react-refresh/only-export-components -- helper de teste; fast refresh não se aplica. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Mock } from "vitest";

import { type AppState, type SessionUser } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * OO3-11/D-7 — o setup replicado nos testes de tela (QueryClient com
 * retry/gcTime zerados + I18nProvider + AuthProvider + StoreProvider, mais
 * o fetch mock que responde `/api/auth/me` e `/api/state`) era a maior
 * duplicação do repositório em linhas absolutas (~40 linhas × 46 arquivos).
 * Este helper NÃO é coletado pelo Vitest (não termina em `.test.tsx`).
 *
 * Escopo desta onda: só os testes tocados pelo OO3-11 migraram — os demais
 * ficam para um item de higiene próprio (Big Bang é proibido pela onda).
 *
 * O mock de `<Link>` do TanStack Router NÃO mora aqui de propósito:
 * `vi.mock` é içado por arquivo e só os testes que renderizam `<Link>`
 * precisam dele — cada um mantém o seu bloco.
 */

/** Resposta JSON no formato que `api-client` espera. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Rota extra do mock: devolve uma `Response` para tratar a chamada, ou
 * `undefined` para cair nos padrões (`/api/auth/me`, `/api/state`).
 */
export type FetchRoute = (href: string, init?: RequestInit) => Response | undefined;

export function mockAppFetch(
  fetchMock: Mock,
  {
    user = fixtureAdminUser,
    state = fixtureState,
    routes = [],
  }: { user?: SessionUser; state?: AppState; routes?: FetchRoute[] } = {},
): void {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const href = String(url);
    for (const route of routes) {
      const response = route(href, init);
      if (response) return Promise.resolve(response);
    }
    if (href.endsWith("/api/auth/me")) return Promise.resolve(jsonResponse(user));
    if (href.endsWith("/api/state")) return Promise.resolve(jsonResponse(state));
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
}

function AuthReady({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

export function AppWrapper({ children }: { children: ReactNode }) {
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

/** `render` já embrulhado nos providers do app — combine com `mockAppFetch` no `beforeEach`. */
export function renderWithApp(ui: ReactNode): ReturnType<typeof render> {
  return render(<AppWrapper>{ui}</AppWrapper>);
}
