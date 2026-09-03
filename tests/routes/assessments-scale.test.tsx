import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "@/lib/api";
import type { Assessment, Capability, Competency } from "@/lib/domain";
import { fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * R2-ESC-06 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — três garantias de escala
 * para uma avaliação com muitas capacidades: (1) cada card mostra progresso
 * "N/M respondidas"; (2) acima de 10 capacidades selecionadas, a tela
 * navega uma de cada vez em vez de despejar todas de uma vez; (3) atalho
 * "Selecionar as do portfólio" preenche o seletor com as capacidades do
 * portfólio de carreira, sem precisar marcar uma por uma.
 */

const fetchMock = vi.fn();

const MANY_CAPABILITIES: Capability[] = Array.from({ length: 12 }, (_, i) => ({
  id: `cap-${i}`,
  name: `Capacidade ${i}`,
  short: `C${i}`,
  active: true,
  curation: {
    activeCompetencyCount: 1,
    status: "REQUIRES_CURATION",
  },
}));

const MANY_COMPETENCIES: Competency[] = MANY_CAPABILITIES.map((cap, i) => ({
  id: `comp-${i}`,
  name: `Competência ${i}`,
  capabilityId: cap.id,
  expected: {
    "arquiteto-de-solucoes-i": 2,
    "arquiteto-de-solucoes-ii": 3,
    "arquiteto-de-solucoes-iii": 4,
  },
  active: true,
}));

const draftAssessment: Assessment = {
  id: "ana-draft",
  architectId: "ana",
  cycleId: "2026-h2",
  status: "Draft",
  modelVersion: 1,
  targetCareerLevelId: null,
  targetSemantics: null,
  version: 1,
  items: MANY_COMPETENCIES.map((c) => ({
    competencyId: c.id,
    self: null,
    leader: null,
    target: 3,
    final: null,
    comments: [],
  })),
};

const manyCapabilitiesState: AppState = {
  ...fixtureState,
  capabilities: MANY_CAPABILITIES,
  competencies: MANY_COMPETENCIES,
  assessments: [draftAssessment],
};

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

function mockFetch(state: AppState, eligibilityCapabilityIds: string[] = []) {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    state,
    routes: [
      (href) =>
        href.includes("/eligibility")
          ? jsonResponse({
              capabilities: eligibilityCapabilityIds.map((capabilityId) => ({
                capabilityId,
                confirmed: true,
                qualified: true,
              })),
              qualifiedConfirmedCount: eligibilityCapabilityIds.length,
              eligible: null,
            })
          : undefined,
    ],
  });
}

describe("Avaliações — escala com muitas capacidades (R2-ESC-06)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("cada card mostra progresso N/M respondidas", async () => {
    mockFetch({
      ...manyCapabilitiesState,
      // Só a primeira capacidade selecionada por padrão (default de 1) — mais fácil de checar o card sozinho.
    });
    renderWithApp(<AssessmentsPage />);

    expect(await screen.findByRole("heading", { name: "Capacidade 0" })).toBeTruthy();
    expect(screen.getByText(/0\/1 respondidas/)).toBeTruthy();
  });

  it("acima de 10 capacidades selecionadas, navega uma por vez com aviso", async () => {
    mockFetch(manyCapabilitiesState);
    renderWithApp(<AssessmentsPage />);

    await screen.findByRole("heading", { name: "Capacidade 0" });
    await userEvent.click(screen.getByRole("combobox", { name: "Capacidades" }));
    await userEvent.click(await screen.findByText("Selecionar todas"));
    await userEvent.keyboard("{Escape}");

    expect(await screen.findByText(/12 capacidades selecionadas/)).toBeTruthy();
    // Só a capacidade da página atual aparece — as outras 11 não.
    expect(screen.getByRole("heading", { name: "Capacidade 0" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Capacidade 5" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(await screen.findByRole("heading", { name: "Capacidade 1" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Capacidade 0" })).toBeNull();
  });

  it("atalho 'Selecionar as do portfólio' troca a seleção pelas capacidades do portfólio", async () => {
    mockFetch(manyCapabilitiesState, ["cap-3", "cap-7"]);
    renderWithApp(<AssessmentsPage />);

    await screen.findByRole("heading", { name: "Capacidade 0" });
    const shortcut = await screen.findByRole("button", { name: "Selecionar as do portfólio" });
    await userEvent.click(shortcut);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Capacidade 3" })).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Capacidade 7" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Capacidade 0" })).toBeNull();
  });
});
