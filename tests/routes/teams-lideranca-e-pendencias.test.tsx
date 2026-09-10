import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `<Link>` do TanStack Router precisa de um `RouterProvider` real. Troca por
 * âncora comum — o que se testa aqui é o que a linha DIZ, não a navegação.
 */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params: _params,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { apiPath } from "@/lib/api-path";
import type { SessionUser } from "@/lib/api";
import { Route as TeamsRoute } from "@/routes/teams";
import { fixtureAdminUser, fixtureState, fixtureTeamId } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * O SUBTÍTULO DA TELA PROMETE OS LÍDERES — *"Cada time tem seu gerente, seu
 * tech lead e suas pessoas"* — e a tabela mostrava Nome · Situação ·
 * Profissionais ativos · Ações. Para saber quem lidera era preciso ABRIR o
 * time. Agora a promessa está na linha.
 *
 * E a pendência que mais importa não estava na foto: **régua para os cinco
 * níveis**. Depois da REGRA 19 (dono, 2026-09-09) todo time tem os cinco
 * níveis, e todo time precisa de régua para os cinco — foi a falta da régua
 * do Trainee que derrubou PDI, Avaliação e 1:1 na manhã de 2026-09-09. Nada
 * na tela mostrava o furo.
 */
const fetchMock = vi.fn();

const TeamsPage = TeamsRoute.options.component as () => ReactNode;

const TIME_SEM_LIDERANCA = "time-dados";

const timesCompletoESemLideranca = [
  { id: fixtureTeamId, name: "Time Plataforma", active: true },
  { id: TIME_SEM_LIDERANCA, name: "Time Dados", active: true },
];

const rotaDeTimes = (times: typeof timesCompletoESemLideranca): FetchRoute =>
  ((href, init) =>
    href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
      ? jsonResponse(times)
      : undefined) as FetchRoute;

const emptyAuthUsers: FetchRoute = (href) =>
  href.endsWith(apiPath("/auth/users")) ? jsonResponse([]) : undefined;

/** O quadro de cada time: Plataforma tem os dois líderes, Dados não tem nenhum. */
const rotaDosQuadros: FetchRoute = (href, init) => {
  if ((init?.method ?? "GET") !== "GET") return undefined;
  if (href.endsWith(apiPath(`/teams/${fixtureTeamId}/memberships`))) {
    return jsonResponse([
      {
        userId: "conta-bia",
        name: "Bia Nunes",
        email: "bia@company.com",
        role: "manager",
      },
      {
        userId: "conta-carla",
        name: "Carla Souza",
        email: "carla@company.com",
        role: "tech_lead",
      },
    ]);
  }
  if (href.endsWith(apiPath(`/teams/${TIME_SEM_LIDERANCA}/memberships`))) {
    return jsonResponse([]);
  }
  return undefined;
};

function renderAs(user: SessionUser, routes: FetchRoute[]) {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, { user, state: fixtureState, routes });
  return renderWithApp(<TeamsPage />);
}

const AMBOS_OS_TIMES = [
  careerLevelsRoute,
  rotaDeTimes(timesCompletoESemLideranca),
  emptyAuthUsers,
  rotaDosQuadros,
];

const SO_O_TIME_COMPLETO = [
  careerLevelsRoute,
  rotaDeTimes([timesCompletoESemLideranca[0]!]),
  emptyAuthUsers,
  rotaDosQuadros,
];

/** O nome do time também aparece nas Pendências: a linha se busca DENTRO da tabela. */
const linhaDe = (nome: string): HTMLElement => {
  const tabela = screen.getByRole("table", { name: "Times cadastrados" });
  return within(tabela).getByText(nome).closest("tr") as HTMLElement;
};

/**
 * O vermelho por TIMEOUT do vitest esconde a mensagem. A espera da biblioteca
 * termina ANTES dele, e quem falha é o `findBy*`, com o DOM impresso.
 */
const ESPERA = { timeout: 2000 } as const;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Times cadastrados diz quem lidera cada time", () => {
  it("a linha do time traz o gerente e o tech lead pelo nome", async () => {
    renderAs(fixtureAdminUser, AMBOS_OS_TIMES);
    await screen.findByText("Bia Nunes", {}, ESPERA);

    const linha = linhaDe("Time Plataforma");
    expect(within(linha).getByText("Bia Nunes")).toBeTruthy();
    expect(within(linha).getByText("Carla Souza")).toBeTruthy();
  });

  it("as colunas Gerente e Tech Lead existem no cabeçalho da tabela", async () => {
    renderAs(fixtureAdminUser, AMBOS_OS_TIMES);
    await screen.findByText("Bia Nunes", {}, ESPERA);

    const tabela = screen.getByRole("table", { name: "Times cadastrados" });
    const cabecalhos = within(tabela)
      .getAllByRole("columnheader")
      .map((celula) => celula.textContent);
    expect(cabecalhos).toEqual([
      "Nome",
      "Situação",
      "Gerente",
      "Tech Lead",
      "Profissionais ativos",
      "Ações",
    ]);
  });

  it("time sem gerente e sem tech lead diz a AUSÊNCIA — não fica com a célula muda", async () => {
    renderAs(fixtureAdminUser, AMBOS_OS_TIMES);
    await screen.findByText("Bia Nunes", {}, ESPERA);

    const linha = linhaDe("Time Dados");
    expect(within(linha).getByText("Nenhum gerente")).toBeTruthy();
    expect(within(linha).getByText("Nenhum tech lead")).toBeTruthy();
  });
});

describe("Pendências de configuração", () => {
  it("conta os times sem gerente, sem tech lead e sem profissionais ativos", async () => {
    renderAs(fixtureAdminUser, AMBOS_OS_TIMES);
    await screen.findByText("Bia Nunes", {}, ESPERA);

    for (const rotulo of [
      "Times sem gerente",
      "Times sem tech lead",
      "Times sem profissionais ativos",
    ]) {
      const cartao = await screen.findByRole("region", { name: rotulo }, ESPERA);
      expect(within(cartao).getByText("1")).toBeTruthy();
      expect(within(cartao).getByText("Time Dados")).toBeTruthy();
    }
  });

  it("conta o time sem régua para todos os níveis — a quarta pendência, a da REGRA 19", async () => {
    renderAs(fixtureAdminUser, AMBOS_OS_TIMES);
    await screen.findByText("Bia Nunes", {}, ESPERA);

    const cartao = await screen.findByRole(
      "region",
      { name: "Times sem régua para todos os níveis" },
      ESPERA,
    );
    expect(within(cartao).getByText("1")).toBeTruthy();
    expect(within(cartao).getByText("Time Dados")).toBeTruthy();
  });

  it("sem pendência nenhuma, o bloco diz o ESTADO BOM em duas linhas — não fica vazio", async () => {
    renderAs(fixtureAdminUser, SO_O_TIME_COMPLETO);
    await screen.findByText("Bia Nunes", {}, ESPERA);

    expect(await screen.findByText("Nenhuma pendência de configuração", {}, ESPERA)).toBeTruthy();
    expect(
      screen.getByText(
        "Todo time ao seu alcance tem gerente, tech lead, gente ativa e régua para todos os níveis de carreira.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Times sem gerente" })).toBeNull();
  });
});
