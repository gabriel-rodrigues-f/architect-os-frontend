import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "@/lib/api";
import type { Assessment, Capability, Competency } from "@/lib/domain";
import { fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * R2-ESC-06 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — a garantia de escala que
 * sobrou: cada cartão de capacidade mostra o progresso "N/M respondidas".
 *
 * As outras duas eram FILHAS DO FILTRO, e o filtro saiu (dono, 2026-09-10:
 * *"Filtros: fica só o nome"*). "Acima de 10 capacidades SELECIONADAS, navega
 * uma por vez" e o atalho "Selecionar as do portfólio" só faziam sentido
 * enquanto alguém escolhia o que ver: a tela agora lista TODAS as capacidades,
 * dentro de uma caixa que rola por dentro e ocupa a tela — é a caixa que
 * resolve a escala, não a paginação.
 */

const fetchMock = vi.fn();

const MANY_CAPABILITIES: Capability[] = Array.from({ length: 12 }, (_, i) => ({
  id: `cap-${i}`,
  name: `Capacidade ${i}`,
  short: `C${i}`,
  curation: {
    competencyCount: 1,
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
}));

const draftAssessment: Assessment = {
  id: "ana-draft",
  professionalId: "ana",
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

function mockFetch(state: AppState, portfolioCapabilityIds: string[] = []) {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    state,
    routes: [
      // DONO, 2026-09-10: o atalho do portfólio lia a rota da elegibilidade,
      // que morreu. A fonte passa a ser o portfólio, que tem rota própria.
      (href, init) =>
        init?.method === undefined && href.includes("/capabilities")
          ? jsonResponse(
              portfolioCapabilityIds.map((capabilityId) => ({
                id: `portfolio-${capabilityId}`,
                assessmentId: "asmt",
                capabilityId,
                addedByUserId: "u",
                addedAt: "2026-08-20T00:00:00Z",
                confirmedByUserId: "u",
                confirmedAt: "2026-08-21T00:00:00Z",
              })),
            )
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
    mockFetch(manyCapabilitiesState);
    renderWithApp(<AssessmentsPage />);

    // O cartão da capacidade se acha pelo TÍTULO; o progresso é a descrição
    // dele. Com todas as capacidades na tela, "0/1 respondidas" aparece doze
    // vezes — e o que interessa é a que está DENTRO deste cartão.
    const cartao = (await screen.findByRole("heading", { name: "Capacidade 0" })).closest(
      "section",
    )!;
    expect(cartao.textContent).toContain("1 competência");
    expect(cartao.textContent).toContain("0/1 respondidas");
  });

  it("todas as 12 capacidades aparecem juntas — a caixa que rola resolve a escala", async () => {
    mockFetch(manyCapabilitiesState);
    renderWithApp(<AssessmentsPage />);

    expect(await screen.findByRole("heading", { name: "Capacidade 0" })).toBeTruthy();
    for (const indice of [1, 5, 11]) {
      expect(screen.getByRole("heading", { name: `Capacidade ${String(indice)}` })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Próxima" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Selecionar as do portfólio" })).toBeNull();
  });
});
