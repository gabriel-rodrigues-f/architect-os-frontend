import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "@/lib/api";
import type { Assessment, AssessmentEligibility } from "@/lib/domain";
import { fixtureAssignedTechLeadUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, hrefOf } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * ORIENTACAO-NONA-RODADA, Seção 8/32 — cobertura dedicada do Portfólio de
 * Capacidades do Ciclo (`CareerPortfolioSection`, `routes/assessments.tsx`):
 * nenhum teste existia antes desta rodada.
 */

const fetchMock = vi.fn();

const draftAssessment: Assessment = {
  id: "asmt-ana-draft",
  professionalId: "ana",
  cycleId: "2026-h2",
  status: "Draft",
  modelVersion: 2,
  targetCareerLevelId: "arquiteto-de-solucoes-iii",
  targetSemantics: "NEXT_ROLE",
  version: 1,
  items: [],
};

/**
 * Fase 2 (ADR-0034): o sinal REQUIRES_CURATION agora é só "extrapolou o alvo
 * de ativas" — a fixture padrão nasce READY, então este teste força as duas
 * capacidades ao estado extrapolado para provar que nenhuma é oferecida.
 */
const state: AppState = {
  ...fixtureState,
  capabilities: fixtureState.capabilities.map((capability) => ({
    ...capability,
    curation: { activeCompetencyCount: 7, status: "REQUIRES_CURATION" as const },
  })),
  assessments: [...fixtureState.assessments, draftAssessment],
};

const eligibilityBase: AssessmentEligibility = {
  currentCareerLevel: { id: "arquiteto-de-solucoes-ii", name: "Pleno", rank: 2 },
  nextCareerLevel: { id: "arquiteto-de-solucoes-iii", name: "Sênior", rank: 3 },
  policy: { careerLevelId: "arquiteto-de-solucoes-iii", minimumQualifiedCapabilities: 3 },
  capabilities: [],
  qualifiedConfirmedCount: 0,
  eligible: false,
};

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;

const renderPage = () => {
  window.history.pushState({}, "", "?professionalId=ana&cycleId=2026-h2");
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

/**
 * Dono, 2026-09-06 — ninguém age sobre si: quem PROPÕE o portfólio em
 * Rascunho é quem lidera a pessoa (na 1:1), não o profissional.
 */
describe("Avaliações — Portfólio de Capacidades do Ciclo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
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

  /**
   * ESTADO VAZIO — a falta se diz UMA vez (dono, 2026-09-09, com captura:
   * *"está atualmente confuso e visualmente ruim"*). O levantamento dos três
   * estados mostrou o bloco vazio dizendo "você não selecionou nada" cinco
   * vezes: o selo do tamanho, a barra em 0%, o selo `0/3`, a dica do mínimo e
   * a frase do vazio. Sobra o estado vazio de duas linhas — e só ele.
   */
  it("no estado vazio, nenhum número repete a frase do vazio", async () => {
    renderPage();
    await screen.findByLabelText("Adicionar capacidade ao portfólio");

    expect(screen.queryByText(/Portfólio do ciclo: 0 capacidade/)).toBeNull();
    expect(screen.queryByText(/0\/3/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("o estado vazio diz as duas linhas da casa — assunto e regra do ciclo", async () => {
    renderPage();
    await screen.findByLabelText("Adicionar capacidade ao portfólio");

    expect(screen.getByText("Nenhuma capacidade no portfólio deste ciclo")).toBeTruthy();
    expect(screen.getByText(/Selecione pelo menos 3 capacidades/)).toBeTruthy();
  });

  it("loading aparece antes da resposta, e error com Tentar novamente quando a rota falha", async () => {
    fetchMock.mockImplementationOnce((url: string) => {
      if (String(url).endsWith(apiPath("/auth/me"))) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAssignedTechLeadUser), {
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
      user: fixtureAssignedTechLeadUser,
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
      user: fixtureAssignedTechLeadUser,
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
      hrefOf(u as string | URL | Request).endsWith(apiPath("/assessments")),
    ).length;

    await userEvent.selectOptions(select, "cloud");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([u, i]) =>
            String(u).includes(apiPath(`/assessments/${draftAssessment.id}/capabilities`)) &&
            (i as RequestInit)?.method === "POST",
        ),
      ).toBe(true),
    );

    // A revalidação depois de adicionar precisa incluir o estado principal
    // do app (Problema 2), não só a query de elegibilidade.
    await waitFor(() => {
      const stateCallsAfter = fetchMock.mock.calls.filter(([u]) =>
        hrefOf(u as string | URL | Request).endsWith(apiPath("/assessments")),
      ).length;
      expect(stateCallsAfter).toBeGreaterThan(stateCallsBefore);
    });
  });

  /**
   * ESTADO PARCIAL — a confusão aqui é OUTRA (o levantamento dos três estados
   * mostrou): dois selos de mesma forma, "2 selecionada(s) · mínimo 3" e
   * "1/3 qualificadas", contra o MESMO denominador e com significados
   * diferentes, mais a barra de 66% que pertencia só ao primeiro. Passa a
   * haver UM número-síntese (o que conta para a progressão) e UM medidor, com
   * uma vaga por capacidade e uma vaga tracejada por capacidade que falta
   * selecionar — os dois "números" viram posições da mesma pista.
   */
  const renderComElegibilidade = (eligibility: AssessmentEligibility) => {
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state,
      routes: [(href) => (href.includes("/eligibility") ? jsonResponse(eligibility) : undefined)],
    });
    return renderPage();
  };

  const parcial: AssessmentEligibility = {
    ...eligibilityBase,
    capabilities: [
      { capabilityId: "cloud", confirmed: true, qualified: true },
      { capabilityId: "security", confirmed: true, qualified: false },
    ],
    qualifiedConfirmedCount: 1,
    eligible: false,
  };

  it("no estado parcial, o número-síntese da progressão é um só", async () => {
    renderComElegibilidade(parcial);
    await screen.findByLabelText("Adicionar capacidade ao portfólio");

    expect(screen.queryByText(/Portfólio do ciclo: 2 capacidade/)).toBeNull();
    expect(screen.getByText("1/3")).toBeTruthy();
    expect(screen.getByText(/Faltam 2 capacidade/)).toBeTruthy();
  });

  it("no estado parcial, o medidor separa os estágios e mostra a vaga que falta", async () => {
    renderComElegibilidade(parcial);
    await screen.findByLabelText("Adicionar capacidade ao portfólio");

    const medidor = screen.getByLabelText("1/3 capacidades qualificadas");
    const vagas = medidor.querySelectorAll("[data-portfolio-slot]");
    expect(Array.from(vagas).map((vaga) => vaga.getAttribute("data-portfolio-slot"))).toEqual([
      "qualified",
      "belowBar",
      "unselected",
    ]);
  });

  it("no estado parcial, a legenda conta cada estágio uma vez", async () => {
    renderComElegibilidade(parcial);
    await screen.findByLabelText("Adicionar capacidade ao portfólio");

    expect(screen.getByText(/^1 qualificada/)).toBeTruthy();
    expect(screen.getByText(/^1 abaixo da régua/)).toBeTruthy();
    expect(screen.getByText(/^1 a selecionar/)).toBeTruthy();
  });

  /**
   * ESTADO COMPLETO — a terceira confusão: com `eligible: true` o bloco não
   * dizia NADA. O veredito existe no contrato (`eligible`) e nunca chegava à
   * tela; o selo só trocava de variante, o que ninguém lê. E ele vem com a
   * ressalva da régua de progressão: elegibilidade não promove sozinha.
   */
  it("no estado completo, o bloco diz o veredito de elegibilidade", async () => {
    renderComElegibilidade({
      ...eligibilityBase,
      policy: { careerLevelId: "arquiteto-de-solucoes-iii", minimumQualifiedCapabilities: 2 },
      capabilities: [
        { capabilityId: "cloud", confirmed: true, qualified: true },
        { capabilityId: "security", confirmed: true, qualified: true },
      ],
      qualifiedConfirmedCount: 2,
      eligible: true,
    });
    await screen.findByLabelText("Adicionar capacidade ao portfólio");

    expect(screen.getByText(/Elegível para Sênior/)).toBeTruthy();
    expect(screen.getByText(/decisão de quem gerencia/)).toBeTruthy();
  });
});
