import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import type { SessionUser } from "@/lib/api";
import { Route as TeamsRoute } from "@/routes/teams";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureState,
  fixtureTeamId,
  fixtureUnassignedTechLeadUser,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Onda 31 — cadastro de times, a TELA da segunda porta do time (backend
 * ADR-0068/0069). O bloco que abre este arquivo é o gêmeo de tela que a
 * catraca `alcance-por-rota` exige: a guarda de navegação é cega à sessão no
 * SSR, e quem barra é a própria tela — negativa desenhada, consulta desligada.
 *
 * Quem compõe o quadro é o administrador ou o GESTOR DESIGNADO do time
 * (`isAssignedManagerOfTeam` no backend). O tech lead lidera tecnicamente e
 * não compõe: aqui ele recebe a mesma negativa que o member.
 */
const fetchMock = vi.fn();

const TeamsPage = TeamsRoute.options.component as () => ReactNode;

const times = [
  { id: fixtureTeamId, name: "Time Plataforma", active: true },
  { id: "time-dados", name: "Time Dados", active: true },
  { id: "time-legado", name: "Time Legado", active: false },
];

const contas: SessionUser[] = [
  { ...fixtureMemberUser, id: "conta-ana", name: "Ana Martins" },
  { ...fixtureAssignedTechLeadUser, id: "conta-carla", name: "Carla Souza" },
];

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(times)
    : undefined;

const rotaDeContas: FetchRoute = (href) =>
  href.endsWith(apiPath("/auth/users")) ? jsonResponse(contas) : undefined;

const chamadas = (metodo: string, trecho: string) =>
  fetchMock.mock.calls.filter(
    ([entrada, init]) =>
      String(entrada instanceof Request ? entrada.url : entrada).includes(trecho) &&
      ((init as RequestInit | undefined)?.method ?? "GET") === metodo,
  );

function pediuOsTimes(): boolean {
  return chamadas("GET", apiPath("/teams")).length > 0;
}

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

const NEGATIVA =
  "Cadastrar times e compor o quadro é restrito ao administrador e ao gestor designado de cada time.";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("/teams nega DADO a quem não compõe o quadro — a tela é a última barreira", () => {
  it("member recebe a negativa, e nenhuma consulta de times sai do navegador", async () => {
    renderAs(fixtureMemberUser);
    expect(await screen.findByText(NEGATIVA)).toBeTruthy();
    expect(screen.queryByText("Time Plataforma")).toBeNull();
    expect(pediuOsTimes()).toBe(false);
  });

  it("tech lead sem vínculo também não", async () => {
    renderAs(fixtureUnassignedTechLeadUser);
    expect(await screen.findByText(NEGATIVA)).toBeTruthy();
    expect(pediuOsTimes()).toBe(false);
  });

  it("tech lead COM vínculo não compõe o quadro — a caneta é do gestor", async () => {
    renderAs(fixtureAssignedTechLeadUser);
    expect(await screen.findByText(NEGATIVA)).toBeTruthy();
    expect(pediuOsTimes()).toBe(false);
  });
});

describe("/teams — a lista, com ativos e desativados", () => {
  it("admin vê os times ativos por padrão, e os desativados pelo filtro", async () => {
    renderAs(fixtureAdminUser);
    expect(await screen.findByText("Time Plataforma")).toBeTruthy();
    expect(screen.getByText("Time Dados")).toBeTruthy();
    expect(screen.queryByText("Time Legado")).toBeNull();

    await userEvent.click(screen.getByLabelText("Situação"));
    await userEvent.click(screen.getByRole("option", { name: "Desativados" }));

    expect(await screen.findByText("Time Legado")).toBeTruthy();
    expect(screen.queryByText("Time Plataforma")).toBeNull();
  });

  it("a linha diz quantas pessoas ativas o time tem — o número que a desativação vai cobrar", async () => {
    renderAs(fixtureAdminUser);
    const linha = (await screen.findByText("Time Plataforma")).closest("tr") as HTMLElement;
    expect(within(linha).getByText("2")).toBeTruthy();
  });

  it("gestor com vínculo só vê os times que gere, e não cria time", async () => {
    renderAs(fixtureAssignedManagerUser);
    expect(await screen.findByText("Time Plataforma")).toBeTruthy();
    expect(screen.queryByText("Time Dados")).toBeNull();
    expect(screen.queryByRole("button", { name: "Criar time" })).toBeNull();
  });
});

describe("/teams — criar, renomear, desativar", () => {
  it("criar time envia o nome ao serviço e a lista é recarregada", async () => {
    const criado = { id: "time-novo", name: "Time Novo", active: true };
    let criouAlgo = false;
    const rotaDeCriacao: FetchRoute = (href, init) => {
      if (href.endsWith(apiPath("/teams")) && init?.method === "POST") {
        criouAlgo = true;
        return jsonResponse(criado, 201);
      }
      if (href.endsWith(apiPath("/teams")) && criouAlgo) return jsonResponse([...times, criado]);
      return undefined;
    };
    renderAs(fixtureAdminUser, [rotaDeCriacao]);
    await screen.findByText("Time Plataforma");

    await userEvent.click(screen.getByRole("button", { name: "Criar time" }));
    await userEvent.type(screen.getByLabelText("Nome do time"), "Time Novo");
    await userEvent.click(screen.getByRole("button", { name: "Salvar time" }));

    const [, init] = chamadas("POST", apiPath("/teams"))[0] as [unknown, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ name: "Time Novo" });
    expect(await screen.findByText("Time Novo")).toBeTruthy();
  });

  it("a recusa 409 da desativação aparece na tela com o número de pessoas ativas", async () => {
    const recusa: FetchRoute = (href, init) =>
      href.includes("/deactivate") && init?.method === "POST"
        ? jsonResponse(
            {
              code: "TEAM_STILL_HAS_PEOPLE",
              message: "Este time ainda tem 2 pessoa(s) ativa(s).",
              details: { activeArchitects: 2 },
            },
            409,
          )
        : undefined;
    renderAs(fixtureAdminUser, [recusa]);
    await screen.findByText("Time Plataforma");

    await userEvent.click(screen.getByLabelText("Desativar Time Plataforma"));
    await userEvent.click(screen.getByRole("button", { name: "Desativar time" }));

    expect(
      await screen.findByText("2 pessoas ativas — mova-as antes de desativar Time Plataforma.", {
        exact: false,
      }),
    ).toBeTruthy();
    expect(chamadas("POST", "/deactivate")).toHaveLength(1);
  });

  it("renomear envia só o nome, pela operação de negócio do time", async () => {
    const renomeado: FetchRoute = (href, init) =>
      href.endsWith(apiPath(`/teams/${fixtureTeamId}`)) && init?.method === "PATCH"
        ? jsonResponse({ id: fixtureTeamId, name: "Plataforma Cloud", active: true })
        : undefined;
    renderAs(fixtureAdminUser, [renomeado]);
    await screen.findByText("Time Plataforma");

    await userEvent.click(screen.getByLabelText("Renomear Time Plataforma"));
    const campo = screen.getByLabelText("Nome do time");
    await userEvent.clear(campo);
    await userEvent.type(campo, "Plataforma Cloud");
    await userEvent.click(screen.getByRole("button", { name: "Salvar time" }));

    const [, init] = chamadas("PATCH", apiPath(`/teams/${fixtureTeamId}`))[0] as [
      unknown,
      RequestInit,
    ];
    expect(JSON.parse(String(init.body))).toEqual({ name: "Plataforma Cloud" });
  });
});

describe("/teams — o quadro do time", () => {
  it("mostra as pessoas ativas do time escolhido", async () => {
    renderAs(fixtureAdminUser);
    await screen.findByText("Time Plataforma");

    await userEvent.click(screen.getByLabelText("Quadro de Time Plataforma"));

    const quadro = (await screen.findByText("Pessoas do time")).closest("section") as HTMLElement;
    expect(within(quadro).getByText("Ana Martins")).toBeTruthy();
    expect(within(quadro).getByText("Bruno Almeida")).toBeTruthy();
  });

  it("admin vincula uma conta com papel, e o vínculo confirmado pelo serviço aparece", async () => {
    const vinculo: FetchRoute = (href, init) =>
      href.endsWith(apiPath(`/teams/${fixtureTeamId}/memberships`)) && init?.method === "POST"
        ? jsonResponse({ teamId: fixtureTeamId, userId: "conta-carla", role: "tech_lead" }, 201)
        : undefined;
    renderAs(fixtureAdminUser, [vinculo]);
    await screen.findByText("Time Plataforma");
    await userEvent.click(screen.getByLabelText("Quadro de Time Plataforma"));

    await userEvent.click(await screen.findByLabelText("Pessoa"));
    await userEvent.click(screen.getByRole("option", { name: "Carla Souza" }));
    await userEvent.click(screen.getByLabelText("Papel no time"));
    await userEvent.click(screen.getByRole("option", { name: "Tech Lead" }));
    await userEvent.click(screen.getByRole("button", { name: "Vincular" }));

    const [, init] = chamadas("POST", "/memberships")[0] as [unknown, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ userId: "conta-carla", role: "tech_lead" });
    const confirmados = (await screen.findByText("Vínculos confirmados nesta sessão")).closest(
      "section",
    ) as HTMLElement;
    expect(within(confirmados).getByText("Carla Souza")).toBeTruthy();
    expect(within(confirmados).getByText("Tech Lead")).toBeTruthy();
  });

  it("o 403 do serviço nomeia o que foi negado — a tela mostra a mensagem dele, não inventa outra", async () => {
    const recusa: FetchRoute = (href, init) =>
      href.includes("/memberships") && init?.method === "POST"
        ? jsonResponse(
            {
              code: "MANAGER_MEMBERSHIP_RESERVED_TO_ADMIN",
              message: "Definir quem é o gestor de um time é ato do administrador.",
            },
            403,
          )
        : undefined;
    renderAs(fixtureAdminUser, [recusa]);
    await screen.findByText("Time Plataforma");
    await userEvent.click(screen.getByLabelText("Quadro de Time Plataforma"));

    await userEvent.click(await screen.findByLabelText("Pessoa"));
    await userEvent.click(screen.getByRole("option", { name: "Carla Souza" }));
    await userEvent.click(screen.getByLabelText("Papel no time"));
    await userEvent.click(screen.getByRole("option", { name: "Gestor" }));
    await userEvent.click(screen.getByRole("button", { name: "Vincular" }));

    expect(
      await screen.findByText("Definir quem é o gestor de um time é ato do administrador."),
    ).toBeTruthy();
  });

  it("gestor vê as pessoas do quadro, mas o diretório de contas não sai para ele", async () => {
    renderAs(fixtureAssignedManagerUser);
    await screen.findByText("Time Plataforma");
    await userEvent.click(screen.getByLabelText("Quadro de Time Plataforma"));

    expect(await screen.findByText("Ana Martins")).toBeTruthy();
    expect(screen.queryByLabelText("Pessoa")).toBeNull();
    expect(chamadas("GET", apiPath("/auth/users"))).toHaveLength(0);
  });
});
