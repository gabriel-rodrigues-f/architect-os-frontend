import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MentoringTimeline } from "@/components/app/mentoring-shared";
import type { AppState } from "@/lib/api";
import type { MentoringSession } from "@/lib/domain";
import { useSelectors } from "@/lib/store";
import { fixtureState } from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * F2 (caminhos quentes) — cada item da linha do tempo chamava `useSelectors()`
 * por conta própria, e cada chamada monta um `SelectorIndex` inteiro (índices
 * de competência, capacidade, arquiteto, avaliação e PDI) mais os caches
 * vazios que vêm junto. Numa lista de N sessões isso é N índices e N caches
 * frios, quando um só, montado no pai, serve a lista inteira.
 *
 * O primeiro caso é de caracterização (o que a lista mostra não pode mudar);
 * o segundo é a prova da correção: o custo de índice deixa de crescer com o
 * tamanho da lista.
 */

vi.mock("@/lib/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store")>();
  return { ...actual, useSelectors: vi.fn(actual.useSelectors) };
});

const fetchMock = vi.fn();

const sessionAt = (index: number): MentoringSession => ({
  id: `m-${index}`,
  mentor: "Gabriel Rodrigues",
  menteeId: "bruno",
  date: `2026-08-0${index + 1}`,
  durationMin: 30 + index * 10,
  topic: `Tema ${index}`,
  competencyIds: ["cloud-k8s"],
  notes: `Notas ${index}`,
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
    renderWithApp(<MentoringTimeline sessions={sessions} />);

    for (const [index, session] of sessions.entries()) {
      expect(await screen.findByText(session.topic)).toBeTruthy();
      expect(screen.getAllByText(`Notas ${index}`).length).toBe(1);
      expect(screen.getAllByText(`Decisões ${index}`).length).toBe(1);
      expect(screen.getAllByText(`Ações ${index}`).length).toBe(1);
    }

    // "Bruno Almeida · mentor Gabriel Rodrigues · 01/08/2026 · 30 min"
    const linhas = await screen.findAllByText(/Bruno Almeida · mentor Gabriel Rodrigues/);
    expect(linhas).toHaveLength(sessions.length);
    expect(linhas.map((linha) => linha.textContent)).toEqual([
      "Bruno Almeida · mentor Gabriel Rodrigues · 01/08/2026 · 30 min",
      "Bruno Almeida · mentor Gabriel Rodrigues · 02/08/2026 · 40 min",
      "Bruno Almeida · mentor Gabriel Rodrigues · 03/08/2026 · 50 min",
    ]);
    expect(screen.getAllByText("Kubernetes")).toHaveLength(sessions.length);
  });

  it("o custo de montar os selectors não cresce com o tamanho da lista", async () => {
    const uma = [sessionAt(0)];
    mockAppFetch(fetchMock, { state: stateWith(uma) });
    vi.mocked(useSelectors).mockClear();
    renderWithApp(<MentoringTimeline sessions={uma} />);
    await screen.findByText("Tema 0");
    const comUmaSessao = vi.mocked(useSelectors).mock.calls.length;

    cleanup();

    const quatro = [sessionAt(0), sessionAt(1), sessionAt(2), sessionAt(3)];
    mockAppFetch(fetchMock, { state: stateWith(quatro) });
    vi.mocked(useSelectors).mockClear();
    renderWithApp(<MentoringTimeline sessions={quatro} />);
    await screen.findByText("Tema 3");
    const comQuatroSessoes = vi.mocked(useSelectors).mock.calls.length;

    expect(comUmaSessao).toBeGreaterThan(0);
    expect(comQuatroSessoes).toBe(comUmaSessao);
  });
});
