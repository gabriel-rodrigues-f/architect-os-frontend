import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** `<Link>` do TanStack Router precisa de um `RouterProvider` real; aqui vira âncora. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  };
});

import type { SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { Route as CyclesRoute } from "@/routes/cycles";
import { Route as LearningRoute } from "@/routes/learning-paths";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { Route as TeamsRoute } from "@/routes/teams";
import { Route as UsersRoute } from "@/routes/users";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureState,
  fixtureTeamId,
} from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Pedido do dono (2026-09-08), literal: *"o botão 'Cadastrar Trilha' em Trilhas de
 * Aprendizagem tem a mesma identidade visual de 'Ciclos de Avaliação > Novo
 * ciclo' e 'Catálogo de Competências > Nova capacidade'. Mas 'Estrutura de
 * Times > Criar time' e 'Contas e Acessos > Cadastrar pessoas' não seguem o
 * mesmo padrão."*
 *
 * As cinco telas que ele citou, lado a lado: a ação principal de cada uma sai
 * do MESMO componente (`PageAction`) — o mesmo papel (`data-page-action`), a
 * mesma tinta, a mesma altura, o mesmo ícone. Antes deste teste, Times e
 * Contas nasciam `size="sm"` e as outras três no tamanho padrão; era a régua
 * na cabeça de quem escrevia a tela, e não num objeto.
 */
const fetchMock = vi.fn();

const TIMES = [
  { id: fixtureTeamId, name: "Time Plataforma", active: true },
  { id: "time-dados", name: "Time Dados", active: true },
];

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(TIMES)
    : undefined;

const rotaDeContas: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/auth/users")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse([fixtureAdminUser])
    : undefined;

const rotaDoQuadro: FetchRoute = (href, init) =>
  href.endsWith(apiPath(`/teams/${fixtureTeamId}/memberships`)) && (init?.method ?? "GET") === "GET"
    ? jsonResponse([])
    : undefined;

interface TelaDoDono {
  readonly tela: string;
  readonly rotulo: string;
  readonly Pagina: () => ReactNode;
  readonly user: SessionUser;
  readonly routes: FetchRoute[];
}

const TELAS: TelaDoDono[] = [
  {
    tela: "Trilhas de Aprendizagem",
    rotulo: "Cadastrar Trilha",
    Pagina: LearningRoute.options.component as () => ReactNode,
    user: fixtureAssignedManagerUser,
    routes: [],
  },
  {
    tela: "Ciclos de Avaliação",
    rotulo: "Cadastrar Ciclo",
    Pagina: CyclesRoute.options.component as () => ReactNode,
    user: fixtureAdminUser,
    routes: [],
  },
  {
    tela: "Catálogo de Competências",
    rotulo: "Cadastrar Capacidade",
    Pagina: MatrixRoute.options.component as () => ReactNode,
    user: fixtureAdminUser,
    routes: [careerLevelsRoute],
  },
  {
    tela: "Estrutura de Times",
    rotulo: "Cadastrar Time",
    Pagina: TeamsRoute.options.component as () => ReactNode,
    user: fixtureAdminUser,
    routes: [rotaDeTimes, rotaDeContas, rotaDoQuadro],
  },
  {
    tela: "Contas e Acessos",
    rotulo: "Cadastrar Profissional",
    Pagina: UsersRoute.options.component as () => ReactNode,
    user: fixtureAdminUser,
    routes: [rotaDeContas, rotaDeTimes, careerLevelsRoute],
  },
];

async function acaoPrincipalDe({ rotulo, Pagina, user, routes }: TelaDoDono): Promise<HTMLElement> {
  mockAppFetch(fetchMock, { user, state: fixtureState, routes });
  renderWithApp(<Pagina />);
  return await screen.findByRole("button", { name: rotulo });
}

describe("as cinco telas do dono mostram a ação principal pelo mesmo componente", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  for (const tela of TELAS) {
    it(`${tela.tela} — "${tela.rotulo}" é a ação principal do cabeçalho`, async () => {
      const acao = await acaoPrincipalDe(tela);
      expect(acao.getAttribute("data-page-action")).toBe("main");
      expect(acao.className).toContain("bg-primary");
      expect(acao.className).toContain("h-(--control-h)");
      expect(acao.querySelector("svg")).not.toBeNull();
      expect(acao.textContent).toBe(tela.rotulo);
    });
  }

  it("as cinco vestem exatamente a mesma classe — nenhuma tela tem régua própria", async () => {
    const classes: string[] = [];
    for (const tela of TELAS) {
      classes.push((await acaoPrincipalDe(tela)).className);
      cleanup();
      fetchMock.mockReset();
    }
    expect(new Set(classes).size).toBe(1);
  });
});
