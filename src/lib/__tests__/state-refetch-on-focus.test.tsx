import { focusManager } from "@tanstack/react-query";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AppState } from "../api";
import { useStore } from "../store";
import { fixtureState } from "./fixtures";
import { mockAppFetch, renderWithApp } from "./render-app";

/**
 * R2-TEC-19 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — `/api/state` é o BFF
 * agregador de todo o app (ADR-0011); o default do React Query
 * (`refetchOnWindowFocus: true`) refazia essa busca INTEIRA toda vez que a
 * janela recuperava o foco depois de `staleTime` vencido, um padrão de uso
 * comum (alternar abas). `refetchOnWindowFocus: false` (`store.tsx`) evita
 * isso — mutations já invalidam a query explicitamente quando precisam.
 */

const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

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
    mockAppFetch(fetchMock);
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
    renderWithApp(<StoreProbe />);

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
