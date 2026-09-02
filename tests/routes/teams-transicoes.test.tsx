import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { teamTransitionsApi, type SessionUser } from "@/lib/api";
import {
  InMemoryTeamTransitionsGateway,
  type TeamTransitionsRow,
} from "@/lib/gateways/team-transitions.gateway";
import { Route as TeamsRoute } from "@/routes/teams";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureState,
  fixtureTeamId,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Rumo ao 100% — pedido literal do dono: "eu quero poder comparar transição
 * entre times". A seção "Transições por time" vive em /teams, recolhível no
 * idioma da onda 32, com período (padrão: últimos 12 meses) e uma tabela por
 * time — transições, pares de nível, tempo médio no nível de origem, pessoas
 * ativas e a taxa — ORDENADA POR TRANSIÇÕES, não pela ordem alfabética em que
 * o serviço entrega.
 *
 * Duas direções da origem do dado (DECISOES.md): com o gateway in-memory
 * registrado a tela declara; com o container de produção a declaração some.
 * E "sem time registrado" é valor legítimo do serviço: aparece, inclusive
 * quando é zero.
 */
const fetchMock = vi.fn();

const TeamsPage = TeamsRoute.options.component as () => ReactNode;

const times = [
  { id: fixtureTeamId, name: "Time Plataforma", active: true },
  { id: "time-dados", name: "Time Dados", active: true },
];

const CAMINHO = apiPath("/analytics/team-transitions");
const DECLARACAO = /dados de demonstração/i;
const NEGATIVA =
  "Cadastrar times e compor o quadro é restrito ao administrador e ao gestor designado de cada time.";

const plataforma: TeamTransitionsRow = {
  teamId: fixtureTeamId,
  teamName: "Time Plataforma",
  activeArchitects: 4,
  transitions: 2,
  transitionsPerActiveArchitect: 0.5,
  measuredOrigins: 1,
  averageDaysInOriginLevel: 120,
  pairs: [{ fromRole: "Júnior", toRole: "Pleno", transitions: 2, averageDaysInOriginLevel: 120 }],
};
const dados: TeamTransitionsRow = {
  teamId: "time-dados",
  teamName: "Time Dados",
  activeArchitects: 0,
  transitions: 3,
  transitionsPerActiveArchitect: null,
  measuredOrigins: 0,
  averageDaysInOriginLevel: null,
  pairs: [
    { fromRole: "Júnior", toRole: "Pleno", transitions: 1, averageDaysInOriginLevel: null },
    { fromRole: "Pleno", toRole: "Sênior", transitions: 2, averageDaysInOriginLevel: null },
  ],
};
const legado: TeamTransitionsRow = {
  teamId: "time-legado",
  teamName: "Time Legado",
  activeArchitects: 2,
  transitions: 0,
  transitionsPerActiveArchitect: 0,
  measuredOrigins: 0,
  averageDaysInOriginLevel: null,
  pairs: [],
};

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(times)
    : undefined;

const rotaDeContas: FetchRoute = (href) =>
  href.endsWith(apiPath("/auth/users")) ? jsonResponse([]) : undefined;

const rotaDaComparacao =
  (resposta: () => unknown): FetchRoute =>
  (href, init) =>
    href.endsWith(CAMINHO) && init?.method === "POST" ? jsonResponse(resposta()) : undefined;

const chamadas = (metodo: string, trecho: string) =>
  fetchMock.mock.calls.filter(
    ([entrada, init]) =>
      String(entrada instanceof Request ? entrada.url : entrada).includes(trecho) &&
      ((init as RequestInit | undefined)?.method ?? "GET") === metodo,
  );

const corpoDa = (chamada: unknown[]): unknown =>
  JSON.parse(String((chamada[1] as RequestInit).body));

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

const tabela = () => screen.findByRole("table", { name: "Transições por time" });

const linhasDaTabela = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((linha) =>
      within(linha)
        .getAllByRole("cell")
        .map((celula) => celula.textContent?.trim() ?? ""),
    );

const registraGatewayEmMemoria = (gateway: InMemoryTeamTransitionsGateway) => {
  vi.spyOn(teamTransitionsApi, "compareTeamTransitions").mockImplementation(
    gateway.compareTeamTransitions,
  );
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 2, 12));
  try {
    window.localStorage.removeItem("synapse:section-open:teams.transitions");
  } catch {
    return;
  }
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("/teams — Transições por time, lido pelo gateway em memória (o oráculo do contrato)", () => {
  it("uma linha por time, ordenada por transições: pares de nível, tempo médio na origem, pessoas ativas e taxa", async () => {
    registraGatewayEmMemoria(new InMemoryTeamTransitionsGateway([plataforma, legado, dados], 3));
    renderAs(fixtureAdminUser);

    const linhas = linhasDaTabela(await tabela());
    expect(linhas.map((celulas) => celulas[0])).toEqual([
      "Time Dados",
      "Time Plataforma",
      "Time Legado",
    ]);
    const [primeira, segunda, terceira] = linhas as [string[], string[], string[]];
    expect(primeira.slice(1)).toEqual(["3", "Júnior → Pleno · 1Pleno → Sênior · 2", "—", "0", "—"]);
    expect(segunda[1]).toBe("2");
    expect(segunda[2]).toBe("Júnior → Pleno · 2");
    expect(segunda[3]).toContain("120 dias");
    expect(segunda[3]).toContain("medido em 1 de 2");
    expect(segunda[4]).toBe("4");
    expect(segunda[5]).toBe("0,5");
    expect(terceira.slice(1)).toEqual(["0", "—", "—", "2", "0"]);
    expect(screen.getByText(DECLARACAO)).toBeTruthy();
  });

  it("'sem time registrado' é valor do serviço: aparece, inclusive quando é zero", async () => {
    registraGatewayEmMemoria(new InMemoryTeamTransitionsGateway([plataforma], 0));
    renderAs(fixtureAdminUser);
    await tabela();
    expect(screen.getByText("Transições sem time registrado no período: 0")).toBeTruthy();
  });

  it("quando o serviço não informa 'sem time registrado' (quem não é admin), a linha não existe", async () => {
    registraGatewayEmMemoria(new InMemoryTeamTransitionsGateway([plataforma], null));
    renderAs(fixtureAssignedManagerUser);
    await tabela();
    expect(screen.queryByText(/sem time registrado/i)).toBeNull();
  });

  it("nenhum time no alcance e no período é 'nenhum', não erro", async () => {
    registraGatewayEmMemoria(new InMemoryTeamTransitionsGateway([], null));
    renderAs(fixtureAssignedManagerUser);
    expect(
      await screen.findByText("Nenhum time com transição ou pessoa ativa neste período."),
    ).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Transições por time" })).toBeNull();
  });
});

describe("/teams — Transições por time pelo container de produção", () => {
  it("o período padrão são os últimos 12 meses, e a declaração de demonstração some sozinha", async () => {
    renderAs(fixtureAdminUser, [
      rotaDaComparacao(() => ({
        period: { from: "2025-09-02", to: "2026-09-02" },
        teams: [plataforma],
        withoutRecordedTeam: 1,
      })),
    ]);
    await tabela();

    const pedidos = chamadas("POST", CAMINHO);
    expect(pedidos).toHaveLength(1);
    expect(corpoDa(pedidos[0] as unknown[])).toEqual({
      period: { from: "2025-09-02", to: "2026-09-02" },
    });
    expect(screen.queryByText(DECLARACAO)).toBeNull();
    expect(screen.getByText("Transições sem time registrado no período: 1")).toBeTruthy();
  });

  it("mudar o período pede a comparação de novo, com as datas escolhidas", async () => {
    renderAs(fixtureAdminUser, [
      rotaDaComparacao(() => ({
        period: { from: "2025-09-02", to: "2026-09-02" },
        teams: [plataforma],
        withoutRecordedTeam: null,
      })),
    ]);
    await tabela();

    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-01-01" } });
    await waitFor(() => expect(chamadas("POST", CAMINHO)).toHaveLength(2));
    expect(corpoDa(chamadas("POST", CAMINHO)[1] as unknown[])).toEqual({
      period: { from: "2026-01-01", to: "2026-09-02" },
    });
  });

  it("início depois do fim não vai ao serviço: a tela diz o que está errado", async () => {
    renderAs(fixtureAdminUser, [
      rotaDaComparacao(() => ({
        period: { from: "2025-09-02", to: "2026-09-02" },
        teams: [plataforma],
        withoutRecordedTeam: null,
      })),
    ]);
    await tabela();

    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2025-01-01" } });
    expect(await screen.findByText("O início do período precisa vir antes do fim.")).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Transições por time" })).toBeNull();
    expect(chamadas("POST", CAMINHO)).toHaveLength(1);
  });

  it("o 403 do serviço nomeia a negativa — a tela mostra a mensagem dele, não inventa outra", async () => {
    const negativa: FetchRoute = (href, init) =>
      href.endsWith(CAMINHO) && init?.method === "POST"
        ? jsonResponse(
            {
              code: "TEAM_TRANSITIONS_NOT_VISIBLE",
              message: "Você não alcança um dos times pedidos.",
            },
            403,
          )
        : undefined;
    renderAs(fixtureAdminUser, [negativa]);
    expect(await screen.findByText("Você não alcança um dos times pedidos.")).toBeTruthy();
  });
});

describe("/teams — quem compara", () => {
  it("tech lead COM vínculo compara os times que lidera, mesmo sem compor o quadro", async () => {
    registraGatewayEmMemoria(new InMemoryTeamTransitionsGateway([plataforma], null));
    renderAs(fixtureAssignedTechLeadUser);
    expect(await screen.findByText(NEGATIVA)).toBeTruthy();
    expect(linhasDaTabela(await tabela()).map((celulas) => celulas[0])).toEqual([
      "Time Plataforma",
    ]);
  });

  it("member não vê a comparação, e nenhum pedido sai do navegador", async () => {
    renderAs(fixtureMemberUser);
    expect(await screen.findByText(NEGATIVA)).toBeTruthy();
    expect(screen.queryByText("Transições por time")).toBeNull();
    expect(chamadas("POST", CAMINHO)).toHaveLength(0);
  });
});

describe("/teams — mostrar e esconder", () => {
  it("'Transições por time' se esconde e se mostra por botão próprio", async () => {
    registraGatewayEmMemoria(new InMemoryTeamTransitionsGateway([plataforma], null));
    renderAs(fixtureAdminUser);
    await tabela();

    await userEvent.click(screen.getByRole("button", { name: "Esconder Transições por time" }));
    expect(screen.queryByRole("table", { name: "Transições por time" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Mostrar Transições por time" }));
    expect(await tabela()).toBeTruthy();
  });
});
