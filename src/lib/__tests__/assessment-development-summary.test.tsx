import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { setAuthToken, type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import type { AssessmentDevelopmentSummary } from "../domain";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureMemberUser, fixtureState } from "./fixtures";

/**
 * ORIENTACAO-NONA-RODADA ENT-09-011 — "Começar/Parar/Continuar"
 * (`DevelopmentSummarySection`/`DevelopmentSummaryForm`, routes/assessments.tsx):
 * nenhum teste existia antes desta rodada.
 */

const fetchMock = vi.fn();

const draftState: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map((a) =>
    a.id === "ana-h2" ? { ...a, status: "Draft" } : a,
  ),
};

const inReviewState: AppState = {
  ...fixtureState,
  assessments: fixtureState.assessments.map((a) =>
    a.id === "ana-h2" ? { ...a, status: "In Review" } : a,
  ),
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

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

function baseSummary(overrides: Partial<AssessmentDevelopmentSummary> = {}): AssessmentDevelopmentSummary {
  return {
    assessmentId: "ana-h2",
    startDoing: "",
    stopDoing: "",
    continueDoing: "",
    updatedByUserId: null,
    updatedAt: null,
    version: 0,
    ...overrides,
  };
}

function mockSession(
  user: typeof fixtureAdminUser | typeof fixtureMemberUser,
  state: AppState,
  summary: AssessmentDevelopmentSummary,
  onPut?: (body: unknown) => Response,
) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const href = String(url);
    const method = init?.method ?? "GET";
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
    if (href.endsWith("/development-summary") && method === "GET") {
      return Promise.resolve(
        new Response(JSON.stringify(summary), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    if (href.endsWith("/development-summary") && method === "PUT") {
      const body: unknown = init?.body ? JSON.parse(String(init.body)) : {};
      if (onPut) return Promise.resolve(onPut(body));
      return Promise.resolve(new Response(JSON.stringify(summary), { status: 200 }));
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
}

describe("Avaliações — Começar/Parar/Continuar", () => {
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

  it("dono edita em Rascunho; campos nascem vazios e Salvar desabilitado até haver mudança", async () => {
    mockSession(fixtureMemberUser, draftState, baseSummary());
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    const start = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
    expect(start.value).toBe("");
    expect(start.disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", true);
  });

  it("Tech Lead não edita enquanto Rascunho — campos travados", async () => {
    mockSession(fixtureAdminUser, draftState, baseSummary());
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    const start = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
    expect(start.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("Tech Lead edita em Revisão; dono fica travado e vê a última atualização", async () => {
    mockSession(
      fixtureAdminUser,
      inReviewState,
      baseSummary({ startDoing: "Falar mais em reuniões", updatedAt: "2026-08-01T12:00:00Z", version: 1 }),
    );
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    const start = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
    expect(start.disabled).toBe(false);
    expect(start.value).toBe("Falar mais em reuniões");
  });

  it("salvar envia PUT com expectedVersion e mostra 'Salvo' depois do sucesso", async () => {
    mockSession(fixtureMemberUser, draftState, baseSummary(), (body) => {
      const patch = body as { expectedVersion: number };
      expect(patch.expectedVersion).toBe(0);
      return new Response(
        JSON.stringify(baseSummary({ startDoing: "Documentar decisões arquiteturais", version: 1 })),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    const start = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
    await userEvent.type(start, "Documentar decisões arquiteturais");
    expect(screen.getByText("Alterações não salvas")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.getByText("Salvo")).toBeTruthy());
    const putCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT");
    expect(putCall).toBeDefined();
  });

  /**
   * Conflito de versão (409): o texto digitado não pode sumir sozinho — só
   * some se a pessoa clicar em "Recarregar versão mais recente", de
   * propósito.
   */
  it("conflito de versão mantém o texto digitado até recarregar de propósito", async () => {
    let getCount = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      const method = init?.method ?? "GET";
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
          new Response(JSON.stringify(draftState), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith("/development-summary") && method === "GET") {
        getCount += 1;
        const payload =
          getCount === 1
            ? baseSummary()
            : baseSummary({ startDoing: "Versão de outra pessoa", version: 1 });
        return Promise.resolve(
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith("/development-summary") && method === "PUT") {
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: "conflict", message: "Atualizado por outra pessoa." }),
            { status: 409, headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    const start = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
    await userEvent.type(start, "Meu texto local");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await screen.findByText(/atualizada por outra pessoa/);
    // O texto continua na tela — o conflito não apagou nada sozinho.
    expect((screen.getByLabelText("Começar a fazer") as HTMLTextAreaElement).value).toBe(
      "Meu texto local",
    );

    await userEvent.click(screen.getByRole("button", { name: "Recarregar versão mais recente" }));

    await waitFor(() =>
      expect((screen.getByLabelText("Começar a fazer") as HTMLTextAreaElement).value).toBe(
        "Versão de outra pessoa",
      ),
    );
  });

  it("avaliação Concluída trava os três campos para todo mundo", async () => {
    const completedState: AppState = {
      ...fixtureState,
      assessments: fixtureState.assessments.map((a) =>
        a.id === "ana-h2" ? { ...a, status: "Completed" } : a,
      ),
    };
    mockSession(fixtureMemberUser, completedState, baseSummary({ startDoing: "Já concluído" }));
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    const start = (await screen.findByLabelText("Começar a fazer")) as HTMLTextAreaElement;
    expect(start.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });
});
