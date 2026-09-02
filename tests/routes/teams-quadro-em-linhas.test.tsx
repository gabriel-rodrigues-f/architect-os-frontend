import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `<Link>` do TanStack Router precisa de um `RouterProvider` real; desde a
 * onda 35 o Quadro sem ninguém para vincular aponta o cadastro por `<Link>`.
 * Troca por âncora comum — não é o que se testa aqui.
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
import { teamRosterApi, type SessionUser } from "@/lib/api";
import {
  InMemoryTeamRosterGateway,
  type TeamRosterMember,
} from "@/lib/gateways/team-roster.gateway";
import { Route as TeamsRoute } from "@/routes/teams";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureState,
  fixtureTeamId,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Onda 32 — pedido literal do dono olhando /teams: "em Times > Quadro de
 * Arquitetura, eu quero um botão para mostrar / esconder; o mesmo vale para
 * times cadastrados / também quero um botão para visualizar os times
 * cadastrados como linhas / melhore apenas o times > quadro de {time}".
 *
 * O quadro em linhas lê `GET /teams/:teamId/memberships` (contrato entre as
 * duas fatias) por um gateway próprio. As duas direções da origem do dado
 * (DECISOES.md): com o gateway in-memory registrado a tela declara; com o
 * container de produção a declaração some sozinha. E a INDISPONIBILIDADE é
 * dita — o 404 da rota que ainda não existe nunca vira linha inventada, nem
 * a lista de pessoas ativas fingindo ser o quadro.
 */
const fetchMock = vi.fn();

const TeamsPage = TeamsRoute.options.component as () => ReactNode;

const times = [
  { id: fixtureTeamId, name: "Time Plataforma", active: true },
  { id: "time-dados", name: "Time Dados", active: true },
];

const contas: SessionUser[] = [
  { ...fixtureAdminUser, id: "conta-diego", name: "Diego Ramos", role: "member" },
];

const gestor: TeamRosterMember = {
  userId: "conta-gestor",
  name: "Gestor do time",
  email: "gestor-do-time@company.com",
  role: "manager",
};
const carla: TeamRosterMember = {
  userId: "conta-carla",
  name: "Carla Souza",
  email: "carla@company.com",
  role: "tech_lead",
};
const ana: TeamRosterMember = {
  userId: "conta-ana",
  name: "Ana Martins",
  email: "ana@company.com",
  role: "member",
};
const bruno: TeamRosterMember = {
  userId: "conta-bruno",
  name: "Bruno Almeida",
  email: "bruno@company.com",
  role: "member",
};

const CAMINHO_DO_QUADRO = apiPath(`/teams/${fixtureTeamId}/memberships`);
const INDISPONIVEL = /leitura do quadro deste time ainda não está disponível/i;
const DECLARACAO = /dados de demonstração/i;

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(times)
    : undefined;

const rotaDeContas: FetchRoute = (href) =>
  href.endsWith(apiPath("/auth/users")) ? jsonResponse(contas) : undefined;

const rotaDoQuadro =
  (linhas: () => TeamRosterMember[]): FetchRoute =>
  (href, init) =>
    href.endsWith(CAMINHO_DO_QUADRO) && (init?.method ?? "GET") === "GET"
      ? jsonResponse(linhas())
      : undefined;

const rotaDoQuadroAusente: FetchRoute = (href, init) =>
  href.endsWith(CAMINHO_DO_QUADRO) && (init?.method ?? "GET") === "GET"
    ? jsonResponse({ message: `Route GET:${CAMINHO_DO_QUADRO} not found`, error: "Not Found" }, 404)
    : undefined;

const chamadas = (metodo: string, trecho: string) =>
  fetchMock.mock.calls.filter(
    ([entrada, init]) =>
      String(entrada instanceof Request ? entrada.url : entrada).includes(trecho) &&
      ((init as RequestInit | undefined)?.method ?? "GET") === metodo,
  );

function renderAs(user: SessionUser, routes: FetchRoute[] = []) {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user,
    state: scopedFixtureStateFor(user, fixtureState, [fixtureTeamId]),
    routes: [...routes, rotaDeTimes, rotaDeContas],
  });
  return renderWithApp(<TeamsPage />);
}

async function abrirOQuadro() {
  await screen.findByText("Time Plataforma");
  await userEvent.click(screen.getByLabelText("Quadro de Time Plataforma"));
}

const tabelaDoQuadro = () => screen.findByRole("table", { name: "Vínculos do time" });

const linhasDaTabela = (tabela: HTMLElement) =>
  within(tabela)
    .getAllByRole("row")
    .slice(1)
    .map((linha) =>
      within(linha)
        .getAllByRole("cell")
        .map((celula) => celula.textContent?.trim() ?? ""),
    );

const registraGatewayEmMemoria = (gateway: InMemoryTeamRosterGateway) => {
  vi.spyOn(teamRosterApi, "rosterOf").mockImplementation(gateway.rosterOf);
};

beforeEach(() => {
  try {
    window.localStorage.removeItem("synapse:section-open:teams.registry");
    window.localStorage.removeItem("synapse:section-open:teams.roster");
  } catch {
    return;
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("/teams — o quadro em linhas, lido pelo gateway em memória (o oráculo do contrato)", () => {
  it("uma linha por vínculo: pessoa · e-mail · papel, na ordem do contrato", async () => {
    registraGatewayEmMemoria(
      new InMemoryTeamRosterGateway(new Map([[fixtureTeamId, [bruno, ana, carla, gestor]]])),
    );
    renderAs(fixtureAdminUser);
    await abrirOQuadro();

    const linhas = linhasDaTabela(await tabelaDoQuadro());
    expect(linhas.map((celulas) => celulas.slice(0, 3))).toEqual([
      ["Gestor do time", "gestor-do-time@company.com", "Gestor"],
      ["Carla Souza", "carla@company.com", "Tech Lead"],
      ["Ana Martins", "ana@company.com", "Membro"],
      ["Bruno Almeida", "bruno@company.com", "Membro"],
    ]);
    expect(screen.getByText(DECLARACAO)).toBeTruthy();
  });

  it("indisponibilidade dita: a tela declara e não desenha linha nenhuma", async () => {
    registraGatewayEmMemoria(InMemoryTeamRosterGateway.unavailable());
    renderAs(fixtureAdminUser);
    await abrirOQuadro();

    expect(await screen.findByText(INDISPONIVEL)).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Vínculos do time" })).toBeNull();
    expect(screen.queryByText("Vínculos confirmados nesta sessão")).toBeNull();
  });

  it("quadro vazio é 'nenhum vínculo', não indisponibilidade", async () => {
    registraGatewayEmMemoria(new InMemoryTeamRosterGateway(new Map()));
    renderAs(fixtureAdminUser);
    await abrirOQuadro();

    expect(await screen.findByText("Nenhum vínculo registrado neste time.")).toBeTruthy();
    expect(screen.queryByText(INDISPONIVEL)).toBeNull();
  });
});

describe("/teams — o quadro em linhas pelo container de produção", () => {
  it("com a rota no ar, as linhas vêm do serviço e a declaração de demonstração some sozinha", async () => {
    renderAs(fixtureAdminUser, [rotaDoQuadro(() => [gestor, carla, ana])]);
    await abrirOQuadro();

    const linhas = linhasDaTabela(await tabelaDoQuadro());
    expect(linhas.map((celulas) => celulas[0])).toEqual([
      "Gestor do time",
      "Carla Souza",
      "Ana Martins",
    ]);
    expect(screen.queryByText(DECLARACAO)).toBeNull();
    expect(chamadas("GET", CAMINHO_DO_QUADRO)).toHaveLength(1);
  });

  it("enquanto o backend não existe (404 da rota), a tela diz que a leitura está indisponível — e não usa a lista de pessoas ativas como quadro", async () => {
    renderAs(fixtureAdminUser, [rotaDoQuadroAusente]);
    await abrirOQuadro();

    expect(await screen.findByText(INDISPONIVEL)).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Vínculos do time" })).toBeNull();
    expect(screen.queryByText(DECLARACAO)).toBeNull();
    const pessoas = screen.getByText("Pessoas do time").closest("section") as HTMLElement;
    expect(within(pessoas).getByText("Ana Martins")).toBeTruthy();
  });

  it("o 403 do serviço nomeia o recurso — a tela mostra a mensagem dele, não inventa outra", async () => {
    const negativa: FetchRoute = (href, init) =>
      href.endsWith(CAMINHO_DO_QUADRO) && (init?.method ?? "GET") === "GET"
        ? jsonResponse({ code: "FORBIDDEN", message: "Você não alcança o quadro deste time." }, 403)
        : undefined;
    renderAs(fixtureAdminUser, [negativa]);
    await abrirOQuadro();

    expect(await screen.findByText("Você não alcança o quadro deste time.")).toBeTruthy();
    expect(screen.queryByText(INDISPONIVEL)).toBeNull();
  });
});

describe("/teams — as ações de cada linha", () => {
  it("desvincular pede confirmação, chama a operação de negócio e a linha some na releitura", async () => {
    let desvinculou = false;
    const desvinculo: FetchRoute = (href, init) => {
      if (
        href.endsWith(`${CAMINHO_DO_QUADRO}/conta-carla/tech_lead`) &&
        init?.method === "DELETE"
      ) {
        desvinculou = true;
        return new Response(null, { status: 204 });
      }
      return undefined;
    };
    renderAs(fixtureAdminUser, [
      desvinculo,
      rotaDoQuadro(() => (desvinculou ? [gestor, ana] : [gestor, carla, ana])),
    ]);
    await abrirOQuadro();
    await tabelaDoQuadro();

    await userEvent.click(screen.getByLabelText("Desvincular Carla Souza"));
    await userEvent.click(screen.getByRole("button", { name: "Desvincular" }));

    expect(chamadas("DELETE", `${CAMINHO_DO_QUADRO}/conta-carla/tech_lead`)).toHaveLength(1);
    await waitFor(() =>
      expect(
        linhasDaTabela(screen.getByRole("table", { name: "Vínculos do time" })).map(
          (celulas) => celulas[0],
        ),
      ).toEqual(["Gestor do time", "Ana Martins"]),
    );
  });

  it("trocar papel abre o diálogo com os papéis possíveis e leva o vínculo ao papel novo", async () => {
    let trocou = false;
    const troca: FetchRoute = (href, init) => {
      if (href.endsWith(`${CAMINHO_DO_QUADRO}/conta-carla/tech_lead`) && init?.method === "PATCH") {
        trocou = true;
        return jsonResponse({ teamId: fixtureTeamId, userId: "conta-carla", role: "member" });
      }
      return undefined;
    };
    renderAs(fixtureAdminUser, [
      troca,
      rotaDoQuadro(() =>
        trocou ? [gestor, ana, { ...carla, role: "member" }] : [gestor, carla, ana],
      ),
    ]);
    await abrirOQuadro();
    await tabelaDoQuadro();

    await userEvent.click(screen.getByLabelText("Trocar papel de Carla Souza"));
    await userEvent.click(await screen.findByLabelText("Novo papel"));
    await userEvent.click(screen.getByRole("option", { name: "Membro" }));
    await userEvent.click(screen.getByRole("button", { name: "Trocar papel" }));

    const [, init] = chamadas("PATCH", `${CAMINHO_DO_QUADRO}/conta-carla/tech_lead`)[0] as [
      unknown,
      RequestInit,
    ];
    expect(JSON.parse(String(init.body))).toEqual({ role: "member" });
    await waitFor(() => {
      const linhas = linhasDaTabela(screen.getByRole("table", { name: "Vínculos do time" }));
      expect(linhas.find((celulas) => celulas[0] === "Carla Souza")?.[2]).toBe("Membro");
    });
  });

  it("gestor designado age sobre tech lead e pessoas, mas não sobre o vínculo de gestor — nomear gestor é do administrador", async () => {
    renderAs(fixtureAssignedManagerUser, [rotaDoQuadro(() => [gestor, carla, ana])]);
    await abrirOQuadro();
    await tabelaDoQuadro();

    expect(screen.queryByLabelText("Desvincular Gestor do time")).toBeNull();
    expect(screen.queryByLabelText("Trocar papel de Gestor do time")).toBeNull();
    expect(screen.getByLabelText("Desvincular Carla Souza")).toBeTruthy();
    expect(screen.getByLabelText("Trocar papel de Ana Martins")).toBeTruthy();
  });

  it("o formulário de vincular não repete trocar papel nem desvincular — isso mora na linha", async () => {
    renderAs(fixtureAdminUser, [rotaDoQuadro(() => [gestor, carla, ana])]);
    await abrirOQuadro();
    await tabelaDoQuadro();

    expect(screen.getByRole("button", { name: "Vincular" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Trocar papel" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desvincular" })).toBeNull();
  });
});

describe("/teams — mostrar e esconder", () => {
  it("'Times cadastrados' e o 'Quadro de {time}' se escondem e se mostram por botão próprio", async () => {
    renderAs(fixtureAdminUser, [rotaDoQuadro(() => [gestor, carla, ana])]);
    await abrirOQuadro();
    await tabelaDoQuadro();

    await userEvent.click(screen.getByRole("button", { name: "Esconder Times cadastrados" }));
    expect(screen.queryByText("Time Dados")).toBeNull();
    expect(screen.getByRole("table", { name: "Vínculos do time" })).toBeTruthy();

    await userEvent.click(
      screen.getByRole("button", { name: "Esconder Quadro de Time Plataforma" }),
    );
    expect(screen.queryByRole("table", { name: "Vínculos do time" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Mostrar Times cadastrados" }));
    expect(screen.getByText("Time Dados")).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Mostrar Quadro de Time Plataforma" }),
    );
    expect(await tabelaDoQuadro()).toBeTruthy();
  });

  it("o estado é lembrado por quem vê: reabrir a tela encontra a lista como foi deixada", async () => {
    const primeira = renderAs(fixtureAdminUser, [rotaDoQuadro(() => [])]);
    await screen.findByText("Time Plataforma");
    await userEvent.click(screen.getByRole("button", { name: "Esconder Times cadastrados" }));
    primeira.unmount();

    renderAs(fixtureAdminUser, [rotaDoQuadro(() => [])]);
    expect(await screen.findByRole("button", { name: "Mostrar Times cadastrados" })).toBeTruthy();
    expect(screen.queryByText("Time Dados")).toBeNull();
  });
});
