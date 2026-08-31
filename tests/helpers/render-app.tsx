/* eslint-disable react-refresh/only-export-components -- helper de teste; fast refresh não se aplica. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Mock } from "vitest";

import { type AppState, type SessionUser } from "@/lib/api";
import { apiPath, isApiUrl } from "@/lib/api-path";
import { AuthProvider, useAuth } from "@/lib/auth";
import { EffectiveCurationPolicy } from "@/lib/curation-policy";
import { I18nProvider } from "@/lib/i18n";
import { StoreProvider, type StoreProviderMode } from "@/lib/store";
import { fixtureAdminUser, fixtureCareerLevels, fixtureState } from "./fixtures";

/**
 * OO3-11/D-7 — o setup replicado nos testes de tela (QueryClient com
 * retry/gcTime zerados + I18nProvider + AuthProvider + StoreProvider, mais
 * o fetch mock que responde `/api/v1/auth/me` e `/api/v1/state`) era a maior
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
 * `undefined` para cair nos padrões (`/api/v1/auth/me`, `/api/v1/state`).
 */
export type FetchRoute = (href: string, init?: RequestInit) => Response | undefined;

/**
 * RF-05 — o backend envelopa toda resposta 2xx JSON de `/api/v1/*` em
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

/**
 * ADR-0011, fase 1 — as telas estranguladas consomem os endpoints por
 * contexto em vez do blob `/state`. Este roteador serve cada contexto a
 * partir da MESMA fixture, aplicando o filtro de querystring que o backend
 * aplica (`architectId`/`menteeId`), para que os testes de tela exercitem a
 * paridade blob ↔ contexto sem duplicar dados.
 */
function stateContextResponse(
  state: AppState,
  href: string,
  init?: RequestInit,
): Response | undefined {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET") return undefined;
  const url = new URL(href, "http://localhost");
  const path = url.pathname;
  const query = url.searchParams;
  const byArchitect = <T extends { architectId: string }>(items: T[]): T[] => {
    const architectId = query.get("architectId");
    return architectId ? items.filter((item) => item.architectId === architectId) : items;
  };
  if (path.endsWith(apiPath("/architects"))) return jsonResponse(state.architects);
  if (path.endsWith(apiPath("/assessments"))) return jsonResponse(byArchitect(state.assessments));
  if (path.endsWith(apiPath("/capabilities"))) return jsonResponse(state.capabilities);
  if (path.endsWith(apiPath("/competencies"))) return jsonResponse(state.competencies);
  if (path.endsWith(apiPath("/cycles"))) return jsonResponse(state.cycles);
  if (path.endsWith(apiPath("/settings/active-cycle")))
    return jsonResponse({ cycleId: state.activeCycleId });
  if (path.endsWith(apiPath("/plans"))) return jsonResponse(byArchitect(state.plans));
  if (path.endsWith(apiPath("/evidences"))) return jsonResponse(byArchitect(state.evidences));
  if (path.endsWith(apiPath("/mentoring-sessions"))) {
    const menteeId = query.get("menteeId");
    return jsonResponse(
      menteeId
        ? state.mentoringSessions.filter((session) => session.menteeId === menteeId)
        : state.mentoringSessions,
    );
  }
  if (path.endsWith(apiPath("/learning-paths"))) {
    const architectId = query.get("architectId");
    return jsonResponse(
      architectId
        ? state.learningPaths.filter((learningPath) =>
            learningPath.assignedTo.includes(architectId),
          )
        : state.learningPaths,
    );
  }
  return undefined;
}

/**
 * CFG-03 — a régua da organização (níveis de carreira, faixas de pontuação,
 * parâmetros operacionais, política de curadoria) deixou de cair no padrão de
 * fábrica quando a rota falha: `StoreProvider` mostra a tela de falha de
 * serviço. O catch-all deste mock devolvia `{}` cru, que os schemas rejeitam —
 * ou seja, TODA tela dos testes rodava com a régua de fábrica por acidente de
 * mock. Estas respostas são VÁLIDAS E VAZIAS: o padrão continua valendo (é o
 * caso "carregou e está vazio"), sem simular indisponibilidade. Quem quer
 * exercitar a falha declara a rota em `routes`.
 */
export function configurationRoute(href: string, init?: RequestInit): Response | undefined {
  if ((init?.method ?? "GET").toUpperCase() !== "GET") return undefined;
  if (href.endsWith(apiPath("/career-levels"))) return jsonResponse([]);
  if (href.endsWith(apiPath("/config/bands"))) return jsonResponse({});
  if (href.endsWith(apiPath("/config/templates"))) return jsonResponse({});
  if (href.endsWith(apiPath("/config/settings"))) return jsonResponse({ settings: [] });
  if (href.endsWith(apiPath("/config/curation-policy")))
    return jsonResponse(EffectiveCurationPolicy.defaults);
  if (href.endsWith(apiPath("/config/vocabularies")))
    return jsonResponse({ EVIDENCE_TYPE: [], LEARNING_ITEM_TYPE: [], ACTION_TYPE: [] });
  return undefined;
}

export function mockAppFetch(
  fetchMock: Mock,
  {
    user = fixtureAdminUser,
    state = fixtureState,
    routes = [],
  }: { user?: SessionUser; state?: AppState; routes?: FetchRoute[] } = {},
): void {
  fetchMock.mockImplementation((input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : undefined;
    const href = request ? request.url : String(input);
    const effectiveInit: RequestInit | undefined = request
      ? { method: request.method, ...init }
      : init;
    const respond = (response: Response) =>
      isApiUrl(href) ? envelopeApiResponse(response) : Promise.resolve(response);
    for (const route of routes) {
      const response = route(href, effectiveInit);
      if (response) return respond(response);
    }
    if (href.endsWith(apiPath("/auth/me"))) return respond(jsonResponse(user));
    if (href.endsWith(apiPath("/state"))) return respond(jsonResponse(state));
    const configuration = configurationRoute(href, effectiveInit);
    if (configuration) return respond(configuration);
    const contextResponse = stateContextResponse(state, href, effectiveInit);
    if (contextResponse) return respond(contextResponse);
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
}

/** Rota de `GET /api/v1/auth/users` vazia — telas de Time/Usuários listam contas. */
export const emptyAuthUsersRoute: FetchRoute = (href) =>
  href.endsWith(apiPath("/auth/users")) ? jsonResponse([]) : undefined;

/**
 * Rota de `GET /api/v1/career-levels` com os níveis da fixture (B-24/ADR-0011:
 * careerLevels saiu de `/api/v1/state`) — replicada em vários testes de telas
 * administrativas do catálogo.
 */
export const careerLevelsRoute: FetchRoute = (href) =>
  href.endsWith(apiPath("/career-levels")) ? jsonResponse(fixtureCareerLevels) : undefined;

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

function AppWrapper({
  children,
  storeMode,
}: {
  children: ReactNode;
  storeMode: StoreProviderMode;
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AuthReady>
            <StoreProvider mode={storeMode}>{children}</StoreProvider>
          </AuthReady>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/** `render` já embrulhado nos providers do app — combine com `mockAppFetch` no `beforeEach`. */
export function renderWithApp(
  ui: ReactNode,
  { storeMode = "blob" }: { storeMode?: StoreProviderMode } = {},
): ReturnType<typeof render> {
  return render(<AppWrapper storeMode={storeMode}>{ui}</AppWrapper>);
}
