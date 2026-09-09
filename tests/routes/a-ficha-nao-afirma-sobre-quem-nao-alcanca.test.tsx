import { cleanup, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/ficha-router").then((mod) => mod.reactRouterOfCareerFile()),
);

import type { AppState, SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { Route as ProfileRoute } from "@/routes/professionals.$professionalId.index";
import { Route as RoadmapRoute } from "@/routes/professionals.$professionalId.roadmap";
import { Route as StatementRoute } from "@/routes/professionals.$professionalId.statement";
import {
  fixtureAssignedManagerUser,
  fixtureState,
  fixtureUnassignedTechLeadUser,
} from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  type FetchRoute,
} from "../helpers/render-app";
import { renderCareerFile } from "../helpers/ficha";

/**
 * ONDE A TELA NÃO PODE DISTINGUIR "NÃO TEM" DE "NÃO POSSO VER", ELA NÃO
 * AFIRMA NENHUM DOS DOIS.
 *
 * As quatro listagens por pessoa (avaliações, PDI, mentoria, trilhas) passaram
 * a responder `200 []` a quem não alcança a pessoa, no lugar de `403`. Lista
 * vazia deixou de ser prova de que não há nada: ela pode ser silêncio. E a
 * ficha vinha AFIRMANDO sobre essa lista vazia — "0" no cartão de
 * competências em evolução, "0 sessões registradas" na mentoria, um alerta de
 * warning dizendo que "nenhuma trilha cobre" as competências inteiras da
 * pessoa, e um extrato que perdia PDI e mentoria em silêncio.
 *
 * O ator destes testes é a conta de LIDERANÇA SEM VÍNCULO: ela passa pela
 * guarda de navegação (a régua da porta é a do papel — só o id está em mãos) e
 * não alcança ESTA pessoa. É a mesma divergência que o servidor já tem medida
 * entre `directoryScope` (o diretório, que entrega o nome) e
 * `visibleProfessionalIds` (o desempenho, que não entrega os números).
 *
 * O par de cada teste é a conta que ALCANÇA: com vínculo, a mesma lista vazia
 * volta a ser afirmável, e a tela diz "0" e "nenhuma" como sempre disse.
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;
const RoadmapPage = RoadmapRoute.options.component as () => ReactNode;
const StatementPage = StatementRoute.options.component as () => ReactNode;

const NIVEL_ATUAL = "arquiteto-de-solucoes-ii";

const FORA_DO_ALCANCE = (assunto: string) =>
  `${assunto} desta pessoa estão fora do seu alcance: esta tela não afirma nem que há, nem que não há.`;

/**
 * O mundo depois da fatia irmã: o DIRETÓRIO entrega a pessoa (nome, time,
 * nível) e as quatro listagens por pessoa voltam vazias — indistinguíveis de
 * uma pessoa que de fato não tem nada.
 */
const listagensVazias: AppState = {
  ...fixtureState,
  professionals: fixtureState.professionals.map((professional) =>
    professional.id === "ana" ? { ...professional, careerLevelId: NIVEL_ATUAL } : professional,
  ),
  assessments: [],
  plans: [],
  mentoringSessions: [],
  learningPaths: [],
};

/**
 * Uma capacidade do catálogo que a avaliação da Ana NÃO toca. É o defeito do
 * `?? 0` sem nenhuma questão de alcance no meio: a ficha desenhava esse eixo
 * no CENTRO do radar (zero) e a aresta atravessava o polígono.
 */
const comCapacidadeSemMedida: AppState = {
  ...fixtureState,
  capabilities: [
    ...fixtureState.capabilities,
    {
      id: "dados",
      name: "Arquitetura de Dados",
      short: "Dados",
      active: true,
      curation: { activeCompetencyCount: 1, status: "READY" },
    },
  ],
  competencies: [
    ...fixtureState.competencies,
    { id: "dados-modelagem", name: "Modelagem", capabilityId: "dados", active: true },
  ],
};

const aderenciaComFaltantes: FetchRoute = (href) => {
  if (!href.includes(apiPath("/professionals/ana/adherence"))) return undefined;
  const careerLevelId = new URL(href, "http://localhost").searchParams.get("careerLevelId") ?? "";
  return jsonResponse({
    professionalId: "ana",
    teamId: "time-plataforma",
    careerLevelId,
    adherence: {
      percentage: 0.5,
      missingCompetencies: [{ competencyId: "security-iam", currentLevel: 1, requiredLevel: 4 }],
    },
  });
};

/** As fontes do Extrato que vêm do SERVIDOR respondem vazias e sem erro. */
const extratoVazio: FetchRoute[] = [
  (href) =>
    href.endsWith(apiPath("/professionals/ana/career-level-transitions"))
      ? jsonResponse([])
      : undefined,
  (href, init) =>
    href.endsWith(apiPath("/reports/career-statement")) && init?.method === "POST"
      ? jsonResponse({
          professional: { id: "ana", name: "Ana Martins", role: "Pleno" },
          range: { from: "2000-01-01", to: "2026-12-31" },
          kinds: ["teamTransition"],
          totals: { teamTransition: 0 },
          entries: [],
        })
      : undefined,
  (href, init) =>
    href.endsWith(apiPath("/evolution/professional")) && init?.method === "POST"
      ? jsonResponse({
          professional: { id: "ana", name: "Ana Martins", role: "Pleno", careerLevelName: null },
          summary: {
            coverage: { covered: 0, total: 0 },
            initialAverage: null,
            currentAverage: null,
            averageDelta: null,
            mentoringCount: 0,
            assessmentCount: 0,
          },
          capabilitySeries: [],
          competencySeries: [],
          events: [],
          snapshots: [],
          comparisons: [],
        })
      : undefined,
];

function renderComo(
  user: SessionUser,
  Page: () => ReactNode,
  tab: "overview" | "roadmap" | "statement",
  routes: FetchRoute[] = [],
  state: AppState = listagensVazias,
) {
  mockAppFetch(fetchMock, { user, state, routes: [careerLevelsRoute, ...routes] });
  return renderCareerFile(<Page />, { tab, professionalId: "ana" });
}

/**
 * "Competências em evolução" nomeia DUAS coisas na Visão geral: o cartão de
 * contagem e o cartão da lista. O contador é o do número-síntese.
 */
async function cartaoDeCompetenciasEmEvolucao(): Promise<HTMLElement> {
  const rotulos = await screen.findAllByText("Competências em evolução");
  const cartao = rotulos
    .map((rotulo) => rotulo.closest("[data-key-figure]"))
    .find((encontrado): encontrado is HTMLElement => encontrado !== null);
  if (!cartao) throw new Error("A Visão geral não desenhou o cartão de contagem.");
  return cartao;
}

beforeEach(() => {
  window.localStorage.setItem("synapse:locale", "pt");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("os contadores da Visão geral não afirmam sobre lista que pode ser silêncio", () => {
  it("competências em evolução: quem não alcança lê um traço, não um zero", async () => {
    renderComo(fixtureUnassignedTechLeadUser, ProfilePage, "overview");

    const cartao = await cartaoDeCompetenciasEmEvolucao();
    expect(within(cartao).queryByText("0")).toBeNull();
    expect(within(cartao).getByText("—")).toBeTruthy();
  });

  it("competências em evolução: quem alcança e não tem nenhuma continua lendo zero", async () => {
    renderComo(fixtureAssignedManagerUser, ProfilePage, "overview");

    const cartao = await cartaoDeCompetenciasEmEvolucao();
    expect(within(cartao).getByText("0")).toBeTruthy();
  });

  it("mentorias: quem não alcança não lê '0 sessões registradas'", async () => {
    renderComo(fixtureUnassignedTechLeadUser, ProfilePage, "overview");

    await screen.findByText("Mentorias");
    expect(screen.queryByText("0 sessões registradas")).toBeNull();
    expect(screen.getByText(FORA_DO_ALCANCE("As mentorias"))).toBeTruthy();
  });

  it("mentorias: quem alcança e não tem nenhuma continua lendo o contador", async () => {
    renderComo(fixtureAssignedManagerUser, ProfilePage, "overview");

    expect(await screen.findByText("0 sessões registradas")).toBeTruthy();
  });
});

describe("o radar da ficha não desenha zero onde não há medida", () => {
  it("sem nenhuma avaliação alcançável, o radar fica vazio em vez de colapsar no centro", async () => {
    renderComo(fixtureUnassignedTechLeadUser, ProfilePage, "overview");

    expect(await screen.findByText("Nenhum nível registrado neste ciclo")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Radar de nível atual versus esperado/ })).toBeNull();
  });

  it("com avaliação parcial, a capacidade sem medida SAI do radar em vez de ir a zero", async () => {
    renderComo(fixtureAssignedManagerUser, ProfilePage, "overview", [], comCapacidadeSemMedida);

    await screen.findByText("Perfil por capacidade");
    const capacidades = screen
      .getAllByRole("row")
      .slice(1)
      .map((linha) => within(linha).getAllByRole("cell")[0]?.textContent);

    expect(capacidades).toContain("Cloud Architecture");
    expect(capacidades).not.toContain("Arquitetura de Dados");
  });
});

describe("o alerta de cobertura do Roteiro não afirma sobre trilha que pode ser silêncio", () => {
  it("quem não alcança não lê o alerta de que nenhuma trilha cobre a pessoa", async () => {
    renderComo(fixtureUnassignedTechLeadUser, RoadmapPage, "roadmap", [aderenciaComFaltantes]);

    await screen.findByText("Trilhas que cobrem");
    expect(screen.queryByText("Nenhuma trilha cobre:")).toBeNull();
    expect(await screen.findByText(FORA_DO_ALCANCE("As trilhas"))).toBeTruthy();
  });

  it("quem alcança continua lendo o alerta — ali a lista vazia é fato", async () => {
    renderComo(fixtureAssignedManagerUser, RoadmapPage, "roadmap", [aderenciaComFaltantes]);

    expect(await screen.findByText("Nenhuma trilha cobre:")).toBeTruthy();
  });
});

describe("o Extrato não mostra meia história como se fosse a história inteira", () => {
  it("quem não alcança é avisado de que PDI e mentoria podem estar faltando", async () => {
    renderComo(fixtureUnassignedTechLeadUser, StatementPage, "statement", extratoVazio);

    expect(
      await screen.findByText("A linha do tempo pode estar incompleta: Eventos de PDI, Mentorias."),
    ).toBeTruthy();
  });

  it("quem alcança não é avisado de nada — a história dele está inteira", async () => {
    renderComo(fixtureAssignedManagerUser, StatementPage, "statement", extratoVazio);

    await screen.findByText("Extrato de carreira — Ana Martins");
    expect(screen.queryByText(/A linha do tempo pode estar incompleta/)).toBeNull();
  });
});
