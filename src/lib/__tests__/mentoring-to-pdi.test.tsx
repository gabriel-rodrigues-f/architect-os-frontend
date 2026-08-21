import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { setAuthToken, type AppState, type SessionUser } from "../api";
import { AuthProvider } from "../auth";
import type { MentoringSession } from "../domain";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureState } from "./fixtures";

/**
 * EPIC J — Mentoring Loop: "ações" da sessão viravam texto morto — ninguém
 * transformava em item de PDI de verdade. O botão só aparece quando dá para
 * criar o item sem inventar nível (a competência da sessão precisa ter gap
 * já avaliado — ver `bruno-h2` na fixture, onde `cloud-k8s` tem final 2,
 * alvo 3). Ver AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md.
 */

const fetchMock = vi.fn();

const usuario: SessionUser = {
  id: "u1",
  email: "gabriel@company.com",
  name: "Gabriel Rodrigues",
  role: "admin",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const sessaoComGap: MentoringSession = {
  id: "m-com-gap",
  mentor: "Gabriel Rodrigues",
  menteeId: "bruno",
  date: "2026-08-01",
  durationMin: 60,
  topic: "Aprofundar Kubernetes",
  competencyIds: ["cloud-k8s"],
  notes: "Revisamos operadores customizados.",
  decisions: "Vai propor um PoC de operador.",
  actions: "Escrever o operador de exemplo até a próxima sessão.",
};

const sessaoSemGap: MentoringSession = {
  id: "m-sem-gap",
  mentor: "Gabriel Rodrigues",
  menteeId: "bruno",
  date: "2026-08-02",
  durationMin: 30,
  topic: "Competência nunca avaliada",
  competencyIds: [], // sem competência vinculada — nada para converter
  notes: "n",
  decisions: "d",
  actions: "Ação sem competência associada",
};

const state: AppState = {
  ...fixtureState,
  mentoringSessions: [sessaoComGap, sessaoSemGap],
};

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>
          <StoreProvider>{children}</StoreProvider>
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

describe("Mentoria — converter ação em item de PDI", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("token-de-teste");

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(usuario), {
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
      if (init?.method === "POST" && href.includes("/api/plans/")) {
        return Promise.resolve(new Response("{}", { status: 201 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it("mostra o botão só na sessão com competência já avaliada", async () => {
    render(
      <Wrapper>
        <MentoringPage />
      </Wrapper>,
    );
    await screen.findByText("Aprofundar Kubernetes");

    expect(screen.getByRole("button", { name: /Criar ação no PDI/ })).toBeTruthy();
    // a segunda sessão não tem competência vinculada — sem botão para ela.
    expect(screen.getAllByRole("button", { name: /Criar ação no PDI/ })).toHaveLength(1);
  });

  /**
   * ORIENTACAO-NONA-RODADA, Seção 4/12 (ENT-09-001/006) — único caminho é
   * `/from-gap`: o cliente referencia `assessmentId`/`competencyId`, nunca
   * calcula ou envia `currentLevel`/`targetLevel`/`priority` — o servidor
   * deriva os três a partir do assessment oficial.
   */
  it("clicar chama /from-gap referenciando o assessment oficial, sem inventar nível/prioridade", async () => {
    render(
      <Wrapper>
        <MentoringPage />
      </Wrapper>,
    );
    await screen.findByText("Aprofundar Kubernetes");
    await userEvent.click(screen.getByRole("button", { name: /Criar ação no PDI/ }));

    const postToPlans = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/api/plans/") && init?.method === "POST",
    );
    expect(postToPlans).toBeDefined();
    expect(String(postToPlans?.[0])).toContain("/from-gap");
    const body = JSON.parse(String(postToPlans?.[1]?.body)) as Record<string, unknown>;
    expect(body["competencyId"]).toBe("cloud-k8s");
    expect(body["actionType"]).toBe("Mentor");
    expect(body["assessmentId"]).toBeTruthy();
    expect(body).not.toHaveProperty("currentLevel");
    expect(body).not.toHaveProperty("targetLevel");
    expect(body).not.toHaveProperty("priority");
  });
});
