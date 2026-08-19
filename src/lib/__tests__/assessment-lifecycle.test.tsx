import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { setAuthToken, type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureMemberUser, fixtureState } from "./fixtures";

/**
 * PLANO-360-AGENTES-SYNAPSE.md, Seção 9 e 39 — o campo certo precisa nascer
 * desabilitado para o papel errado, não só ser rejeitado depois pelo backend.
 * Espelha, na tela, o que `assessments.ts` (backend) já impõe na API.
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

function mockSession(user: typeof fixtureAdminUser | typeof fixtureMemberUser, state: AppState) {
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

describe("Avaliações — campos por papel e status", () => {
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

  // A avaliação ativa de Ana ("ana-h2") é Draft — a única a que ela é dona.
  const draftState: AppState = {
    ...fixtureState,
    assessments: fixtureState.assessments.map((a) =>
      a.id === "ana-h2" ? { ...a, status: "Draft" } : a,
    ),
  };

  // Mesma avaliação, já enviada para revisão.
  const inReviewState: AppState = {
    ...fixtureState,
    assessments: fixtureState.assessments.map((a) =>
      a.id === "ana-h2" ? { ...a, status: "In Review" } : a,
    ),
  };

  it("member vê a autoavaliação editável (Rascunho) e a nota do Tech Lead travada", async () => {
    mockSession(fixtureMemberUser, draftState);
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    const selects = linha.querySelectorAll("select");
    // Só a coluna de autoavaliação continua <select>; alvo, líder e final viram texto.
    expect(selects).toHaveLength(1);
    expect(selects[0]?.value).toBe("4"); // self de "cloud-k8s" em ana-h2, na fixture

    expect(screen.getByRole("button", { name: "Enviar para revisão" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Concluir avaliação" })).toBeNull();
  });

  // AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 2 — a autoavaliação
  // congela assim que sai do Rascunho; a pessoa não pode mais ajustá-la
  // enquanto o Tech Lead revisa.
  it("member não edita mais a autoavaliação depois de Em Revisão", async () => {
    mockSession(fixtureMemberUser, inReviewState);
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(linha.querySelectorAll("select")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Enviar para revisão" })).toBeNull();
  });

  // Seção 4 — líder/final ainda não abrem enquanto a avaliação está em
  // Rascunho, mesmo para o administrador.
  it("admin não edita líder nem final enquanto ainda é Rascunho", async () => {
    mockSession(fixtureAdminUser, draftState);
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(linha.querySelectorAll("select")).toHaveLength(0);
    // Seção 3 — nem administrador pode concluir direto do Rascunho.
    expect(screen.queryByRole("button", { name: "Concluir avaliação" })).toBeNull();
  });

  it("admin (Tech Lead) vê líder e final editáveis quando Em Revisão", async () => {
    mockSession(fixtureAdminUser, inReviewState);
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    const selects = linha.querySelectorAll("select");
    // Líder e final continuam <select>; autoavaliação e alvo viram texto.
    expect(selects).toHaveLength(2);

    expect(screen.getByRole("button", { name: "Concluir avaliação" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enviar para revisão" })).toBeNull();
  });

  it("avaliação concluída: nenhum campo editável para ninguém", async () => {
    // "ana-h2" já é Completed na fixture original — sem sobrescrever o status.
    mockSession(fixtureAdminUser, fixtureState);
    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    expect(linha.querySelectorAll("select")).toHaveLength(0);
    expect(await screen.findByText(/somente leitura/)).toBeTruthy();
  });

  // Correção pedida pelo usuário — depois de concluída, o Tech Lead precisa
  // conseguir reabrir a avaliação (Completed → In Review) e concluí-la de
  // novo, em vez de ficar travada para sempre.
  it("admin reabre avaliação concluída e volta a concluir depois", async () => {
    const completedAssessment = fixtureState.assessments.find((a) => a.id === "ana-h2")!;

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
      if (init?.method === "PATCH" && href.endsWith("/api/assessments/ana-h2/status")) {
        const body = JSON.parse(String(init.body)) as { status: string };
        return Promise.resolve(
          new Response(JSON.stringify({ ...completedAssessment, status: body.status }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith("/api/state")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureState satisfies AppState), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    render(
      <Wrapper>
        <AssessmentsPage />
      </Wrapper>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Reabrir avaliação" }));

    expect(await screen.findByRole("button", { name: "Concluir avaliação" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reabrir avaliação" })).toBeNull();

    const linha = (await screen.findByText("Kubernetes")).closest("tr")!;
    // Reaberta (In Review), líder e final voltam a ser <select> editável.
    expect(linha.querySelectorAll("select")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Concluir avaliação" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Concluir avaliação" })).toBeNull(),
    );
    expect(await screen.findByRole("button", { name: "Reabrir avaliação" })).toBeTruthy();
  });
});
