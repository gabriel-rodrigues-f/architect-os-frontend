import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { setAuthToken, type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * Exercita a Matriz de Competências de verdade: o componente da rota, ligado
 * à store, com `fetch` interceptado — o caminho que o usuário percorre ao
 * clicar na lixeira de um domínio.
 *
 * Excluir domínio/capacidade migrou do Mapa de Capacidades (agora só
 * leitura de risco/cobertura) para a Matriz de Competências, que já é a
 * página administrativa do catálogo — curadoria não deveria viver numa tela
 * de leitura de risco. Ver AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-
 * SYNAPSE.md, EPIC 6.
 *
 * `strongDomain`/`gapDomain` saíram do cadastro de arquiteto (AUDITORIA-
 * TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, Seção 11), então excluir
 * uma capacidade não bloqueia mais por vínculo — só pede confirmação.
 */

const fetchMock = vi.fn();

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
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

/**
 * O app real só monta a árvore autenticada depois do `AuthGate` (em
 * `__root.tsx`) resolver a sessão guardada no navegador. Este teste não passa
 * por ele, então precisa do mesmo corte: sem isto, a tela chamaria
 * `useCurrentUser()` no primeiro render, antes do `AuthProvider` terminar de
 * buscar `/api/auth/me`, e quebraria com "nenhuma sessão ativa".
 */
function AuthReady({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

const renderPage = (state: AppState) => {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (String(url).endsWith("/api/auth/me")) {
      return Promise.resolve(
        new Response(JSON.stringify(fixtureAdminUser), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    if (init?.method === "DELETE")
      return Promise.resolve(
        new Response(JSON.stringify({ competenciesRemoved: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    if (String(url).endsWith("/api/state")) {
      return Promise.resolve(
        new Response(JSON.stringify(state), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  return render(
    <Wrapper>
      <MatrixPage />
    </Wrapper>,
  );
};

describe("Matriz de Competências — exclusão de domínio", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-de-teste");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it("exclui o domínio após confirmar", async () => {
    renderPage(fixtureState);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(screen.getByLabelText("Excluir Cloud Architecture"));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(screen.queryByText("Cloud Architecture")).toBeNull());

    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(deleteCall).toBeDefined();
    expect(String(deleteCall?.[0])).toContain("/api/categories/cloud");
  });

  /**
   * Regressão: o DELETE ia com `content-type: application/json` e sem corpo, e o
   * Fastify respondia 400 (FST_ERR_CTP_EMPTY_JSON_BODY). A store revertia a
   * remoção otimista e a capacidade reaparecia na tela.
   */
  it("não manda content-type em requisição sem corpo", async () => {
    renderPage(fixtureState);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(screen.getByLabelText("Excluir Cloud Architecture"));
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true),
    );

    const bodyless = fetchMock.mock.calls.filter(([, init]) => init?.body === undefined);
    expect(bodyless.length).toBeGreaterThan(0);
    for (const [, init] of bodyless) {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers["content-type"]).toBeUndefined();
    }
  });
});
