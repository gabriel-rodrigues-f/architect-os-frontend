import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "@/lib/api-client";
import { ApiError } from "@/lib/api-errors";
import { SupportAccess, SupportPass } from "@/lib/support-access";

/**
 * PR 6 ([FA-07], RBAC-03) — o passe de suporte deixou de ser estado estático
 * de módulo que ia em TODA requisição e sobrevivia ao logout. Agora é uma
 * instância com validade (15 minutos, espelho de `SupportPass` do backend),
 * e os três cabeçalhos só viajam nas requisições SOBRE A PESSOA do passe.
 */
const NOW = new Date("2026-09-08T10:00:00.000Z");
const MINUTE = 60 * 1000;

function accessAt(now: Date): { access: SupportAccess; clock: { now: Date } } {
  const clock = { now };
  return { access: new SupportAccess(() => clock.now), clock };
}

describe("SupportPass — validade de 15 minutos a partir do motivo declarado", () => {
  it("vale até 15 minutos e vence depois", () => {
    const pass = new SupportPass("ana", "chamado 4821, conferir evidência", NOW);
    expect(pass.expiresAt.getTime()).toBe(NOW.getTime() + 15 * MINUTE);
    expect(pass.isExpiredAt(new Date(NOW.getTime() + 14 * MINUTE))).toBe(false);
    expect(pass.isExpiredAt(new Date(NOW.getTime() + 16 * MINUTE))).toBe(true);
  });

  it("os cabeçalhos levam a pessoa, o motivo e o instante da emissão em ISO", () => {
    const pass = new SupportPass("ana", "chamado 4821, conferir evidência", NOW);
    expect(pass.headers()).toEqual({
      "x-support-architect": "ana",
      "x-support-reason": "chamado 4821, conferir evidência",
      "x-support-issued-at": "2026-09-08T10:00:00.000Z",
    });
  });

  it("é sobre a pessoa quando o id é segmento do caminho ou valor de consulta — não parte de outro id", () => {
    const pass = new SupportPass("ana", "chamado 4821, conferir evidência", NOW);
    expect(pass.isAbout("/architects/ana")).toBe(true);
    expect(pass.isAbout("/architects/ana/career-level-transitions")).toBe(true);
    expect(pass.isAbout("/assessments?architectId=ana")).toBe(true);
    expect(pass.isAbout("/mentoring-sessions?cycleId=2026&menteeId=ana")).toBe(true);
    expect(pass.isAbout("/architects")).toBe(false);
    expect(pass.isAbout("/architects/anabela")).toBe(false);
    expect(pass.isAbout("/teams")).toBe(false);
  });
});

describe("SupportAccess — uma instância, com passe por pessoa", () => {
  it("motivo curto não forma passe", () => {
    const { access } = accessAt(NOW);
    expect(access.grant("ana", "x")).toBeNull();
    expect(access.grantedFor("ana")).toBeNull();
  });

  it("concede, responde pela pessoa do passe e por mais ninguém", () => {
    const { access } = accessAt(NOW);
    const pass = access.grant("ana", "chamado 4821, conferir evidência");
    expect(pass?.architectId).toBe("ana");
    expect(access.grantedFor("ana")).toBe(pass);
    expect(access.grantedFor("bruno")).toBeNull();
  });

  it("os cabeçalhos vão só na requisição sobre a pessoa do passe", () => {
    const { access } = accessAt(NOW);
    access.grant("ana", "chamado 4821, conferir evidência");
    expect(access.headersFor("/architects/ana")).toHaveProperty("x-support-issued-at");
    expect(access.headersFor("/teams")).toEqual({});
    expect(access.headersFor("/auth/users")).toEqual({});
  });

  it("passado o prazo o passe não vale mais para a tela", () => {
    const { access, clock } = accessAt(NOW);
    access.grant("ana", "chamado 4821, conferir evidência");
    clock.now = new Date(NOW.getTime() + 16 * MINUTE);
    expect(access.grantedFor("ana")).toBeNull();
  });

  it("`clear` apaga o passe", () => {
    const { access } = accessAt(NOW);
    access.grant("ana", "chamado 4821, conferir evidência");
    access.clear();
    expect(access.grantedFor("ana")).toBeNull();
    expect(access.headersFor("/architects/ana")).toEqual({});
  });

  it("SUPPORT_PASS_EXPIRED do serviço apaga o passe e avisa quem reabre o diálogo", () => {
    const { access } = accessAt(NOW);
    const expired = vi.fn();
    access.whenExpired(expired);
    access.grant("ana", "chamado 4821, conferir evidência");

    access.reviewFailure(new ApiError("venceu", 403, undefined, "SUPPORT_PASS_EXPIRED"));

    expect(access.grantedFor("ana")).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("outra recusa 403 não mexe no passe", () => {
    const { access } = accessAt(NOW);
    const expired = vi.fn();
    access.whenExpired(expired);
    access.grant("ana", "chamado 4821, conferir evidência");

    access.reviewFailure(new ApiError("não", 403, undefined, "FORBIDDEN"));

    expect(access.grantedFor("ana")).not.toBeNull();
    expect(expired).not.toHaveBeenCalled();
  });
});

describe("ApiClient — o passe entra pelo provedor de cabeçalhos, requisição a requisição", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 200 })));
  });

  it("manda `x-support-issued-at` na requisição da pessoa e em nenhuma outra", async () => {
    const { access } = accessAt(NOW);
    access.grant("ana", "chamado 4821, conferir evidência");
    const client = new ApiClient(
      "http://api.local",
      () => {},
      (resource) => access.headersFor(resource),
    );

    await client.request("/architects/ana");
    await client.request("/teams");

    const headersOf = (index: number) =>
      (fetchMock.mock.calls[index]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headersOf(0)["x-support-issued-at"]).toBe("2026-09-08T10:00:00.000Z");
    expect(headersOf(0)["x-support-architect"]).toBe("ana");
    expect(headersOf(1)).not.toHaveProperty("x-support-issued-at");
    expect(headersOf(1)).not.toHaveProperty("x-support-architect");
  });
});
