import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** O `<Link>` do roteador exige um RouterProvider real; aqui basta a âncora. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/",
    Link: ({
      children,
      to,
      params: _params,
      search,
      ...rest
    }: ComponentProps<"a"> & {
      to?: string;
      params?: unknown;
      search?: Record<string, string> | undefined;
    }) => (
      <a href={search ? `${to ?? ""}?${new URLSearchParams(search).toString()}` : to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { Route as AssessmentsRoute } from "@/routes/assessments";
import { Route as CapabilityMapRoute } from "@/routes/capability-map";
import { Route as CompetencyMatrixRoute } from "@/routes/competency-matrix";
import { Route as CyclesRoute } from "@/routes/cycles";
import { Route as DevelopmentPlansRoute } from "@/routes/development-plans";
import { Route as GapAnalysisRoute } from "@/routes/gap-analysis";
import { Route as LearningPathsRoute } from "@/routes/learning-paths";
import { Route as MentoringRoute } from "@/routes/mentoring";
import { Route as ProgressionRoute } from "@/routes/progression";
import type { AppState, SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser, fixtureAssignedTechLeadUser, fixtureState } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  emptyAuthUsersRoute,
  emptyEligibilityRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * O BOTÃO DE CADASTRO NO CENTRO DA TELA, TELA A TELA.
 *
 * Dono (2026-09-08), literal: *"o usuário precisa ver, à primeira vista, o
 * botão de cadastro quando não há nada cadastrado. Ao invés de aparecer como
 * linha clicável no filtro, vamos bloquear o filtro e disponibilizamos o
 * botão de criação mais abaixo, dentro do quadro principal e centralizado na
 * tela."*
 *
 * O desenho é UM (`EmptyStateCallToAction`) e a régua é UMA (`Registration`).
 * O que muda de tela para tela é QUAL assunto está vazio — e é isso que esta
 * suíte guarda, com o banco vazio, exatamente como o dono ditou:
 * Avaliação de Desempenho com DOIS botões, Risco de Concentração com
 * "Cadastrar Capacidade", as telas de pessoa com "Cadastrar Profissional",
 * Calibração com "Cadastrar Ciclo", e Trilhas/Ciclos/Catálogo trocando o
 * botão do canto pelo do centro enquanto não houver nada.
 */
const fetchMock = vi.fn();

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;
const CapabilityMapPage = CapabilityMapRoute.options.component as () => ReactNode;
const CompetencyMatrixPage = CompetencyMatrixRoute.options.component as () => ReactNode;
const CyclesPage = CyclesRoute.options.component as () => ReactNode;
const DevelopmentPlansPage = DevelopmentPlansRoute.options.component as () => ReactNode;
const GapAnalysisPage = GapAnalysisRoute.options.component as () => ReactNode;
const LearningPathsPage = LearningPathsRoute.options.component as () => ReactNode;
const MentoringPage = MentoringRoute.options.component as () => ReactNode;
const ProgressionPage = ProgressionRoute.options.component as () => ReactNode;

/** O banco recém-criado: nenhuma pessoa, nenhuma capacidade, nenhum ciclo. */
const bancoVazio: AppState = {
  ...fixtureState,
  capabilities: [],
  competencies: [],
  teamLevelRules: [],
  professionals: [],
  assessments: [],
  cycles: [],
  plans: [],
  learningPaths: [],
  mentoringSessions: [],
  activeCycleId: "",
};

const comBanco = (user: SessionUser, state: AppState, routes: FetchRoute[] = []) =>
  mockAppFetch(fetchMock, {
    user,
    state,
    routes: [emptyAuthUsersRoute, careerLevelsRoute, emptyEligibilityRoute, ...routes],
  });

const comoAdmin = (routes: FetchRoute[] = []) => comBanco(fixtureAdminUser, bancoVazio, routes);

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  window.localStorage.setItem("synapse:locale", "pt");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** O botão do centro é sempre um só desenho — âncora quando leva a outra tela. */
const botaoDeCadastro = (rotulo: string) => screen.getByRole("link", { name: rotulo });

describe("com o banco vazio, o cadastro aparece no centro do quadro principal", () => {
  it("Avaliação de Desempenho: DOIS botões — Cadastrar Profissional e Cadastrar Capacidade", async () => {
    comoAdmin();
    renderWithApp(<AssessmentsPage />);

    expect((await screen.findAllByText("Nenhum profissional cadastrado")).length).toBeGreaterThan(
      0,
    );
    expect(botaoDeCadastro("Cadastrar Profissional").getAttribute("href")).toBe(
      "/users?cadastrar=profissional",
    );
    expect(botaoDeCadastro("Cadastrar Capacidade").getAttribute("href")).toBe(
      "/competency-matrix?cadastrar=capacidade",
    );
  });

  it("Risco de Concentração: Cadastrar Capacidade", async () => {
    comoAdmin();
    renderWithApp(<CapabilityMapPage />);

    expect(await screen.findByText("Nenhuma capacidade cadastrada")).toBeTruthy();
    expect(botaoDeCadastro("Cadastrar Capacidade")).toBeTruthy();
  });

  it("Prioridades de Desenvolvimento: Cadastrar Profissional", async () => {
    comoAdmin();
    renderWithApp(<GapAnalysisPage />);

    expect((await screen.findAllByText("Nenhum profissional cadastrado")).length).toBeGreaterThan(
      0,
    );
    expect(botaoDeCadastro("Cadastrar Profissional")).toBeTruthy();
  });

  it("Prontidão para Progressão: o botão só no centro", async () => {
    comoAdmin();
    renderWithApp(<ProgressionPage />);

    expect((await screen.findAllByText("Nenhum profissional cadastrado")).length).toBeGreaterThan(
      0,
    );
    expect(botaoDeCadastro("Cadastrar Profissional")).toBeTruthy();
    // O filtro do cabeçalho continua lá, bloqueado — e sem porta nenhuma.
    const filtro = screen.getByRole("button", { name: "Profissionais" });
    expect(filtro.getAttribute("aria-disabled")).toBe("true");
  });

  it("PDI: o cadastro sai do filtro e vai para o centro", async () => {
    comoAdmin();
    renderWithApp(<DevelopmentPlansPage />);

    expect((await screen.findAllByText("Nenhum profissional cadastrado")).length).toBeGreaterThan(
      0,
    );
    expect(botaoDeCadastro("Cadastrar Profissional")).toBeTruthy();
  });

  it("Mentoria e 1:1: o cadastro sai do filtro e vai para o centro", async () => {
    comoAdmin();
    renderWithApp(<MentoringPage />);

    expect((await screen.findAllByText("Nenhum profissional cadastrado")).length).toBeGreaterThan(
      0,
    );
    expect(botaoDeCadastro("Cadastrar Profissional")).toBeTruthy();
  });

  /**
   * Quem alcança a TELA mas não o CADASTRO lê a frase e não recebe botão —
   * mandar alguém para uma porta fechada é pior do que não oferecer porta.
   */
  it("quem não alcança o cadastro lê a frase e não recebe botão nenhum", async () => {
    comBanco(fixtureAssignedTechLeadUser, bancoVazio);
    renderWithApp(<ProgressionPage />);

    expect((await screen.findAllByText("Nenhum profissional cadastrado")).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByRole("link", { name: /Cadastrar/ })).toBeNull();
  });
});

/**
 * As três telas em que o cadastro é um DIÁLOGO da própria tela: o botão
 * MUDA DE LUGAR, não se duplica. Sem nada cadastrado ele está no centro;
 * com pelo menos um registro, volta ao canto superior direito.
 */
describe("Trilhas, Ciclos e Catálogo: o botão do canto troca de lugar, não se duplica", () => {
  it("Trilhas de Aprendizagem: sem trilha, o botão do canto some e aparece no centro", async () => {
    comoAdmin();
    renderWithApp(<LearningPathsPage />);

    expect(await screen.findByText("Nenhuma trilha cadastrada")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Cadastrar Trilha" })).toHaveLength(1);
  });

  it("Trilhas de Aprendizagem: com uma trilha, o botão volta ao canto e o centro some", async () => {
    comBanco(fixtureAdminUser, { ...bancoVazio, learningPaths: fixtureState.learningPaths });
    renderWithApp(<LearningPathsPage />);

    expect(await screen.findByRole("button", { name: "Cadastrar Trilha" })).toBeTruthy();
    expect(screen.queryByText("Nenhuma trilha cadastrada")).toBeNull();
  });

  it("Ciclos de Avaliação: o botão de cadastro vai para o centro", async () => {
    comoAdmin();
    renderWithApp(<CyclesPage />);

    expect(await screen.findByText("Nenhum ciclo cadastrado")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Cadastrar Ciclo" })).toHaveLength(1);
  });

  it("Ciclos de Avaliação: com um ciclo, o botão é o do canto — e o centro some", async () => {
    comBanco(fixtureAdminUser, { ...bancoVazio, cycles: fixtureState.cycles });
    renderWithApp(<CyclesPage />);

    expect(await screen.findByRole("button", { name: "Cadastrar Ciclo" })).toBeTruthy();
    expect(screen.queryByText("Nenhum ciclo cadastrado")).toBeNull();
  });

  /**
   * Dono (2026-09-08, com captura): *"Ao clicar em 'Cadastrar primeiro
   * ciclo', devo ser direcionado ao FORMULÁRIO de cadastro de ciclo."* Levar
   * à tela não basta — era o que o botão do ciclo fazia, sozinho entre os
   * quatro assuntos. O parâmetro é o mesmo de Times, Contas e Catálogo, e
   * quem o escreve no link é o `Registration`.
   */
  it("Ciclos de Avaliação: chegando por `?cadastrar=ciclo`, o formulário já nasce aberto", async () => {
    window.history.replaceState(null, "", "/cycles?cadastrar=ciclo");
    comoAdmin();
    renderWithApp(<CyclesPage />);

    const formulario = await screen.findByRole("dialog");
    expect(formulario.textContent).toContain("Cadastrar Ciclo");
    expect(within(formulario).getByLabelText("Início")).toBeTruthy();
  });

  it("Catálogo de Competências: sem capacidades, o botão vai para o centro", async () => {
    comoAdmin();
    renderWithApp(<CompetencyMatrixPage />);

    expect(await screen.findByText("Nenhuma capacidade cadastrada")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Cadastrar Capacidade" })).toHaveLength(1);
  });
});

/**
 * O BUG IRMÃO — mesma causa, banco vazio (dono, 2026-09-08).
 *
 * `GapClosureSection` perguntava `gapClosure({})` sem ciclo; o servidor
 * tentava resolver "o ciclo vigente", não havia nenhum, e o 404 de NEGÓCIO
 * virava "Não foi possível carregar a evolução entre ciclos" em vermelho —
 * como se o serviço tivesse caído. Agora a seção só pergunta quando existe
 * ciclo.
 */
describe("a evolução entre ciclos, com o banco vazio", () => {
  const rotaProibida: FetchRoute = (href) =>
    href.includes(apiPath("/analytics/gap-closure"))
      ? jsonResponse({ message: "sem ciclo" }, 404)
      : undefined;

  it("não pergunta nada e não pinta erro de serviço", async () => {
    comoAdmin([rotaProibida]);
    renderWithApp(<GapAnalysisPage />);

    expect(await screen.findByText("Nenhum ciclo para comparar")).toBeTruthy();
    expect(screen.queryByText("Não foi possível carregar a evolução entre ciclos")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      fetchMock.mock.calls.filter(([entrada]) =>
        String(entrada instanceof Request ? entrada.url : entrada).includes(
          "/analytics/gap-closure",
        ),
      ),
    ).toHaveLength(0);
  });
});
