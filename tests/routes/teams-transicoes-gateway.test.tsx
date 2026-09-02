import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient, API_URL } from "@/lib/api-client";
import { ApiError } from "@/lib/api-errors";
import { apiPath } from "@/lib/api-path";
import { teamTransitionsResponseSchema } from "@/lib/api-schemas";
import {
  HttpTeamTransitionsGateway,
  InMemoryTeamTransitionsGateway,
  type TeamTransitionsRow,
} from "@/lib/gateways/team-transitions.gateway";
import { TeamTransitionsPeriod, TeamTransitionsViewModel } from "@/lib/view-models";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";

/**
 * Rumo ao 100% — "eu quero poder comparar transição entre times" (dono).
 *
 * O backend está no ar e provado:
 *   POST /api/v1/analytics/team-transitions
 *     { period: { from, to }, teamIds? }
 *   → { data: { period, teams: [ { teamId, teamName, activeArchitects,
 *       transitions, transitionsPerActiveArchitect, measuredOrigins,
 *       averageDaysInOriginLevel, pairs: [ { fromRole, toRole, transitions,
 *       averageDaysInOriginLevel } ] } ], withoutRecordedTeam } }
 *
 * O serviço devolve os times em ordem ALFABÉTICA e escopa sozinho (admin vê
 * todos; gestor e tech lead veem os times que lideram). `withoutRecordedTeam`
 * só vem para o admin (`null` para os demais) — e ZERO é valor legítimo.
 * O in-memory é o oráculo do contrato: mesma ordem, mesmo escopo por
 * `teamIds`, mesmo carimbo de demonstração.
 */
const fetchMock = vi.fn();

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const periodo = { from: "2025-09-02", to: "2026-09-02" };

const plataforma: TeamTransitionsRow = {
  teamId: "time-plataforma",
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
  pairs: [{ fromRole: "Pleno", toRole: "Sênior", transitions: 3, averageDaysInOriginLevel: null }],
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

const gateway = (interceptar: (error: ApiError) => void = () => {}) =>
  new HttpTeamTransitionsGateway(new ApiClient(API_URL, interceptar));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("HttpTeamTransitionsGateway — comparar transição entre times", () => {
  it("envia POST /analytics/team-transitions com o período, e sem teamIds quando não há recorte", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: { period: periodo, teams: [dados, plataforma], withoutRecordedTeam: 3 },
      }),
    );
    const comparison = await gateway().compareTeamTransitions({ period: periodo });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(new URL(url).pathname).toBe(apiPath("/analytics/team-transitions"));
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ period: periodo });
    expect(comparison.teams.map((row) => row.teamId)).toEqual(["time-dados", "time-plataforma"]);
    expect(comparison.withoutRecordedTeam).toBe(3);
    expect(comparison.period).toEqual(periodo);
    expect(comparison.dataOrigin).toBe("organization");
  });

  it("recorte por times vai no corpo quando pedido", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { period: periodo, teams: [plataforma], withoutRecordedTeam: null } }),
    );
    await gateway().compareTeamTransitions({ period: periodo, teamIds: ["time-plataforma"] });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(JSON.parse(String(init?.body))).toEqual({
      period: periodo,
      teamIds: ["time-plataforma"],
    });
  });

  it("'sem time registrado' zero é valor, não ausência — chega como 0, nunca some", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { period: periodo, teams: [], withoutRecordedTeam: 0 } }),
    );
    const comparison = await gateway().compareTeamTransitions({ period: periodo });
    expect(comparison.withoutRecordedTeam).toBe(0);
  });

  it("403 sobe com a mensagem do serviço — a negativa não vira tabela vazia", async () => {
    const interceptadas: ApiError[] = [];
    fetchMock.mockResolvedValue(
      jsonResponse(
        { code: "TEAM_TRANSITIONS_NOT_VISIBLE", message: "Você não alcança um dos times pedidos." },
        403,
      ),
    );
    const failure = await gateway((error) => interceptadas.push(error))
      .compareTeamTransitions({ period: periodo, teamIds: ["time-alheio"] })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(403);
    expect((failure as ApiError).message).toBe("Você não alcança um dos times pedidos.");
    expect(interceptadas.map((error) => error.status)).toEqual([403]);
  });

  it("payload fora do contrato é recusado — a tela não desenha linha desconhecida", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { teams: [{ teamId: "x" }] } }));
    await expect(gateway().compareTeamTransitions({ period: periodo })).rejects.toThrow();
  });
});

describe("InMemoryTeamTransitionsGateway — o oráculo do contrato", () => {
  it("devolve os times em ordem alfabética, como o serviço, seja qual for a ordem de entrada", async () => {
    const comparison = await new InMemoryTeamTransitionsGateway(
      [plataforma, legado, dados],
      3,
    ).compareTeamTransitions({ period: periodo });
    expect(comparison.teams.map((row) => row.teamName)).toEqual([
      "Time Dados",
      "Time Legado",
      "Time Plataforma",
    ]);
    expect(comparison.period).toEqual(periodo);
    expect(comparison.withoutRecordedTeam).toBe(3);
  });

  it("recorta por teamIds quando pedido", async () => {
    const comparison = await new InMemoryTeamTransitionsGateway(
      [plataforma, legado, dados],
      null,
    ).compareTeamTransitions({ period: periodo, teamIds: ["time-legado", "time-dados"] });
    expect(comparison.teams.map((row) => row.teamId)).toEqual(["time-dados", "time-legado"]);
    expect(comparison.withoutRecordedTeam).toBeNull();
  });

  it("responde no contrato zod declarado em api-schemas", async () => {
    const comparison = await new InMemoryTeamTransitionsGateway(
      [plataforma, dados],
      0,
    ).compareTeamTransitions({ period: periodo });
    expect(() => teamTransitionsResponseSchema.parse(comparison)).not.toThrow();
  });

  it("carimba a origem como demonstração — a tela tem de declarar", async () => {
    const gateway = new InMemoryTeamTransitionsGateway([], null);
    expect(gateway.dataOrigin).toBe("demonstration");
    expect((await gateway.compareTeamTransitions({ period: periodo })).dataOrigin).toBe(
      "demonstration",
    );
  });
});

describe("TeamTransitionsPeriod — o período padrão são os últimos 12 meses", () => {
  it("de hoje menos doze meses até hoje, em data local", () => {
    expect(TeamTransitionsPeriod.lastMonths(12, new Date(2026, 8, 2, 15, 30))).toEqual({
      from: "2025-09-02",
      to: "2026-09-02",
    });
  });

  it("atravessa a virada do ano sem cair um dia", () => {
    expect(TeamTransitionsPeriod.lastMonths(12, new Date(2026, 0, 1))).toEqual({
      from: "2025-01-01",
      to: "2026-01-01",
    });
  });

  it("um período só vale com início antes (ou no dia) do fim, nas duas datas preenchidas", () => {
    expect(TeamTransitionsPeriod.isValid({ from: "2026-01-01", to: "2026-01-01" })).toBe(true);
    expect(TeamTransitionsPeriod.isValid({ from: "2026-02-01", to: "2026-01-01" })).toBe(false);
    expect(TeamTransitionsPeriod.isValid({ from: "", to: "2026-01-01" })).toBe(false);
    expect(TeamTransitionsPeriod.isValid({ from: "2026-01-01", to: "" })).toBe(false);
  });
});

describe("TeamTransitionsViewModel — a ordem da tabela é por transições, não a do serviço", () => {
  const comparison = new TeamTransitionsViewModel(defaultUiAuthorizationPolicy);

  it("ordena por transições decrescentes e desempata pelo nome", () => {
    const empate: TeamTransitionsRow = { ...legado, teamId: "time-zeta", teamName: "Time Zeta" };
    expect(
      comparison.ranked([dados, legado, plataforma, empate]).map((row) => row.teamName),
    ).toEqual(["Time Dados", "Time Plataforma", "Time Legado", "Time Zeta"]);
  });

  it("a taxa vem do serviço, na casa decimal do idioma; sem pessoa ativa não há taxa", () => {
    expect(comparison.rateOf(plataforma, "pt")).toBe("0,5");
    expect(comparison.rateOf(plataforma, "en")).toBe("0.5");
    expect(comparison.rateOf(dados, "pt")).toBeNull();
  });

  it("o tempo médio no nível de origem só existe quando alguma origem foi medida", () => {
    expect(comparison.averageDaysOf(plataforma, "pt")).toBe("120");
    expect(comparison.averageDaysOf(dados, "pt")).toBeNull();
  });
});
