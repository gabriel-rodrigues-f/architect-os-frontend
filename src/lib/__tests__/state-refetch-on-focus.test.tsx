import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider, useStore } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * R2-TEC-19 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — `/api/state` é o BFF
 * agregador de todo o app (ADR-0011); o default do React Query
 * (`refetchOnWindowFocus: true`) refazia essa busca INTEIRA toda vez que a
 * janela recuperava o foco depois de `staleTime` vencido, um padrão de uso
 * comum (alternar abas). `refetchOnWindowFocus: false` (`store.tsx`) evita
 * isso — mutations já invalidam a query explicitamente quando precisam.
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

function AuthReady({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

function StoreProbe() {
  const store = useStore();
  return <p>arquitetos:{store.architects.length}</p>;
}

const countStateFetches = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/state")).length;

describe("estado global — não refaz /api/state ao recuperar o foco da janela (R2-TEC-19)", () => {
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
        return Promise.resolve(
          new Response(JSON.stringify(fixtureState), {
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
    vi.useRealTimers();
    // Devolve o focusManager pro modo automático — sem isto, "focused: true"
    // vazaria pros outros arquivos de teste que rodam no mesmo processo.
    focusManager.setFocused(undefined);
  });

  it("recuperar o foco da janela depois do staleTime não dispara um novo fetch de /api/state", async () => {
    render(
      <Wrapper>
        <StoreProbe />
      </Wrapper>,
    );

    await waitFor(() => expect(countStateFetches()).toBe(1));
    await screen.findByText(`arquitetos:${(fixtureState as AppState).architects.length}`);

    /**
     * Só `Date` fica fake (`toFake: ["Date"]`) — `setTimeout`/promises
     * continuam reais, então `waitFor`/fetch mockado seguem funcionando
     * normalmente. Sem isto, o teste passaria mesmo SEM o fix: a query
     * ainda estaria "fresh" (dentro do `staleTime` de 30s de `store.tsx`)
     * no momento do foco, e `refetchOnWindowFocus` só importa quando a
     * query está STALE — teria que ser um falso positivo, não uma prova
     * do comportamento corrigido.
     */
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 31_000));

    // `focusManager.setFocused(true)` é a API que o próprio React Query
    // expõe pra testes: dispara o mesmo caminho que um evento real de
    // `focus`/`visibilitychange` do navegador dispararia, sem depender de
    // `document.hasFocus()` do jsdom (que não reflete foco de verdade).
    focusManager.setFocused(true);

    // Tempo real (setTimeout não é fake aqui) pra qualquer refetch indevido
    // (assíncrono) acontecer antes de afirmar que não houve um segundo fetch.
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(countStateFetches()).toBe(1);
  });
});
