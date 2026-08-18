import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as LearningRoute } from "@/routes/learning-paths";
import { setAuthToken, type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureMemberUser, fixtureState } from "./fixtures";

/**
 * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 12 e 13 — "somente
 * leitura" precisa ser testado contra o componente real, porque foi
 * exatamente um teste que reimplementava a regra em vez de renderizar a
 * tela que deixou passar um slider editável disfarçado de somente leitura.
 * Estes testes renderizam LearningPage de verdade.
 */

const fetchMock = vi.fn();

const state: AppState = {
  ...fixtureState,
  learningPaths: [
    {
      id: "lp-dupla",
      name: "Trilha com duas pessoas",
      description: "",
      competencyIds: [],
      assignedTo: ["ana", "bruno"],
      items: [{ id: "item-1", title: "Curso X", type: "Curso", hours: 4 }],
      progress: [
        { architectId: "ana", itemId: "item-1", status: "In Progress", progress: 40 },
        { architectId: "bruno", itemId: "item-1", status: "Not Started", progress: 0 },
      ],
      createdBy: null,
    },
  ],
};

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

const LearningPage = LearningRoute.options.component as () => ReactNode;

function mockSession(user: typeof fixtureAdminUser | typeof fixtureMemberUser) {
  fetchMock.mockImplementation((url: string) => {
    const href = String(url);
    if (href.endsWith("/api/auth/me")) {
      return Promise.resolve(
        new Response(JSON.stringify(user), {
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
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
}

describe("Trilhas — progresso é por pessoa, não somente leitura disfarçado", () => {
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

  it("member vê a própria linha editável e a de outra pessoa só leitura", async () => {
    mockSession(fixtureMemberUser); // Ana Martins, architectId "ana"
    render(
      <Wrapper>
        <LearningPage />
      </Wrapper>,
    );

    await screen.findByText("Curso X");
    const sliders = screen.getAllByRole("slider");
    // Só a linha da Ana (dona da sessão) tem slider — a do Bruno é só leitura.
    expect(sliders).toHaveLength(1);
    expect(sliders[0]?.getAttribute("aria-label")).toContain("Ana Martins");
  });

  it("mover o próprio slider registra progresso só para essa pessoa, não para a trilha inteira", async () => {
    mockSession(fixtureMemberUser);
    render(
      <Wrapper>
        <LearningPage />
      </Wrapper>,
    );

    await screen.findByText("Curso X");
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "60" } });

    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(String(patches[0]?.[0])).toContain("/api/learning-paths/lp-dupla/progress/ana/item-1");
  });

  it("admin vê as duas linhas editáveis", async () => {
    mockSession(fixtureAdminUser);
    render(
      <Wrapper>
        <LearningPage />
      </Wrapper>,
    );

    await screen.findByText("Curso X");
    expect(screen.getAllByRole("slider")).toHaveLength(2);
  });
});
