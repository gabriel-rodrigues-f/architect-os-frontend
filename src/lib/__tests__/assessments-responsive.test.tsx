import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureMemberUser, fixtureState } from "./fixtures";

/**
 * R2-RESP-07 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — abaixo de `md` (768px) a
 * tabela de pontuação de `CapabilityAssessmentCard`
 * (`components/app/assessments-shared.tsx`) troca por um bloco empilhado por
 * competência (`data-testid="competency-stacked-list"`), evitando o scroll
 * lateral da tabela de 7 colunas. Mesmo padrão de mock de `matchMedia` usado
 * em `responsiveness.test.tsx` (R2-RESP-06) — jsdom não mede largura real,
 * então o que dá para travar aqui é: dado que `useNarrowViewport(768)`
 * reporta estreito, o empilhado aparece e a tabela não; dado que reporta
 * largo (o padrão em todo o resto da suíte, via `test-setup.ts`), a tabela
 * continua exatamente como antes e o empilhado não é montado.
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

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

function mockSession(state: AppState) {
  fetchMock.mockImplementation((url: string) => {
    const href = String(url);
    if (href.endsWith("/api/auth/me")) {
      return Promise.resolve(
        new Response(JSON.stringify(fixtureMemberUser), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    if (href.endsWith("/api/state")) {
      return Promise.resolve(
        new Response(JSON.stringify(state), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    if (href.includes("/eligibility")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ capabilities: [], qualifiedConfirmedCount: 0, eligible: null }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
}

/** Mesma técnica de mock de `responsiveness.test.tsx` (R2-RESP-06). */
function stubMatchMedia(matchesNarrow: boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("768") ? matchesNarrow : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

describe("R2-RESP-07 — Avaliações: empilhado por competência abaixo de md", () => {
  const draftState: AppState = {
    ...fixtureState,
    assessments: fixtureState.assessments.map((a) =>
      a.id === "ana-h2" ? { ...a, status: "Draft" } : a,
    ),
  };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("abaixo de 768px, mostra o bloco empilhado por competência em vez da tabela", async () => {
    const restoreMatchMedia = stubMatchMedia(true);
    mockSession(draftState);
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    await screen.findByText("Kubernetes");
    expect(screen.getAllByTestId("competency-stacked-card").length).toBeGreaterThan(0);
    expect(screen.queryByRole("table")).toBeNull();

    restoreMatchMedia();
  });

  it("em 768px ou mais, mantém a tabela com scroll lateral, sem o bloco empilhado", async () => {
    const restoreMatchMedia = stubMatchMedia(false);
    mockSession(draftState);
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    await screen.findByText("Kubernetes");
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByTestId("competency-stacked-card")).toBeNull();

    restoreMatchMedia();
  });
});
