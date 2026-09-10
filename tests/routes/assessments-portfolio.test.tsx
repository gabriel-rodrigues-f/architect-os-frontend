import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { type AppState } from "@/lib/api";
import type { Assessment, AssessmentCapability } from "@/lib/domain";
import { fixtureAssignedTechLeadUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, hrefOf } from "../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * ORIENTACAO-NONA-RODADA, Seção 8/32 — cobertura dedicada do Portfólio de
 * Capacidades do Ciclo (`CareerPortfolioSection`, `routes/assessments.tsx`):
 * nenhum teste existia antes desta rodada.
 */

const fetchMock = vi.fn();

const itemDe = (
  competencyId: string,
  capabilityId: string,
  target: 1 | 2 | 3 | 4 | 5,
  final: 1 | 2 | 3 | 4 | 5,
): Assessment["items"][number] => ({
  competencyId,
  capabilityId,
  self: null,
  leader: null,
  target,
  final,
  comments: [],
  version: 1,
});

const draftAssessment: Assessment = {
  id: "asmt-ana-draft",
  professionalId: "ana",
  cycleId: "2026-h2",
  status: "Draft",
  modelVersion: 2,
  targetCareerLevelId: "arquiteto-de-solucoes-iii",
  targetSemantics: "NEXT_ROLE",
  version: 1,
  /*
   * DONO, 2026-09-10 — o estágio de cada capacidade deixou de vir pronto da
   * rota da elegibilidade e passa a ser lido dos ITENS: qualificada é a
   * capacidade cujas competências avaliadas chegaram ao alvo congelado.
   * `cloud` chega (3 ≥ 3 e 4 ≥ 3); `security` não (2 < 3).
   */
  items: [
    itemDe("cloud-k8s", "cloud", 3, 3),
    itemDe("cloud-serverless", "cloud", 3, 4),
    itemDe("security-iam", "security", 3, 2),
  ],
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

const entradaDoPortfolio = (capabilityId: string, confirmada: boolean): AssessmentCapability => ({
  id: `portfolio-${capabilityId}`,
  assessmentId: draftAssessment.id,
  capabilityId,
  addedByUserId: "test-lead",
  addedAt: "2026-08-20T00:00:00Z",
  confirmedByUserId: confirmada ? "test-lead" : null,
  confirmedAt: confirmada ? "2026-08-21T00:00:00Z" : null,
});

/** O portfólio VAZIO — o estado com que a maioria dos casos começa. */
const portfolioVazio: AssessmentCapability[] = [];

const rotaDoPortfolio = (linhas: AssessmentCapability[]) => (href: string, init?: RequestInit) =>
  init?.method === undefined &&
  href.includes(apiPath(`/assessments/${draftAssessment.id}/capabilities`))
    ? jsonResponse(linhas)
    : undefined;

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
      routes: [rotaDoPortfolio(portfolioVazio), addCapabilityRoute],
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
    // consulta do portfólio já resolveu.
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
    expect(screen.getByText(/Selecione as capacidades que este ciclo vai avaliar/)).toBeTruthy();
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
    // primeira consulta do portfólio a falhar.
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state,
      routes: [
        (href, init) =>
          init?.method === undefined &&
          href.includes(apiPath(`/assessments/${draftAssessment.id}/capabilities`))
            ? new Response("{}", { status: 500 })
            : undefined,
      ],
    });

    renderPage();
    await screen.findByText("Portfólio de Capacidades do Ciclo");
    await waitFor(() =>
      expect(screen.getByText("Não foi possível carregar o portfólio.")).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
  });

  it("adicionar capacidade invalida também o estado principal do app (Assessment/items), não só o portfólio", async () => {
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
      routes: [rotaDoPortfolio(portfolioVazio), addCapabilityRoute],
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
    // do app (Problema 2), não só a query do portfólio.
    await waitFor(() => {
      const stateCallsAfter = fetchMock.mock.calls.filter(([u]) =>
        hrefOf(u as string | URL | Request).endsWith(apiPath("/assessments")),
      ).length;
      expect(stateCallsAfter).toBeGreaterThan(stateCallsBefore);
    });
  });

  /**
   * ESTADO PARCIAL — a confusão que o dono relatou (2026-09-09) era dois
   * selos de mesma forma contra o MESMO denominador, com significados
   * diferentes, mais uma barra de 66%. Sobrou UM medidor, com uma vaga por
   * capacidade do portfólio, tingida pelo estágio.
   *
   * DONO, 2026-09-10 — o número-síntese "1/3" e a vaga tracejada "a
   * selecionar" morreram com o MÍNIMO de capacidades qualificadas: não existe
   * mais denominador cravado na pedra. O medidor conta o que ESTÁ no
   * portfólio, e mais nada.
   */
  const renderComPortfolio = (linhas: AssessmentCapability[]) => {
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state,
      routes: [rotaDoPortfolio(linhas)],
    });
    return renderPage();
  };

  const parcial: AssessmentCapability[] = [
    entradaDoPortfolio("cloud", true),
    entradaDoPortfolio("security", true),
  ];

  it("no estado parcial, nenhum número sugere um mínimo a atingir", async () => {
    renderComPortfolio(parcial);
    await screen.findByLabelText("Adicionar capacidade ao portfólio");

    expect(screen.queryByText("1/3")).toBeNull();
    expect(screen.queryByText(/Faltam \d+ capacidade/)).toBeNull();
    expect(screen.queryByText(/Eleg[íi]vel/)).toBeNull();
  });

  it("no estado parcial, o medidor separa os estágios — e não inventa vaga a selecionar", async () => {
    renderComPortfolio(parcial);
    await screen.findByLabelText("Adicionar capacidade ao portfólio");

    const medidor = screen.getByLabelText("1 de 2 capacidades no alvo");
    const vagas = medidor.querySelectorAll("[data-portfolio-slot]");
    expect(Array.from(vagas).map((vaga) => vaga.getAttribute("data-portfolio-slot"))).toEqual([
      "qualified",
      "belowBar",
    ]);
  });

  it("no estado parcial, a legenda conta cada estágio uma vez", async () => {
    renderComPortfolio(parcial);
    await screen.findByLabelText("Adicionar capacidade ao portfólio");

    expect(screen.getByText(/^1 qualificada/)).toBeTruthy();
    expect(screen.getByText(/^1 abaixo da régua/)).toBeTruthy();
    expect(screen.queryByText(/a selecionar/)).toBeNull();
  });

  /**
   * A capacidade AINDA NÃO CONFIRMADA continua sendo o terceiro estágio — ela
   * está no portfólio e não conta, e isso nada tem a ver com o veredito que
   * morreu.
   */
  it("capacidade proposta e não confirmada aparece como aguardando confirmação", async () => {
    renderComPortfolio([entradaDoPortfolio("cloud", false)]);
    await screen.findByLabelText("Adicionar capacidade ao portfólio");

    expect(screen.getByText(/^1 aguardando confirmação/)).toBeTruthy();
  });
});
