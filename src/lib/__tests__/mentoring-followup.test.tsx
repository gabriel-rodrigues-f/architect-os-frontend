import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { type AppState, type SessionUser } from "../api";
import { AuthProvider } from "../auth";
import type { MentoringSession } from "../domain";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureState } from "./fixtures";

/**
 * EPIC 5 (quarta rodada) — agendar follow-up depois que a sessão já
 * aconteceu. Só quem registrou a sessão (`mentorUserId`) vê a ação — quem
 * está só de passagem pela tela não mexe no compromisso de outra pessoa.
 * Ver AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-SYNAPSE.md.
 */

const fetchMock = vi.fn();

const mentor: SessionUser = {
  id: "mentor-1",
  email: "mentor@company.com",
  name: "Mentor da Sessão",
  role: "admin",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const outsider: SessionUser = {
  id: "outsider-1",
  email: "outsider@company.com",
  name: "Sem Vínculo",
  role: "member",
  architectId: "bruno",
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const sessao: MentoringSession = {
  id: "m-followup",
  mentor: "Mentor da Sessão",
  mentorUserId: "mentor-1",
  menteeId: "bruno",
  date: "2026-08-01",
  durationMin: 45,
  topic: "Sessão para follow-up",
  competencyIds: [],
  notes: "n",
  decisions: "d",
  actions: "a",
};

const state: AppState = { ...fixtureState, mentoringSessions: [sessao] };

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

function mockSession(user: SessionUser) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
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
    if (init?.method === "PATCH" && href.includes("/api/mentoring-sessions/")) {
      return Promise.resolve(
        new Response(JSON.stringify({ ...sessao, nextSession: "2026-09-01" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
}

describe("Mentoria — agendar follow-up", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("quem registrou a sessão vê a ação de agendar follow-up", async () => {
    mockSession(mentor);
    render(
      <Wrapper>
        <MentoringPage />
      </Wrapper>,
    );

    await screen.findByText("Sessão para follow-up");
    expect(screen.getByRole("button", { name: "Agendar follow-up" })).toBeTruthy();
  });

  it("outra pessoa não vê a ação numa sessão que não é dela", async () => {
    mockSession(outsider);
    render(
      <Wrapper>
        <MentoringPage />
      </Wrapper>,
    );

    await screen.findByText("Sessão para follow-up");
    expect(screen.queryByRole("button", { name: "Agendar follow-up" })).toBeNull();
  });

  it("agendar salva a data e chama o PATCH certo", async () => {
    mockSession(mentor);
    render(
      <Wrapper>
        <MentoringPage />
      </Wrapper>,
    );

    await screen.findByText("Sessão para follow-up");
    await userEvent.click(screen.getByRole("button", { name: "Agendar follow-up" }));
    await userEvent.type(screen.getByLabelText("Agendar follow-up"), "2026-09-01");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith("/api/mentoring-sessions/m-followup") &&
            (init as RequestInit)?.method === "PATCH",
        ),
      ).toBe(true),
    );
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/api/mentoring-sessions/m-followup") &&
        (init as RequestInit)?.method === "PATCH",
    ) as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toEqual({ nextSession: "2026-09-01" });
  });

  /**
   * MENT-001 (AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md) — o
   * backend só aceita a própria pessoa, o Tech Lead dela, ou admin como
   * mentor; a lista de mentorados no formulário de nova sessão precisa
   * nascer restrita ao mesmo escopo, não oferecer o roster inteiro
   * (`outsider` só tem relação com "bruno", ele mesmo — nunca com "ana").
   */
  it("formulário de nova sessão só oferece mentorados sob o escopo real de quem registra", async () => {
    mockSession(outsider);
    render(
      <Wrapper>
        <MentoringPage />
      </Wrapper>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Registrar sessão" }));
    // R2-ESC-04 — o campo virou combobox pesquisável (ArchitectSelectCombobox), não mais `<select>`.
    await userEvent.click(screen.getByLabelText("Mentorado"));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Bruno Almeida"]);
  });
});
