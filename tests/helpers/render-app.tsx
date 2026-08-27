/* eslint-disable react-refresh/only-export-components -- helper de teste; fast refresh não se aplica. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Mock } from "vitest";

import { type AppState, type SessionUser } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { StoreProvider } from "@/lib/store";
import { fixtureAdminUser, fixtureCareerLevels, fixtureState } from "./fixtures";

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

/**
 * RF-05 — o backend envelopa toda resposta 2xx JSON de `/api/*` em
 * `{ data, message? }` e o `api-client` desembrulha. Para os testes seguirem
 * escrevendo payloads crus, o mock envelopa automaticamente; rotas que já
 * devolvem o formato `{ data, ... }` (ex.: para exercitar `message.code`)
 * passam intactas.
 */
async function envelopeApiResponse(response: Response): Promise<Response> {
  if (!response.ok || response.status === 204) return response;
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return response;
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return new Response(text, { status: response.status, headers: response.headers });
  }
  const alreadyEnveloped =
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    Object.prototype.hasOwnProperty.call(body, "data");
  return new Response(JSON.stringify(alreadyEnveloped ? body : { data: body }), {
    status: response.status,
    headers: response.headers,
  });
}

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
    const respond = (response: Response) =>
      href.includes("/api/") ? envelopeApiResponse(response) : Promise.resolve(response);
    for (const route of routes) {
      const response = route(href, init);
      if (response) return respond(response);
    }
    if (href.endsWith("/api/auth/me")) return respond(jsonResponse(user));
    if (href.endsWith("/api/state")) return respond(jsonResponse(state));
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
}

/** Rota de `GET /api/auth/users` vazia — telas de Time/Usuários listam contas. */
export const emptyAuthUsersRoute: FetchRoute = (href) =>
  href.endsWith("/api/auth/users") ? jsonResponse([]) : undefined;

/**
 * Rota de `GET /api/career-levels` com os níveis da fixture (B-24/ADR-0011:
 * careerLevels saiu de `/api/state`) — replicada em vários testes de telas
 * administrativas do catálogo.
 */
export const careerLevelsRoute: FetchRoute = (href) =>
  href.endsWith("/api/career-levels") ? jsonResponse(fixtureCareerLevels) : undefined;

/**
 * Rota pronta para a consulta de elegibilidade vazia (`/eligibility`, telas de
 * Avaliações) — era replicada verbatim em 8 arquivos de teste.
 */
export const emptyEligibilityRoute: FetchRoute = (href) =>
  href.includes("/eligibility")
    ? jsonResponse({ capabilities: [], qualifiedConfirmedCount: 0, eligible: null })
    : undefined;

function AuthReady({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

function AppWrapper({ children }: { children: ReactNode }) {
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
