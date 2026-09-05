import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ComponentProps, ReactNode } from "react";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/team-rules",
    Link: ({
      children,
      to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { AppShell } from "@/components/app/AppShell";
import { apiPath } from "@/lib/api-path";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { ContextScope } from "@/lib/context-scope";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider } from "@/lib/theme";
import { fixtureAdminUser } from "../../helpers/fixtures";
import { configurationRoute, jsonResponse, mockAppFetch } from "../../helpers/render-app";

/**
 * O CASO DO DONO (2026-09-03), literal: *"sempre ao abrir a aplicação, assim
 * que clico em qualquer um dos menus a tela pisca; a partir de então para de
 * piscar; sempre no primeiro click, não importa qual é a tela"*.
 *
 * Medido no navegador com MutationObserver: 25 ms depois do clique aparece
 * "Carregando dados do time…" e a árvore INTEIRA é trocada — nav e cabeçalho
 * somem junto. Não é recarga de página: é o React trocando tudo.
 *
 * A mecânica da época: a aplicação abria em `/` estrangulada e o primeiro
 * clique para outra rota montava o blob `/state` pela primeira vez;
 * `isPending` ficava true e o `StoreProvider` devolvia `<LoadingState />` NO
 * LUGAR DE TODOS OS FILHOS — com o `AppShell` entre eles. O blob morreu, e o
 * carregamento hoje é o do `<ContextScope>` de cada rota — a mesma tela de
 * espera, no mesmo lugar, e o invariante é o mesmo.
 *
 * O invariante que este teste prende é o da casca, não o da rota: **enquanto
 * o conteúdo carrega — ou falha —, a navegação continua desenhada**. Vale para
 * os DOIS retornos precoces do provedor, o carregamento e a falha de conexão,
 * porque os dois apagavam a tela inteira do mesmo jeito.
 */

const fetchMock = vi.fn();

const CARREGANDO = "Carregando dados do time…";
const ITEM_DO_MENU = "Painel";
const FALHA_DE_CONEXAO = "Não foi possível acessar o serviço";

/** A fatia de contexto que nunca responde: o `<ContextScope>` da rota fica pendente para sempre. */
const estadoQueNuncaChega = () =>
  new Promise<Response>(() => {
    // sem resolve: é o estado "carregando" que o dono viu piscar.
  });

function Casca({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <AppShell>{children}</AppShell>;
}

function App({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <Casca>
              <StoreProvider>
                <ContextScope contexts={["architects"]}>{children}</ContextScope>
              </StoreProvider>
            </Casca>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe("a casca não pisca — carregar o conteúdo não apaga a navegação", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("com a consulta do store PENDENTE, o menu continua no documento", async () => {
    fetchMock.mockImplementation((input: string | URL | Request, init?: RequestInit) => {
      const href = input instanceof Request ? input.url : String(input);
      if (href.endsWith(apiPath("/architects"))) return estadoQueNuncaChega();
      if (href.endsWith(apiPath("/auth/me")))
        return Promise.resolve(jsonResponse({ data: fixtureAdminUser }));
      return Promise.resolve(configurationRoute(href, init) ?? new Response("{}", { status: 200 }));
    });

    render(
      <App>
        <p>conteúdo da rota</p>
      </App>,
    );

    // O carregamento acontece — é ele que apagava tudo.
    expect(await screen.findByText(CARREGANDO)).toBeTruthy();
    // E a casca sobrevive a ele.
    expect(document.querySelector("aside")).not.toBeNull();
    expect(screen.getAllByRole("link", { name: ITEM_DO_MENU }).length).toBeGreaterThan(0);
    expect(screen.queryByText("conteúdo da rota")).toBeNull();
  });

  // A consulta de contexto tem `retry: 1`: o estado de erro só assenta depois
  // da segunda tentativa, ~1s adiante.
  it(
    "com a consulta do store FALHANDO, o menu também continua no documento",
    { timeout: 15_000 },
    async () => {
      fetchMock.mockImplementation((input: string | URL | Request, init?: RequestInit) => {
        const href = input instanceof Request ? input.url : String(input);
        if (href.endsWith(apiPath("/architects")))
          return Promise.resolve(new Response(null, { status: 500 }));
        if (href.endsWith(apiPath("/auth/me")))
          return Promise.resolve(jsonResponse({ data: fixtureAdminUser }));
        return Promise.resolve(
          configurationRoute(href, init) ?? new Response("{}", { status: 200 }),
        );
      });

      render(
        <App>
          <p>conteúdo da rota</p>
        </App>,
      );

      expect(await screen.findByText(FALHA_DE_CONEXAO, {}, { timeout: 10_000 })).toBeTruthy();
      expect(document.querySelector("aside")).not.toBeNull();
      expect(screen.getAllByRole("link", { name: ITEM_DO_MENU }).length).toBeGreaterThan(0);
    },
  );

  it("com o dado no lugar, o conteúdo aparece e a casca segue lá", async () => {
    mockAppFetch(fetchMock);

    render(
      <App>
        <p>conteúdo da rota</p>
      </App>,
    );

    expect(await screen.findByText("conteúdo da rota")).toBeTruthy();
    expect(screen.queryByText(CARREGANDO)).toBeNull();
    expect(document.querySelector("aside")).not.toBeNull();
  });
});

/**
 * A régua estrutural, para a próxima onda não devolver o piscar reordenando
 * dois JSX: em `__root.tsx` o `AppShell` é ANCESTRAL do `StoreProvider`,
 * nunca o contrário. É a montagem que o teste de comportamento acima exercita.
 */
describe("em __root.tsx a casca envolve o store, nunca o inverso", () => {
  const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const ROOT = join(RAIZ, "src", "routes", "__root.tsx");

  function aninhamento(): { cascaPorFora: boolean; storePorFora: boolean } {
    const fonte = ts.createSourceFile(
      ROOT,
      readFileSync(ROOT, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let cascaPorFora = false;
    let storePorFora = false;
    const visitar = (no: ts.Node, dentroDaCasca: boolean, dentroDoStore: boolean): void => {
      const nome = ts.isJsxElement(no) ? no.openingElement.tagName.getText(fonte) : null;
      const casca = dentroDaCasca || nome === "AppShell";
      const store = dentroDoStore || nome === "StoreProvider";
      if (nome === "StoreProvider" && dentroDaCasca) cascaPorFora = true;
      if (nome === "AppShell" && dentroDoStore) storePorFora = true;
      ts.forEachChild(no, (filho) => visitar(filho, casca, store));
    };
    visitar(fonte, false, false);
    return { cascaPorFora, storePorFora };
  }

  it("o StoreProvider está DENTRO do AppShell", () => {
    expect(aninhamento().cascaPorFora).toBe(true);
  });

  it("o AppShell NÃO está dentro do StoreProvider — era essa montagem que piscava", () => {
    expect(aninhamento().storePorFora).toBe(false);
  });
});
