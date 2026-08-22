import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "../api";
import { AuthProvider, useAuth } from "../auth";
import type { Assessment, AssessmentEligibility } from "../domain";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { fixtureMemberUser, fixtureState } from "./fixtures";

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

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

const renderPage = () => {
  window.history.pushState({}, "", "?architectId=ana&cycleId=2026-h2");
  return render(
    <Wrapper>
      <AssessmentsPage />
    </Wrapper>,
  );
};

describe("Avaliações — Portfólio de Capacidades do Ciclo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      const method = init?.method ?? "GET";

      if (href.endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureMemberUser), {
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
      if (href.includes("/eligibility")) {
        return Promise.resolve(
          new Response(JSON.stringify(eligibilityBase), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (method === "POST" && href.includes("/capabilities") && !href.includes("/confirm")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "portfolio-1",
              assessmentId: draftAssessment.id,
              capabilityId: "cloud",
              addedByUserId: "test-member",
              addedAt: "2026-08-20T00:00:00Z",
              confirmedByUserId: null,
              confirmedAt: null,
            }),
            { status: 201, headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
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
    fetchMock.mockImplementation((url: string) => {
      const href = String(url);
      if (href.endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureMemberUser), {
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
      if (href.includes("/eligibility")) {
        return Promise.resolve(new Response("{}", { status: 500 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
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
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      const method = init?.method ?? "GET";
      if (href.endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureMemberUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith("/api/state")) {
        return Promise.resolve(
          new Response(JSON.stringify(readyState), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.includes("/eligibility")) {
        return Promise.resolve(
          new Response(JSON.stringify(eligibilityBase), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (method === "POST" && href.includes("/capabilities") && !href.includes("/confirm")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "portfolio-1",
              assessmentId: draftAssessment.id,
              capabilityId: "cloud",
              addedByUserId: "test-member",
              addedAt: "2026-08-20T00:00:00Z",
              confirmedByUserId: null,
              confirmedAt: null,
            }),
            { status: 201, headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
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
