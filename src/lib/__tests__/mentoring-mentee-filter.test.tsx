import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { type AppState, type SessionUser } from "../api";
import { AuthProvider } from "../auth";
import type { Architect, MentoringSession } from "../domain";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureState } from "./fixtures";

/**
 * R2-UX-11 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — mentoria é sempre 1:1, então
 * o filtro da linha do tempo troca seleção múltipla (`ArchitectFilter`) por
 * único. Pedido do usuário revisando o app rodando: "em 'mentoria' não deve
 * haver a opção de 'todo time'. a sessão é sempre individual" — a opção
 * "Todo o time" foi removida por completo; o filtro nasce já escolhendo a
 * primeira pessoa ativa em ordem alfabética, nunca "todo mundo". Inativos
 * continuam aparecendo na lista (com sufixo) porque o histórico de mentoria
 * de quem saiu do time permanece consultável, mesma filosofia de R2-UX-08.
 */

const fetchMock = vi.fn();

const admin: SessionUser = {
  id: "admin-1",
  email: "admin@company.com",
  name: "Admin",
  role: "admin",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const carla: Architect = {
  id: "carla",
  name: "Carla Nunes",
  role: "Arquiteto de Soluções I",
  yearsAsArchitect: 2,
  specialization: "",
  email: "carla@company.com",
  active: false,
  version: 1,
};

const sessaoAna: MentoringSession = {
  id: "m-ana",
  mentor: "Admin",
  mentorUserId: "admin-1",
  menteeId: "ana",
  date: "2026-08-01",
  durationMin: 30,
  topic: "Sessão com Ana",
  competencyIds: [],
  notes: "n",
  decisions: "d",
  actions: "a",
};

const sessaoCarla: MentoringSession = {
  id: "m-carla",
  mentor: "Admin",
  mentorUserId: "admin-1",
  menteeId: "carla",
  date: "2026-07-01",
  durationMin: 30,
  topic: "Sessão com Carla",
  competencyIds: [],
  notes: "n",
  decisions: "d",
  actions: "a",
};

const state: AppState = {
  ...fixtureState,
  architects: [...fixtureState.architects, carla],
  mentoringSessions: [sessaoAna, sessaoCarla],
};

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <StoreProvider>{children}</StoreProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

describe("Mentoria — filtro de mentorado (seleção única)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((url: string) => {
      const href = String(url);
      const body = href.endsWith("/api/auth/me") ? admin : state;
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("nasce escolhendo a primeira pessoa ativa em ordem alfabética, nunca 'Todo o time'", async () => {
    render(
      <Wrapper>
        <MentoringPage />
      </Wrapper>,
    );

    // Ana Martins (ativa) vem antes de Bruno Almeida (ativo, sem sessão) e de
    // Carla Nunes (inativa) em ordem alfabética — é o default esperado.
    expect(await screen.findByText("Sessão com Ana")).toBeTruthy();
    expect(screen.queryByText("Sessão com Carla")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Filtrar mentorado" }).textContent).toContain(
      "Ana Martins",
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Filtrar mentorado" }));
    expect(screen.queryByText("Todo o time")).toBeNull();
  });

  it("selecionar uma pessoa mostra só a sessão dela, e inativos aparecem com sufixo", async () => {
    render(
      <Wrapper>
        <MentoringPage />
      </Wrapper>,
    );
    await screen.findByText("Sessão com Ana");

    await userEvent.click(screen.getByRole("combobox", { name: "Filtrar mentorado" }));
    const opcaoInativa = await screen.findByText("Carla Nunes (inativo)");

    await userEvent.click(opcaoInativa);

    expect(screen.getByText("Sessão com Carla")).toBeTruthy();
    expect(screen.queryByText("Sessão com Ana")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Filtrar mentorado" }).textContent).toContain(
      "Carla Nunes",
    );
  });
});
