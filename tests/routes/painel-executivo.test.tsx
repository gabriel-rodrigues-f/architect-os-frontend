import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `cada-fatia-tem-um-dono.test.tsx`: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & {
      to?: string;
      params?: Record<string, string>;
      search?: unknown;
    }) => (
      <a
        {...rest}
        href={Object.entries(params ?? {}).reduce(
          (caminho, [chave, valor]) => caminho.replace(`$${chave}`, valor),
          to ?? "",
        )}
      >
        {children}
      </a>
    ),
  };
});

import { apiPath } from "@/lib/api-path";
import type { ExecutiveBriefing } from "@/lib/gateways/executive-dashboard.gateway";
import type { SessionUser } from "@/lib/api";
import { Route as DashboardRoute } from "@/routes/index";
import { Route as SystemViewRoute } from "@/routes/system-view";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureState,
  fixtureSupportUser,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  operationsOverviewRoute,
  renderWithApp,
} from "../helpers/render-app";

/**
 * O PAINEL EXECUTIVO E A VISÃO DO SISTEMA — duas telas, dois endereços (onda 3).
 *
 * O defeito que esta fatia fecha: `/` despachava por PAPEL, e o administrador
 * — o papel do dono — caía na "Visão do Sistema", que é contagem de cadastro
 * por desenho. Era essa a tela na frente dele quando escreveu "muitos números
 * absolutos". Aqui se prova que ela mudou de endereço e que o administrador
 * passou a ler o painel de NEGÓCIO.
 *
 * `tests/architecture/alcance-por-rota.test.ts` exige este arquivo como prova
 * de tela de `/system-view`.
 */
const fetchMock = vi.fn();

const paginaDe = (route: { options: { component?: unknown } }) =>
  route.options.component as () => ReactNode;

const CICLO = { id: "cy-2", name: "2026 H2", start: "2026-07-01", end: "2026-12-31" };
const CICLO_ANTERIOR = {
  id: "cy-1",
  name: "2026 H1",
  start: "2026-01-01",
  end: "2026-06-30",
};

/** A leitura executiva como o servidor a devolve — sem seta, com os dois ciclos. */
const LEITURA: ExecutiveBriefing = {
  cycle: CICLO,
  comparedCycle: CICLO_ANTERIOR,
  population: { inScope: 3, outOfScope: 1 },
  coverage: { cycle: CICLO, completed: { part: 2, whole: 3 } },
  previousCoverage: { cycle: CICLO_ANTERIOR, completed: { part: 2, whole: 3 } },
  decisionsOnTheDesk: { total: 0, awaitingCalibration: [], awaitingPlanApproval: [] },
  peopleWhoNeedYou: { part: 0, whole: 3 },
  health: {
    funnel: {
      cycle: CICLO,
      steps: [
        { kind: "NOT_STARTED", people: 0 },
        { kind: "DRAFT", people: 0 },
        { kind: "IN_REVIEW", people: 1 },
        { kind: "COMPLETED", people: 2 },
      ],
      biggestHoldUp: ["IN_REVIEW"],
    },
    previousFunnel: null,
    planCoverage: { cycle: CICLO, approved: { part: 1, whole: 3 } },
    previousPlanCoverage: null,
    goalsCompleted: { part: 1, whole: 3 },
    peopleWithoutPlan: [],
    openAndUnscored: [],
  },
  valueCreated: { movement: null, gapMovement: null, promotions: [] },
  trend: {
    available: false,
    cyclesWithReading: 2,
    cyclesRequired: 3,
    cycleNamesWithReading: ["2026 H1", "2026 H2"],
  },
  arrowRuler: { comparablePeople: 2, minimumRelativeChange: 0.5, anyArrowEarned: false },
  risks: {
    criticalGapConcentration: {
      criticalThreshold: 3,
      minimumCompetencies: 3,
      carriers: [],
      assessedWithNoCriticalGap: 2,
      averageGap: 0.5,
      previousAverageGap: 1.33,
    },
    withoutApplicableRuler: { people: { part: 0, whole: 3 }, groups: [] },
    overdueFollowUps: [],
    oneOnOneRecency: [],
    longestSilenceDays: null,
    stalledLearningPaths: [],
  },
  recommendedActions: [],
  actionWeights: [
    "OVERDUE_ONE_ON_ONE",
    "ASSESSMENT_NOT_COMPLETED",
    "NO_APPROVED_PLAN",
    "CRITICAL_GAP_CONCENTRATION",
    "STALLED_LEARNING_PATH",
  ],
  documentedDependencies: [
    { kpi: "Distância até o próximo nível", missing: "agregado de prontidão em lote." },
  ],
};

type Leitura = ExecutiveBriefing;

const briefingRouteDe = (leitura: Leitura) => (href: string) =>
  href.includes(apiPath("/dashboard/executive")) ? jsonResponse(leitura) : undefined;

function renderAs(user: SessionUser, page: ReactNode, leitura: Leitura = LEITURA) {
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAssignedManagerUser ? scopedFixtureStateFor(user) : fixtureState,
    routes: [briefingRouteDe(leitura), operationsOverviewRoute, careerLevelsRoute],
  });
  return renderWithApp(page);
}

const painel = (leitura: Leitura = LEITURA) => {
  const Painel = paginaDe(DashboardRoute);
  return renderAs(fixtureAdminUser, <Painel />, leitura);
};

const blocoDe = (titulo: string) => screen.getByText(titulo).closest("section")!;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("o Painel Executivo é do administrador também", () => {
  it("o administrador abre o painel de NEGÓCIO, não a contagem de cadastro", async () => {
    const Painel = paginaDe(DashboardRoute);
    renderAs(fixtureAdminUser, <Painel />);

    expect(await screen.findByRole("heading", { level: 1, name: "Painel Executivo" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1, name: "Visão do Sistema" })).toBeNull();
  });

  it("o gerente lê o mesmo painel, com a cobertura publicada como fração", async () => {
    const Painel = paginaDe(DashboardRoute);
    renderAs(fixtureAssignedManagerUser, <Painel />);

    expect(await screen.findByRole("heading", { level: 1, name: "Painel Executivo" })).toBeTruthy();
    expect((await screen.findAllByText("2 de 3")).length).toBeGreaterThan(0);
  });

  it("o suporte continua na operação do sistema — ele não lê carreira de ninguém", async () => {
    const Painel = paginaDe(DashboardRoute);
    renderAs(fixtureSupportUser, <Painel />);

    expect(await screen.findByRole("heading", { level: 1, name: "Visão do Sistema" })).toBeTruthy();
  });
});

describe("o bloco Tendências nasce vazio e declara a base", () => {
  it("com dois ciclos lidos, a tela diz que não há série — e não desenha linha nenhuma", async () => {
    const Painel = paginaDe(DashboardRoute);
    renderAs(fixtureAdminUser, <Painel />);

    expect(await screen.findByText("Nenhuma série de ciclos para desenhar")).toBeTruthy();
    expect(
      screen.getByText(/A comparação entre ciclos aparece quando houver um terceiro ciclo/),
    ).toBeTruthy();
  });

  it("nenhum indicador leva seta, e o rodapé escreve a régua com o número que a sustenta", async () => {
    const Painel = paginaDe(DashboardRoute);
    renderAs(fixtureAdminUser, <Painel />);

    expect(
      await screen.findByText(
        /Nenhum indicador leva seta: com 2 pessoas comparáveis, a variação precisaria exceder/,
      ),
    ).toBeTruthy();
  });
});

describe("Visão do Sistema tem endereço próprio", () => {
  it("abre para quem opera o sistema", async () => {
    const Pagina = paginaDe(SystemViewRoute);
    renderAs(fixtureSupportUser, <Pagina />);

    expect(await screen.findByRole("heading", { level: 1, name: "Visão do Sistema" })).toBeTruthy();
  });

  it("nega o profissional por escrito, e a tela negada continua se explicando", async () => {
    const Pagina = paginaDe(SystemViewRoute);
    renderAs(fixtureMemberUser, <Pagina />);

    expect(
      await screen.findByText(
        "Esta tela é de quem opera o sistema. O seu painel é o Painel Executivo.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /como usar/i })).toBeTruthy();
  });
});

/**
 * OS INVARIANTES DA ONDA 1, na tela nova. Eles não foram descartados com o
 * desenho antigo: o que mudou é DE ONDE o número vem — antes somado no
 * navegador, agora lido do contrato. A afirmação é a mesma.
 */
describe("faixa no lugar da cor única, nome no lugar do agregado", () => {
  it("cobertura de 50% sai em tom crítico — abaixo de 70% o ciclo não foi lido", async () => {
    painel({
      ...LEITURA,
      coverage: { cycle: CICLO, completed: { part: 1, whole: 2 } },
    });
    await screen.findByText("1 de 2");

    const cobertura = blocoDe("Pessoas avaliadas no ciclo").querySelector("[data-key-figure]")!;
    expect(cobertura.getAttribute("data-tone")).toBe("critical");
    expect(within(cobertura as HTMLElement).getByText(/Ciclo ainda não lido/)).toBeTruthy();
  });

  it("cobertura cheia sai em tom bom — a mesma tela, duas cores", async () => {
    painel({
      ...LEITURA,
      coverage: { cycle: CICLO, completed: { part: 3, whole: 3 } },
    });
    await screen.findByText("3 de 3");

    const cobertura = blocoDe("Pessoas avaliadas no ciclo").querySelector("[data-key-figure]")!;
    expect(cobertura.getAttribute("data-tone")).toBe("good");
  });

  it("o bloco de distância crítica nomeia quem a carrega, e o nome leva à ficha", async () => {
    painel({
      ...LEITURA,
      risks: {
        ...LEITURA.risks,
        criticalGapConcentration: {
          ...LEITURA.risks.criticalGapConcentration,
          carriers: [{ professionalId: "bruno", name: "Bruno Almeida", competencies: 12 }],
          assessedWithNoCriticalGap: 1,
        },
      },
    });

    const bruno = await screen.findByText("Bruno Almeida");
    expect(bruno.getAttribute("href")).toBe("/professionals/bruno");
    expect(screen.getByText("12 competências")).toBeTruthy();
  });

  it("sem nenhuma distância crítica, o bloco diz isso em vez de listar nome", async () => {
    painel();

    expect(await screen.findByText("Nenhuma distância crítica no ciclo")).toBeTruthy();
    expect(screen.queryByText("Bruno Almeida")).toBeNull();
  });

  it("os sinais de acompanhamento terminam em nome, e a ausência de 1:1 não vira zero", async () => {
    painel({
      ...LEITURA,
      risks: {
        ...LEITURA.risks,
        overdueFollowUps: [
          {
            professionalId: "ana",
            name: "Ana Martins",
            dueOn: "2026-08-01",
            lastSessionOn: "2026-07-08",
          },
        ],
        longestSilenceDays: 63,
        stalledLearningPaths: [
          {
            professionalId: "bruno",
            name: "Bruno Almeida",
            pathId: "tr-1",
            pathName: "Security Path",
            completedItems: 0,
            totalItems: 9,
          },
        ],
      },
    });

    const ana = await screen.findByText("Ana Martins");
    expect(ana.getAttribute("href")).toBe("/professionals/ana");
    expect(screen.getByText(/Maior silêncio do time: 63 dias/)).toBeTruthy();
    expect(screen.getByText("Security Path: 0 de 9")).toBeTruthy();
  });

  it("sem 1:1 vencida e sem trilha parada, os dois sinais dizem o vazio", async () => {
    painel();

    expect(await screen.findByText("Nenhum retorno de 1:1 vencido.")).toBeTruthy();
    expect(screen.getByText("Nenhuma trilha parada em zero.")).toBeTruthy();
  });

  it("a fila da semana publica o peso na própria tela — nada de caixa-preta", async () => {
    painel({
      ...LEITURA,
      recommendedActions: [
        {
          professionalId: "ana",
          name: "Ana Martins",
          reason: "OVERDUE_ONE_ON_ONE",
          weight: 1,
        },
      ],
    });

    expect(await screen.findByText("1:1 de retorno vencida")).toBeTruthy();
    expect(screen.getByText(/^Ordem: 1:1 de retorno vencida >/)).toBeTruthy();
  });

  it("os sete blocos que o dono nomeou estão na tela, e há UM gráfico só", async () => {
    painel();
    await screen.findByText("Nenhuma série de ciclos para desenhar");

    for (const bloco of [
      "Pessoas avaliadas no ciclo",
      "Decisões na sua mesa",
      "Pessoas que precisam de você",
      "Saúde do Ciclo",
      "Geração de Valor",
      "Tendências",
      "Riscos",
      "A fila da semana",
    ]) {
      expect(screen.getByText(bloco), bloco).toBeTruthy();
    }
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
});
