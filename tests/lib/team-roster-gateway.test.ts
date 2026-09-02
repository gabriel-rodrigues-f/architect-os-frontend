import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient, API_URL } from "@/lib/api-client";
import { ApiError } from "@/lib/api-errors";
import { apiPath } from "@/lib/api-path";
import { teamRosterResponseSchema } from "@/lib/api-schemas";
import {
  HttpTeamRosterGateway,
  InMemoryTeamRosterGateway,
  type TeamRosterMember,
} from "@/lib/gateways/team-roster.gateway";

/**
 * Onda 32 — o Quadro de {time} em linhas. Contrato entre as duas fatias
 * (backend e tela em paralelo, integração do backend PRIMEIRO):
 *
 *   GET /api/v1/teams/:teamId/memberships → { data: [ { userId, name, email, role } ] }
 *   ordenado por papel (manager, tech_lead, member) e depois nome.
 *   403 nomeia o recurso ("o quadro deste time"); time inexistente: 404.
 *
 * Enquanto a rota não está no ar, o 404 é "leitura do quadro indisponível" —
 * DITA pelo gateway, nunca linhas inventadas nem a lista de pessoas ativas
 * fingindo ser o quadro. O in-memory é o oráculo do contrato: ordena como o
 * servidor promete e sabe declarar indisponibilidade.
 */
const fetchMock = vi.fn();

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

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

const gateway = (interceptar: (error: ApiError) => void = () => {}) =>
  new HttpTeamRosterGateway(new ApiClient(API_URL, interceptar));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("HttpTeamRosterGateway — a leitura do quadro", () => {
  it("lê GET /teams/:teamId/memberships e devolve as linhas na ordem em que o serviço as mandou", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [gestor, carla, ana, bruno] }));
    const roster = await gateway().rosterOf("time-plataforma");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(new URL(url).pathname).toBe(apiPath("/teams/time-plataforma/memberships"));
    expect(init?.method ?? "GET").toBe("GET");
    expect(roster.reading).toBe("available");
    if (roster.reading !== "available") throw new Error("leitura deveria estar disponível");
    expect(roster.members.map((member) => member.userId)).toEqual([
      "conta-gestor",
      "conta-carla",
      "conta-ana",
      "conta-bruno",
    ]);
    expect(roster.teamId).toBe("time-plataforma");
    expect(roster.dataOrigin).toBe("organization");
  });

  it("404 é 'leitura do quadro indisponível' — dita, sem linha nenhuma", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: "Route GET:/api/v1/teams/x/memberships not found" }, 404),
    );
    const roster = await gateway().rosterOf("time-plataforma");
    expect(roster.reading).toBe("unavailable");
    expect("members" in roster).toBe(false);
    expect(roster.dataOrigin).toBe("organization");
  });

  it("403 NÃO vira indisponibilidade: a negativa sobe com a mensagem do serviço", async () => {
    const interceptadas: ApiError[] = [];
    fetchMock.mockResolvedValue(
      jsonResponse({ code: "FORBIDDEN", message: "Você não alcança o quadro deste time." }, 403),
    );
    const failure = await gateway((error) => interceptadas.push(error))
      .rosterOf("time-plataforma")
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(403);
    expect((failure as ApiError).message).toBe("Você não alcança o quadro deste time.");
    expect(interceptadas.map((error) => error.status)).toEqual([403]);
  });

  it("payload fora do contrato é recusado — a tela não desenha linha desconhecida", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ userId: "x", role: "chefe" }] }));
    await expect(gateway().rosterOf("time-plataforma")).rejects.toThrow();
  });

  it("rede fora do ar não vira quadro vazio nem indisponível — a leitura rejeita", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(gateway().rosterOf("time-plataforma")).rejects.toThrow(ApiError);
  });
});

describe("InMemoryTeamRosterGateway — o oráculo do contrato", () => {
  it("ordena por papel (gestor, tech lead, membro) e depois por nome, seja qual for a ordem de entrada", async () => {
    const roster = await new InMemoryTeamRosterGateway(
      new Map([["time-plataforma", [bruno, carla, ana, gestor]]]),
    ).rosterOf("time-plataforma");
    expect(roster.reading).toBe("available");
    if (roster.reading !== "available") throw new Error("leitura deveria estar disponível");
    expect(roster.members.map((member) => member.name)).toEqual([
      "Gestor do time",
      "Carla Souza",
      "Ana Martins",
      "Bruno Almeida",
    ]);
  });

  it("responde no contrato zod declarado em api-schemas", async () => {
    const roster = await new InMemoryTeamRosterGateway(
      new Map([["time-plataforma", [carla, ana]]]),
    ).rosterOf("time-plataforma");
    if (roster.reading !== "available") throw new Error("leitura deveria estar disponível");
    expect(() => teamRosterResponseSchema.parse(roster.members)).not.toThrow();
  });

  it("time sem linha registrada é quadro vazio, não indisponível", async () => {
    const roster = await new InMemoryTeamRosterGateway(new Map()).rosterOf("time-dados");
    expect(roster.reading).toBe("available");
    if (roster.reading !== "available") throw new Error("leitura deveria estar disponível");
    expect(roster.members).toEqual([]);
  });

  it("sabe DIZER que a leitura está indisponível", async () => {
    const roster = await InMemoryTeamRosterGateway.unavailable().rosterOf("time-plataforma");
    expect(roster.reading).toBe("unavailable");
  });

  it("carimba a origem como demonstração — a tela tem de declarar", async () => {
    const gateway = new InMemoryTeamRosterGateway(new Map());
    expect(gateway.dataOrigin).toBe("demonstration");
    expect((await gateway.rosterOf("time-plataforma")).dataOrigin).toBe("demonstration");
  });
});
