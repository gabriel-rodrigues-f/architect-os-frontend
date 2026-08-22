import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { type AppState, type SessionUser } from "../api";
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureAdminUser, fixtureState } from "./fixtures";

/**
 * Rodada 10, Seção 17/38/39 — "Evolução observada" na mentoria é a única
 * forma de registrar nível OBSERVADO fora de um Assessment, e é
 * explicitamente restrita ao Tech Lead atribuído (`isAssignedTechLeadOf`,
 * sem bypass de admin — mesmo precedente do reabrir PDI). Cobre: (1) a
 * seção nem aparece pra quem não é o Tech Lead atribuído da pessoa
 * mentorada, mesmo sendo admin; (2) pra quem é, aparece, e marcar uma
 * competência + escolher nível manda `proficiencyUpdates` no payload; (3) a
 * mentoria continua salvando normalmente com o array vazio (opcional).
 */

const LEAD_USER: SessionUser = {
  id: "test-lead-ana",
  email: "lead-da-ana@company.com",
  name: "Lead da Ana",
  role: "lead",
  architectId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

/** Cópia local — não mexe no `fixtureState` compartilhado por outros testes que assumem "ana" sem lead atribuído. */
function stateWithAnaLedBy(leadUserId: string): AppState {
  return {
    ...fixtureState,
    architects: fixtureState.architects.map((a) =>
      a.id === "ana" ? { ...a, leadUserId } : a,
    ),
  };
}

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

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

function mockBackend(sessionUser: SessionUser, state: AppState) {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const href = String(url);
    if (href.endsWith("/api/auth/me")) {
      return Promise.resolve(
        new Response(JSON.stringify(sessionUser), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    if (href.endsWith("/api/state")) {
      return Promise.resolve(
        new Response(JSON.stringify(state satisfies AppState), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    if (init?.method === "POST" && href.endsWith("/api/mentoring-sessions")) {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return Promise.resolve(
        new Response(JSON.stringify({ ...body, id: "m-nova" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
}

describe("Mentoria — Evolução observada (Rodada 10)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("não aparece pra admin — só o Tech Lead atribuído registra nível observado", async () => {
    mockBackend(fixtureAdminUser, stateWithAnaLedBy(LEAD_USER.id));
    render(
      <Wrapper>
        <MentoringPage />
      </Wrapper>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Registrar sessão" }));
    await screen.findByText("Nova sessão de mentoria");
    expect(screen.getByText("Competências discutidas")).toBeTruthy();
    expect(screen.queryByText("Evolução observada")).toBeNull();
  });

  it("Tech Lead atribuído vê a seção e o registro de nível observado entra no payload", async () => {
    mockBackend(LEAD_USER, stateWithAnaLedBy(LEAD_USER.id));
    render(
      <Wrapper>
        <MentoringPage />
      </Wrapper>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Registrar sessão" }));
    await screen.findByText("Nova sessão de mentoria");
    await screen.findByText("Evolução observada");

    const dialog = screen.getByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Mentorado"), "ana");
    await userEvent.type(within(dialog).getByLabelText("Duração (min)"), "45");
    await userEvent.type(within(dialog).getByLabelText("Tema"), "Revisão de IAM");
    await userEvent.type(within(dialog).getByLabelText("Notas"), "Discutimos o desenho de IAM.");
    await userEvent.type(within(dialog).getByLabelText("Decisões"), "Adotar RBAC.");
    await userEvent.type(within(dialog).getByLabelText("Ações"), "Documentar o ADR.");

    const proficiencySection = screen.getByText("Evolução observada").closest("div")!.parentElement!;
    await userEvent.click(within(proficiencySection).getByText("IAM"));
    const levelSelect = screen.getByLabelText("Nível observado — IAM");
    await userEvent.selectOptions(levelSelect, "4");
    await userEvent.type(screen.getByPlaceholderText("Nota (opcional)"), "Salto após o projeto real.");

    await userEvent.click(screen.getByRole("button", { name: "Salvar sessão" }));

    const isCreateCall = (call: unknown[]) => {
      const [url, init] = call as [string, RequestInit?];
      return String(url).endsWith("/api/mentoring-sessions") && init?.method === "POST";
    };
    await waitFor(() => expect(fetchMock.mock.calls.some(isCreateCall)).toBe(true));
    const call = fetchMock.mock.calls.find(isCreateCall) as [string, RequestInit];
    const body = JSON.parse(String(call[1].body)) as {
      proficiencyUpdates: Array<{ competencyId: string; observedLevel: number; note?: string }>;
    };

    expect(body.proficiencyUpdates).toEqual([
      { competencyId: "security-iam", observedLevel: 4, note: "Salto após o projeto real." },
    ]);
  });

  it("salva normalmente com 'Evolução observada' vazia — o campo é opcional", async () => {
    mockBackend(LEAD_USER, stateWithAnaLedBy(LEAD_USER.id));
    render(
      <Wrapper>
        <MentoringPage />
      </Wrapper>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Registrar sessão" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Mentorado"), "ana");
    await userEvent.type(within(dialog).getByLabelText("Duração (min)"), "30");
    await userEvent.type(within(dialog).getByLabelText("Tema"), "Follow-up rápido");
    await userEvent.type(within(dialog).getByLabelText("Notas"), "Sem novidades.");
    await userEvent.type(within(dialog).getByLabelText("Decisões"), "Manter o rumo.");
    await userEvent.type(within(dialog).getByLabelText("Ações"), "Nenhuma.");

    await userEvent.click(screen.getByRole("button", { name: "Salvar sessão" }));

    const isCreateCall = (call: unknown[]) => {
      const [url, init] = call as [string, RequestInit?];
      return String(url).endsWith("/api/mentoring-sessions") && init?.method === "POST";
    };
    await waitFor(() => expect(fetchMock.mock.calls.some(isCreateCall)).toBe(true));
    const call = fetchMock.mock.calls.find(isCreateCall) as [string, RequestInit];
    const body = JSON.parse(String(call[1].body)) as { proficiencyUpdates: unknown[] };
    expect(body.proficiencyUpdates).toEqual([]);
  });
});
