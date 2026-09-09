import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MentoringTimeline } from "@/components/app/mentoring-shared";
import type { AppState } from "@/lib/api";
import type { MentoringSession } from "@/lib/domain";
import { useSelectors } from "@/lib/store";
import { fixtureState } from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";
import { type ContextScopeRequest, SELECTOR_CONTEXTS } from "@/lib/context-scope";

/** As mesmas fatias que a rota /mentoring pede — a linha do tempo lê seletores e sessões. */
const MENTORING_CONTEXTS: readonly ContextScopeRequest[] = [
  ...SELECTOR_CONTEXTS,
  "mentoringSessions",
];

/**
 * F2 (caminhos quentes) — cada item da linha do tempo chamava `useSelectors()`
 * por conta própria, e cada chamada monta um `SelectorIndex` inteiro (índices
 * de competência, capacidade, profissional, avaliação e PDI) mais os caches
 * vazios que vêm junto. Numa lista de N sessões isso é N índices e N caches
 * frios, quando um só, montado no pai, serve a lista inteira.
 *
 * O primeiro caso é de caracterização (o que a lista mostra não pode mudar);
 * o segundo é a prova da correção: o custo de índice deixa de crescer com o
 * tamanho da lista.
 *
 * O primeiro caso GANHOU um segundo papel em 2026-09-09: ele é a rede do
 * "Decisões e Ações saíram da 1:1" no que a linha do tempo DESENHA. Para ele
 * ser rede, a sessão da fixture precisa TER os três campos mortos gravados —
 * sobre uma sessão que só tem `notes` o bloco restaurado não desenharia nada,
 * e a asserção ficaria verde diante da regressão que ela diz guardar.
 */

vi.mock("@/lib/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store")>();
  return { ...actual, useSelectors: vi.fn(actual.useSelectors) };
});

const fetchMock = vi.fn();

/**
 * A sessão COMO ELA ERA — com os três campos que morreram. Eles não estão em
 * `MentoringSession` de propósito (é a fatia inteira), e é por isso que a
 * forma de antes precisa ser dita aqui: o teste só fica vermelho contra a
 * volta do bloco "Decisões"/"Ações" e dos chips de competência se a sessão
 * que ele desenha TIVER o que desenhar.
 */
type SessaoComOsCamposMortos = MentoringSession & {
  competencyIds: string[];
  decisions: string;
  actions: string;
};

const sessionAt = (index: number): SessaoComOsCamposMortos => ({
  id: `m-${index}`,
  mentor: "Gabriel Rodrigues",
  menteeId: "bruno",
  date: `2026-08-0${index + 1}`,
  durationMin: 30 + index * 10,
  topic: `Tema ${index}`,
  notes: `Notas ${index}`,
  competencyIds: ["cloud-k8s"],
  decisions: `Decisões ${index}`,
  actions: `Ações ${index}`,
});

const stateWith = (sessions: MentoringSession[]): AppState => ({
  ...fixtureState,
  mentoringSessions: sessions,
});

describe("linha do tempo de mentoria — um índice de selectors por lista (F2)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra tema, mentorado, mentor, data e duração de cada sessão", async () => {
    const sessions = [sessionAt(0), sessionAt(1), sessionAt(2)];
    mockAppFetch(fetchMock, { state: stateWith(sessions) });
    renderWithApp(<MentoringTimeline sessions={sessions} />, { contexts: MENTORING_CONTEXTS });

    for (const [index, session] of sessions.entries()) {
      expect(await screen.findByText(session.topic)).toBeTruthy();
      expect(screen.getAllByText(`Notas ${index}`).length).toBe(1);
    }

    // Um bloco só, chamado "Notas" (dono, 2026-09-09): a sessão desenhada TEM
    // decisões e ações gravadas, e mesmo assim sai um bloco apenas.
    expect(screen.getAllByText("Notas")).toHaveLength(sessions.length);
    expect(screen.queryAllByText("Decisões")).toHaveLength(0);
    expect(screen.queryAllByText("Ações")).toHaveLength(0);
    for (const index of sessions.keys()) {
      expect(screen.queryAllByText(`Decisões ${index}`)).toHaveLength(0);
      expect(screen.queryAllByText(`Ações ${index}`)).toHaveLength(0);
    }

    // "Bruno Almeida · mentor Gabriel Rodrigues · 01/08/2026 · 30 min"
    const linhas = await screen.findAllByText(/Bruno Almeida · mentor Gabriel Rodrigues/);
    expect(linhas).toHaveLength(sessions.length);
    expect(linhas.map((linha) => linha.textContent)).toEqual([
      "Bruno Almeida · mentor Gabriel Rodrigues · 01/08/2026 · 30 min",
      "Bruno Almeida · mentor Gabriel Rodrigues · 02/08/2026 · 40 min",
      "Bruno Almeida · mentor Gabriel Rodrigues · 03/08/2026 · 50 min",
    ]);
    // Os chips de competência saíram da linha do tempo (dono, 2026-09-09):
    // "ele anotou embaixo os temas que foram abordados. Não acho útil."
    expect(screen.queryByText("Kubernetes")).toBeNull();
  });

  it("o custo de montar os selectors não cresce com o tamanho da lista", async () => {
    const uma = [sessionAt(0)];
    mockAppFetch(fetchMock, { state: stateWith(uma) });
    vi.mocked(useSelectors).mockClear();
    renderWithApp(<MentoringTimeline sessions={uma} />, { contexts: MENTORING_CONTEXTS });
    await screen.findByText("Tema 0");
    const comUmaSessao = vi.mocked(useSelectors).mock.calls.length;

    cleanup();

    const quatro = [sessionAt(0), sessionAt(1), sessionAt(2), sessionAt(3)];
    mockAppFetch(fetchMock, { state: stateWith(quatro) });
    vi.mocked(useSelectors).mockClear();
    renderWithApp(<MentoringTimeline sessions={quatro} />, { contexts: MENTORING_CONTEXTS });
    await screen.findByText("Tema 3");
    const comQuatroSessoes = vi.mocked(useSelectors).mock.calls.length;

    expect(comUmaSessao).toBeGreaterThan(0);
    expect(comQuatroSessoes).toBe(comUmaSessao);
  });
});
