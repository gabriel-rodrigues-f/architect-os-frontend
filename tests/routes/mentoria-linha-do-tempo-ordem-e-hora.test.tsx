import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as MentoringRoute } from "@/routes/mentoring";
import { type AppState } from "@/lib/api";
import type { MentoringSession } from "@/lib/domain";
import { fixtureAssignedTechLeadUser, fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * BUG do dono (2026-09-08), item 7: *"as sessões precisam vir da mais nova
 * para a mais antiga, de cima para baixo, e cada uma mostra hora junto da
 * data"*.
 *
 * Duas metades, e o vermelho de cada uma:
 *
 *  1. A ORDEM. A comparação antiga (`a.date < b.date ? 1 : -1`) nunca devolve
 *     zero: para duas sessões do MESMO dia ela afirma que a primeira vem
 *     depois, e o `sort` inverte o que o servidor mandou (que já chega em
 *     `ORDER BY session_date DESC`). Duas sessões do mesmo dia apareciam
 *     trocadas — o defeito que o dono viu na tela;
 *  2. A HORA. A linha desenhava só o dia. Quando o registro carrega o
 *     instante, a linha do tempo mostra dia E hora.
 */
const fetchMock = vi.fn();

const MentoringPage = MentoringRoute.options.component as () => ReactNode;

const sessao = (id: string, topic: string, date: string): MentoringSession => ({
  id,
  mentor: "Tech Lead do time",
  mentorUserId: fixtureAssignedTechLeadUser.id,
  menteeId: "ana",
  date,
  durationMin: 45,
  topic,
  competencyIds: [],
  notes: "n",
  decisions: "",
  actions: "",
});

/** Como o servidor manda: do mais novo para o mais antigo, dois no mesmo dia. */
const DO_SERVIDOR = [
  sessao("m-tarde", "Segunda conversa do dia 10", "2026-08-10"),
  sessao("m-manha", "Primeira conversa do dia 10", "2026-08-10"),
  sessao("m-antiga", "Conversa da semana passada", "2026-08-03"),
];

const stateWith = (sessions: MentoringSession[]): AppState => ({
  ...fixtureState,
  mentoringSessions: sessions,
});

const topicosNaTela = (): string[] =>
  screen
    .getAllByRole("listitem")
    .map((item) => item.querySelector("p")?.textContent ?? "")
    .filter((texto) => texto.includes("conversa") || texto.includes("Conversa"));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("linha do tempo da mentoria — da mais nova para a mais antiga", () => {
  it("preserva a ordem do servidor entre sessões do mesmo dia, em vez de invertê-las", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state: stateWith(DO_SERVIDOR),
    });
    renderWithApp(<MentoringPage />);

    await screen.findByText("Conversa da semana passada");
    expect(topicosNaTela()).toEqual([
      "Segunda conversa do dia 10",
      "Primeira conversa do dia 10",
      "Conversa da semana passada",
    ]);
  });

  it("ordena de cima para baixo mesmo quando o servidor manda fora de ordem", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state: stateWith([DO_SERVIDOR[2]!, DO_SERVIDOR[0]!]),
    });
    renderWithApp(<MentoringPage />);

    await screen.findByText("Conversa da semana passada");
    expect(topicosNaTela()).toEqual(["Segunda conversa do dia 10", "Conversa da semana passada"]);
  });
});

describe("linha do tempo da mentoria — a hora ao lado da data", () => {
  it("mostra hora junto da data quando o registro carrega o instante", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state: stateWith([sessao("m-com-hora", "Conversa com hora", "2026-08-10T14:30")]),
    });
    renderWithApp(<MentoringPage />);

    await screen.findByText("Conversa com hora");
    // O separador entre dia e hora é o do idioma (pt-BR usa vírgula).
    expect(screen.getByText(/10\/08\/2026,? 14:30/)).toBeTruthy();
  });

  it("sem instante no registro, mostra só o dia — não inventa meia-noite", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state: stateWith([sessao("m-so-dia", "Conversa sem hora", "2026-08-10")]),
    });
    renderWithApp(<MentoringPage />);

    await screen.findByText("Conversa sem hora");
    expect(screen.getByText(/10\/08\/2026/).textContent).not.toMatch(/\d{2}:\d{2}/);
  });
});
