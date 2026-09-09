import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { type AppState, type SessionUser } from "@/lib/api";
import type { MentoringSession } from "@/lib/domain";
import { fixtureState, scopedFixtureStateFor } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * EPIC 5 (quarta rodada) — agendar follow-up depois que a sessão já
 * aconteceu. Só quem registrou a sessão (`mentorUserId`) vê a ação — quem
 * está só de passagem pela tela não mexe no compromisso de outra pessoa.
 * Ver AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-SYNAPSE.md.
 *
 * Dono (2026-09-08, item 2): *"o follow-up não deve aparecer em cada linha,
 * porque a evolução é contínua. Precisa aparecer no canto superior da caixa
 * de Linha do Tempo"*. É UM ponto só, no cabeçalho do cartão, e pende da
 * sessão mais recente da pessoa — as linhas não têm mais nem a ação nem o
 * "sem follow-up agendado".
 */

const fetchMock = vi.fn();

const mentor: SessionUser = {
  id: "mentor-1",
  email: "mentor@company.com",
  name: "Mentor da Sessão",
  role: "admin",
  professionalId: null,
  status: "active",
  mustChangePassword: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const outsider: SessionUser = {
  id: "outsider-1",
  email: "outsider@company.com",
  name: "Sem Vínculo",
  role: "member",
  professionalId: "bruno",
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
  notes: "n",
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

  it("o mentorado vê a própria sessão sem escolher ninguém e não vê a ação — Mentoria é leitura para ele (dono, 2026-09-06)", async () => {
    mockSession(outsider);
    renderWithApp(<MentoringPage />);

    // A linha do tempo já nasce nele: o profissional não busca outros membros.
    await screen.findByText("Sessão para follow-up");
    expect(screen.queryByRole("combobox", { name: "Filtrar mentorado" })).toBeNull();
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
   * mentor; desde o roster fechado (backend `d1edba4`) essa restrição chega
   * pronta no payload (`scopedFixtureStateFor`): o formulário lista o que o
   * servidor mandou, sem refiltrar no cliente
   * (`outsider` só tem relação com "bruno", ele mesmo — nunca com "ana").
   */
  it("quem só tem a si mesmo no alcance não registra sessão — ninguém mentora a si mesmo (dono, 2026-09-05)", async () => {
    mockAppFetch(fetchMock, { user: outsider, state: scopedFixtureStateFor(outsider, state) });
    renderWithApp(<MentoringPage />);

    // A linha do tempo continua dele: só há ele no alcance, e a sessão em que
    // foi mentorado aparece sem escolher ninguém.
    await screen.findByText("Sessão para follow-up");
    expect(screen.queryByRole("button", { name: "Registrar sessão" })).toBeNull();
  });
});

describe("Mentoria — o follow-up é um só, no topo da Linha do Tempo (dono, 2026-09-08)", () => {
  const maisAntiga: MentoringSession = { ...sessao, id: "m-antiga", date: "2026-07-01" };
  const maisNova: MentoringSession = {
    ...sessao,
    id: "m-nova",
    date: "2026-08-15",
    topic: "Sessão mais nova",
    nextSession: "2026-09-20",
  };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const montaCom = (sessoes: MentoringSession[], user = mentor) => {
    mockAppFetch(fetchMock, {
      user,
      state: { ...fixtureState, mentoringSessions: sessoes },
      routes: [
        (href, init) =>
          init?.method === "PATCH" && href.includes(apiPath("/mentoring-sessions/"))
            ? jsonResponse({ ...maisNova, nextSession: "2026-09-01" })
            : undefined,
      ],
    });
    renderWithApp(<MentoringPage />);
  };

  it("com três sessões, há UMA ação de follow-up — e ela está no cabeçalho do cartão, fora das linhas", async () => {
    montaCom([maisAntiga, sessao, maisNova]);
    await selectMentee("Bruno Almeida");
    await screen.findByText("Sessão mais nova");

    const acoes = screen.getAllByRole("button", { name: "Agendar follow-up" });
    expect(acoes).toHaveLength(1);
    expect(acoes[0]!.closest("li")).toBeNull();
    expect(acoes[0]!.closest("section")?.getAttribute("aria-labelledby")).toBeTruthy();
  });

  it("nenhuma linha diz mais 'Sem follow-up agendado'", async () => {
    montaCom([maisAntiga, sessao]);
    await selectMentee("Bruno Almeida");
    await screen.findAllByText("Sessão para follow-up");

    for (const linha of screen.getAllByRole("listitem")) {
      expect(linha.textContent ?? "").not.toContain("Sem follow-up agendado");
      expect(linha.textContent ?? "").not.toContain("Agendar follow-up");
      expect(linha.textContent ?? "").not.toContain("Próxima sessão:");
    }
  });

  it("o ponto de follow-up é o da sessão mais recente: agendar escreve no id dela", async () => {
    montaCom([maisAntiga, sessao, maisNova]);
    await selectMentee("Bruno Almeida");
    await screen.findByText("Sessão mais nova");

    await userEvent.click(screen.getByRole("button", { name: "Agendar follow-up" }));
    await userEvent.type(screen.getByLabelText("Agendar follow-up"), "2026-09-01");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith(apiPath(`/mentoring-sessions/${maisNova.id}`)) &&
            (init as RequestInit)?.method === "PATCH",
        ),
      ).toBe(true),
    );
  });

  it("quem não agenda apenas lê a próxima conversa marcada, no mesmo canto", async () => {
    montaCom([maisNova], outsider);
    await screen.findByText("Sessão mais nova");

    expect(screen.getByText("Próxima sessão: 20/09/2026")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Agendar follow-up" })).toBeNull();
  });
});
