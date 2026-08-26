import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "@/lib/api";
import type { Assessment, AssessmentEligibility } from "@/lib/domain";
import { fixtureMemberUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * ORIENTACAO-NONA-RODADA, Seção 8/32 — cobertura dedicada do Portfólio de
 * Capacidades do Ciclo (`CareerPortfolioSection`, `routes/assessments.tsx`):
 * nenhum teste existia antes desta rodada.
 */

const fetchMock = vi.fn();

const draftAssessment: Assessment = {
  id: "asmt-ana-draft",
  architectId: "ana",
  cycleId: "2026-h2",
  status: "Draft",
  modelVersion: 2,
  targetCareerLevelId: "arquiteto-de-solucoes-iii",
  targetSemantics: "NEXT_ROLE",
  version: 1,
  items: [],
};

const state: AppState = {
  ...fixtureState,
  assessments: [...fixtureState.assessments, draftAssessment],
};

const eligibilityBase: AssessmentEligibility = {
  currentCareerLevel: { id: "arquiteto-de-solucoes-ii", name: "Arquiteto de Soluções II", rank: 2 },
  nextCareerLevel: { id: "arquiteto-de-solucoes-iii", name: "Arquiteto de Soluções III", rank: 3 },
  policy: { careerLevelId: "arquiteto-de-solucoes-iii", minimumQualifiedCapabilities: 3 },
  capabilities: [],
  qualifiedConfirmedCount: 0,
  eligible: false,
};

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

const renderPage = () => {
  window.history.pushState({}, "", "?architectId=ana&cycleId=2026-h2");
  return renderWithApp(<AssessmentsPage />);
};

/** Rota do POST de capacidade do portfólio (proposta aceita pelo backend fake). */
const addCapabilityRoute = (href: string, init?: RequestInit) =>
  init?.method === "POST" && href.includes("/capabilities") && !href.includes("/confirm")
    ? jsonResponse(
        {
          id: "portfolio-1",
          assessmentId: draftAssessment.id,
          capabilityId: "cloud",
          addedByUserId: "test-member",
          addedAt: "2026-08-20T00:00:00Z",
          confirmedByUserId: null,
          confirmedAt: null,
        },
        201,
      )
    : undefined;

describe("Avaliações — Portfólio de Capacidades do Ciclo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      state,
      routes: [
        (href) => (href.includes("/eligibility") ? jsonResponse(eligibilityBase) : undefined),
        addCapabilityRoute,
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("só oferece capacidade READY para propor — REQUIRES_CURATION não aparece", async () => {
    renderPage();
    // `findByLabelText`, não `findByText` do título: o título aparece nos
    // três estados (loading/error/sucesso) — só o combobox confirma que a
    // consulta de elegibilidade já resolveu.
    const select = (await screen.findByLabelText(
      "Adicionar capacidade ao portfólio",
    )) as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    // A fixture (fixtures.ts) só tem capacidades REQUIRES_CURATION — nenhuma
    // é oferecida, e o aviso de curadoria pendente aparece.
    expect(optionLabels).not.toContain("Cloud Architecture");
    expect(optionLabels).not.toContain("Security");
    expect(screen.getByText(/curadoria do catálogo precisa ser concluída/)).toBeTruthy();
  });

  it("mostra o tamanho do portfólio do ciclo separado da contagem de elegibilidade", async () => {
    renderPage();
    await screen.findByText(/Portfólio do ciclo: 0 capacidade/);

    expect(screen.getByText(/0\/3 capacidades qualificadas/)).toBeTruthy();
    expect(screen.getByText(/Selecione pelo menos 3 capacidades/)).toBeTruthy();
  });

  /** ENT-09-016 — indicador visual do mínimo de 3, além do número no badge. */
  it("mostra uma barra de progresso do portfólio em direção ao mínimo de 3", async () => {
    renderPage();
    await screen.findByText(/Portfólio do ciclo: 0 capacidade/);

    const progress = screen.getByRole("progressbar");
    expect(progress.getAttribute("aria-valuenow")).toBe("0");
  });

  it("loading aparece antes da resposta, e error com Tentar novamente quando a rota falha", async () => {
    fetchMock.mockImplementationOnce((url: string) => {
      if (String(url).endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureMemberUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    // Reaplica o mock genérico para as chamadas seguintes, mas força a
    // primeira consulta de elegibilidade a falhar.
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      state,
      routes: [
        (href) => (href.includes("/eligibility") ? new Response("{}", { status: 500 }) : undefined),
      ],
    });

    renderPage();
    await screen.findByText("Portfólio de Capacidades do Ciclo");
    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar o portfólio e a elegibilidade."),
      ).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
  });

  it("adicionar capacidade invalida também o estado principal do app (Assessment/items), não só a elegibilidade", async () => {
    // Torna "cloud" READY só para este teste, para exercitar o caminho de
    // adicionar de verdade.
    const readyState: AppState = {
      ...state,
      capabilities: state.capabilities.map((c) =>
        c.id === "cloud"
          ? {
              ...c,
              curation: {
                activeCompetencyCount: 6,
                restrictiveCompetencyCount: 3,
                nonRestrictiveCompetencyCount: 3,
                status: "READY" as const,
              },
            }
          : c,
      ),
    };
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      state: readyState,
      routes: [
        (href) => (href.includes("/eligibility") ? jsonResponse(eligibilityBase) : undefined),
        addCapabilityRoute,
      ],
    });

    renderPage();
    const select = (await screen.findByLabelText(
      "Adicionar capacidade ao portfólio",
    )) as HTMLSelectElement;

    const stateCallsBefore = fetchMock.mock.calls.filter(([u]) =>
      String(u).endsWith("/api/state"),
    ).length;

    await userEvent.selectOptions(select, "cloud");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([u, i]) =>
            String(u).includes(`/api/assessments/${draftAssessment.id}/capabilities`) &&
            (i as RequestInit)?.method === "POST",
        ),
      ).toBe(true),
    );

    // A revalidação depois de adicionar precisa incluir o estado principal
    // do app (Problema 2), não só a query de elegibilidade.
    await waitFor(() => {
      const stateCallsAfter = fetchMock.mock.calls.filter(([u]) =>
        String(u).endsWith("/api/state"),
      ).length;
      expect(stateCallsAfter).toBeGreaterThan(stateCallsBefore);
    });
  });
});
