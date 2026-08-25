import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as LearningRoute } from "@/routes/learning-paths";
import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * R2-UX-12 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — "Nova trilha" troca o
 * input solto no cabeçalho + "Criar trilha" em 2 tempos (nome sozinho,
 * depois reabrir "Editar" pra completar) por um único botão que abre um
 * modal já com nome, descrição, competências e atribuições.
 */

const fetchMock = vi.fn();

const state: AppState = { ...fixtureState, learningPaths: [] };

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

describe("Trilhas — criação via modal (mata os 2 tempos)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith("/api/learning-paths") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return Promise.resolve(
          new Response(JSON.stringify({ ...body, id: "lp-nova" }), {
            status: 201,
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
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("botão 'Nova trilha' abre modal com nome, descrição, competências e atribuições", async () => {
    render(
      <Wrapper>
        <LearningPage />
      </Wrapper>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Nova trilha" }));

    expect(screen.getByRole("heading", { name: "Nova trilha" })).toBeTruthy();
    expect(screen.getByLabelText("Nome")).toBeTruthy();
    expect(screen.getByLabelText("Descrição")).toBeTruthy();
    expect(screen.getByText("Competências")).toBeTruthy();
    expect(screen.getByText("Atribuída a")).toBeTruthy();
  });

  it("criar com nome, descrição e competência marcada envia tudo num POST só", async () => {
    render(
      <Wrapper>
        <LearningPage />
      </Wrapper>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Nova trilha" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Trilha de Observabilidade");
    await userEvent.type(screen.getByLabelText("Descrição"), "Métricas, logs e tracing.");
    const primeiraCompetencia = fixtureState.competencies[0];
    await userEvent.click(screen.getByText(primeiraCompetencia!.name));
    await userEvent.click(screen.getByRole("button", { name: "Criar trilha" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith("/api/learning-paths") && (init as RequestInit)?.method === "POST",
        ),
      ).toBe(true),
    );
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/api/learning-paths") && (init as RequestInit)?.method === "POST",
    ) as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toMatchObject({
      name: "Trilha de Observabilidade",
      description: "Métricas, logs e tracing.",
      competencyIds: [primeiraCompetencia!.id],
      items: [],
    });

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Nova trilha" })).toBeNull());
  });
});
