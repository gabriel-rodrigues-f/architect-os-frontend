import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { type AppState, type SessionUser } from "@/lib/api";
import type { MentoringSession } from "@/lib/domain";
import { fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

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

/**
 * OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`).
 * O Wrapper local não tinha o corte `AuthReady`; o do helper apenas atrasa a
 * montagem até `/api/v1/auth/me` resolver — todas as asserções já esperam via
 * `findBy*`.
 */

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

/**
 * O filtro da linha do tempo nasce sempre na primeira pessoa ativa em ordem
 * alfabética (R2-UX-11 revisado — sem mais "Todo o time"); como a fixture
 * também tem "Ana Martins" no roster, a sessão de "bruno" só aparece depois
 * de selecionar Bruno Almeida explicitamente no combobox.
 */
async function selectMentee(name: string) {
  await userEvent.click(await screen.findByRole("combobox", { name: "Filtrar mentorado" }));
  await userEvent.click(await screen.findByText(name));
}

function mockSession(user: SessionUser) {
  mockAppFetch(fetchMock, {
    user,
    state,
    routes: [
      (href, init) =>
        init?.method === "PATCH" && href.includes(apiPath("/mentoring-sessions/"))
          ? jsonResponse({ ...sessao, nextSession: "2026-09-01" })
          : undefined,
    ],
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
    renderWithApp(<MentoringPage />);

    await selectMentee("Bruno Almeida");
    await screen.findByText("Sessão para follow-up");
    expect(screen.getByRole("button", { name: "Agendar follow-up" })).toBeTruthy();
  });

  it("outra pessoa não vê a ação numa sessão que não é dela", async () => {
    mockSession(outsider);
    renderWithApp(<MentoringPage />);

    await selectMentee("Bruno Almeida");
    await screen.findByText("Sessão para follow-up");
    expect(screen.queryByRole("button", { name: "Agendar follow-up" })).toBeNull();
  });

  it("agendar salva a data e chama o PATCH certo", async () => {
    mockSession(mentor);
    renderWithApp(<MentoringPage />);

    await selectMentee("Bruno Almeida");
    await screen.findByText("Sessão para follow-up");
    await userEvent.click(screen.getByRole("button", { name: "Agendar follow-up" }));
    await userEvent.type(screen.getByLabelText("Agendar follow-up"), "2026-09-01");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith(apiPath("/mentoring-sessions/m-followup")) &&
            (init as RequestInit)?.method === "PATCH",
        ),
      ).toBe(true),
    );
    const call = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith(apiPath("/mentoring-sessions/m-followup")) &&
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
    renderWithApp(<MentoringPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Registrar sessão" }));
    // R2-ESC-04 — o campo virou combobox pesquisável (ArchitectSelectCombobox), não mais `<select>`.
    await userEvent.click(screen.getByLabelText("Mentorado"));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Bruno Almeida"]);
  });
});
