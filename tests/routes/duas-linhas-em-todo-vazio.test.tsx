import { cleanup, screen } from "@testing-library/react";
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
import { Route as CalibrationRoute } from "@/routes/calibration";
import { Route as CapabilityMapRoute } from "@/routes/capability-map";
import { Route as CompareRoute } from "@/routes/compare";
import { Route as CyclesRoute } from "@/routes/cycles";
import { Route as DevelopmentPlansRoute } from "@/routes/development-plans";
import { Route as GapAnalysisRoute } from "@/routes/gap-analysis";
import { Route as LearningPathsRoute } from "@/routes/learning-paths";
import { Route as MentoringRoute } from "@/routes/mentoring";
import { Route as ProgressionRoute } from "@/routes/progression";
import { Route as TeamRoute } from "@/routes/team";
import { Route as TeamRulesRoute } from "@/routes/team-rules";
import type { AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
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
 * AS DOZE TELAS DIZEM AS DUAS LINHAS — o item 3 do dono (2026-09-08), tela a
 * tela, com o banco vazio.
 *
 * *"Linha 1 (branca, título), sempre no formato `Nenhum {assunto} cadastrado`
 * / `Nenhuma {assunto} cadastrada` … Linha 2 (cinza, apoio), SEMPRE presente,
 * explicando a regra de negócio daquela tela."*
 *
 * A linha 1 não é escrita aqui tela a tela por acaso: ela é o mesmo punhado
 * de frases, porque quem a diz é o assunto. Este arquivo prova que ela CHEGA
 * na tela; o formato dela é provado uma vez só, em
 * `tests/lib/estado-vazio-fala-uma-lingua.test.ts`.
 */
const fetchMock = vi.fn();

const AssessmentsPage = AssessmentsRoute.options.component as () => ReactNode;
const CalibrationPage = CalibrationRoute.options.component as () => ReactNode;
const CapabilityMapPage = CapabilityMapRoute.options.component as () => ReactNode;
const ComparePage = CompareRoute.options.component as () => ReactNode;
const CyclesPage = CyclesRoute.options.component as () => ReactNode;
const DevelopmentPlansPage = DevelopmentPlansRoute.options.component as () => ReactNode;
const GapAnalysisPage = GapAnalysisRoute.options.component as () => ReactNode;
const LearningPathsPage = LearningPathsRoute.options.component as () => ReactNode;
const MentoringPage = MentoringRoute.options.component as () => ReactNode;
const ProgressionPage = ProgressionRoute.options.component as () => ReactNode;
const TeamPage = TeamRoute.options.component as () => ReactNode;
const TeamRulesPage = TeamRulesRoute.options.component as () => ReactNode;

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
  evidences: [],
  activeCycleId: "",
};

/** Sem time nenhum: é o que o Perfil de Competências do Time precisa ver. */
const semTimes: FetchRoute = (href) =>
  href.endsWith(apiPath("/teams")) ? jsonResponse([]) : undefined;

const NENHUM_PROFISSIONAL = "Nenhum profissional cadastrado";
const NENHUMA_CAPACIDADE = "Nenhuma capacidade cadastrada";
const NENHUMA_TRILHA = "Nenhuma trilha cadastrada";
const NENHUM_CICLO = "Nenhum ciclo cadastrado";
const NENHUM_TIME = "Nenhum time cadastrado";

/**
 * As doze telas, na ordem em que o dono as leu — e, ao lado de cada uma, o
 * par de linhas que ela passa a dizer. A linha 2 é a dele, literal.
 */
const TELAS: { tela: string; pagina: () => ReactNode; linha1: string; linha2: string }[] = [
  {
    tela: "Talentos do Time",
    pagina: TeamPage,
    linha1: NENHUM_PROFISSIONAL,
    linha2:
      "O profissional nasce em Contas e Acessos: conta, cargo, senioridade e time num ato só. Depois de cadastrado, ele aparece aqui.",
  },
  {
    tela: "Avaliação de Desempenho",
    pagina: AssessmentsPage,
    linha1: NENHUM_PROFISSIONAL,
    linha2: "A avaliação começa pelo profissional e pelas capacidades do catálogo.",
  },
  {
    tela: "Risco de Concentração",
    pagina: CapabilityMapPage,
    linha1: NENHUMA_CAPACIDADE,
    linha2:
      "Cadastre a primeira capacidade no Catálogo de Competências para montar o mapa do time.",
  },
  {
    tela: "Prioridades de Desenvolvimento",
    pagina: GapAnalysisPage,
    linha1: NENHUM_PROFISSIONAL,
    linha2:
      "Cadastre profissionais em Time e abra uma avaliação do ciclo para ver as competências em evolução aqui.",
  },
  {
    tela: "Prontidão para Progressão",
    pagina: ProgressionPage,
    linha1: NENHUM_PROFISSIONAL,
    linha2:
      "Cadastre profissionais em Time e abra uma avaliação do ciclo para ver as competências em evolução aqui.",
  },
  {
    tela: "Perfis lado a lado",
    pagina: ComparePage,
    linha1: NENHUM_PROFISSIONAL,
    linha2: "Cadastre profissionais para comparar dois perfis lado a lado.",
  },
  {
    tela: "Plano de Desenvolvimento Individual",
    pagina: DevelopmentPlansPage,
    linha1: NENHUM_PROFISSIONAL,
    linha2: "Cadastre o primeiro profissional para abrir um plano de desenvolvimento.",
  },
  {
    tela: "Trilhas de Aprendizagem",
    pagina: LearningPathsPage,
    linha1: NENHUMA_TRILHA,
    linha2: "Crie a primeira trilha para organizar o desenvolvimento do time.",
  },
  {
    tela: "Mentoria e 1:1",
    pagina: MentoringPage,
    linha1: NENHUM_PROFISSIONAL,
    linha2: "Cadastre o primeiro profissional para registrar mentorias e 1:1.",
  },
  {
    tela: "Ciclos de Avaliação",
    pagina: CyclesPage,
    linha1: NENHUM_CICLO,
    linha2: "O ciclo delimita o período de avaliação, PDI e metas.",
  },
  {
    tela: "Perfil de Competências do Time",
    pagina: TeamRulesPage,
    linha1: NENHUM_TIME,
    linha2:
      "A régua é de um time num nível de carreira: sem time cadastrado não há régua a definir.",
  },
  {
    tela: "Calibração",
    pagina: CalibrationPage,
    linha1: NENHUM_CICLO,
    linha2:
      "A calibração compara avaliações dentro de um ciclo. Cadastre o primeiro ciclo para começar.",
  },
];

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  window.localStorage.setItem("synapse:locale", "pt");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user: fixtureAdminUser,
    state: bancoVazio,
    routes: [emptyAuthUsersRoute, careerLevelsRoute, emptyEligibilityRoute, semTimes],
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A linha 2 chega quebrada em frases curtas (`SentenceBlock`); o texto é um só. */
const temTexto =
  (texto: string) =>
  (_conteudo: string, elemento: Element | null): boolean =>
    elemento?.textContent?.replace(/\s+/g, " ").trim() === texto;

describe("com o banco vazio, toda tela diz duas linhas", () => {
  for (const { tela, pagina: Pagina, linha1, linha2 } of TELAS) {
    it(`${tela}: "${linha1}" + a regra de negócio da tela`, async () => {
      renderWithApp(<Pagina />);

      /*
       * `findAllByText` e não `findByText`: nas telas de pessoa a MESMA linha
       * 1 aparece duas vezes — no filtro bloqueado e no bloco do centro —,
       * e é isso que a padronização faz: uma frase por assunto, não uma por
       * lugar.
       */
      expect((await screen.findAllByText(linha1)).length).toBeGreaterThan(0);
      expect(screen.getAllByText(temTexto(linha2)).length).toBeGreaterThan(0);
    });
  }

  it("as doze telas do dono estão todas nesta lista", () => {
    expect(TELAS).toHaveLength(12);
  });
});
