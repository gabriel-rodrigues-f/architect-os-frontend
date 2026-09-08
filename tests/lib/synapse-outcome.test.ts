import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-errors";
import { networkUnavailableError } from "@/lib/api-client";
import { SynapseSignals } from "@/lib/synapse-network";
import { SilentRoutes, SynapseOutcomeAnnouncer, SynapseOutcomeRule } from "@/lib/synapse-outcome";

/**
 * A RÉGUA DE COR do interior (inventário 2026-09-08, §1.3 e §5): escrita 2xx →
 * azul; recusa 4xx com mensagem vermelha (400/403/409/422) → vermelho; leitura,
 * queda de serviço (0/5xx) e sessão expirada (401) → nada; IA, exportações e
 * marcar aviso lido → nada, por lista nomeada. E a coalescência: um lote de
 * escritas em ~400 ms é UM pulso — a rede não treme doze vezes porque doze
 * competências foram pontuadas.
 */
describe("SynapseOutcomeRule — método e status viram tom, ou silêncio", () => {
  it.each([
    ["POST", 200, "primary"],
    ["POST", 201, "primary"],
    ["PATCH", 200, "primary"],
    ["PUT", 204, "primary"],
    ["DELETE", 204, "primary"],
    ["POST", 400, "danger"],
    ["POST", 403, "danger"],
    ["PATCH", 404, "danger"],
    ["POST", 409, "danger"],
    ["POST", 422, "danger"],
  ])("%s %i → %s", (method, status, tone) => {
    expect(SynapseOutcomeRule.toneOf({ method, resource: "/cycles", status })).toBe(tone);
  });

  it.each([
    ["GET", 200],
    ["GET", 404],
    ["POST", 401],
    ["POST", 500],
    ["POST", 503],
    ["POST", 0],
  ])("%s %i → nada", (method, status) => {
    expect(SynapseOutcomeRule.toneOf({ method, resource: "/cycles", status })).toBeNull();
  });

  it("a rota silenciosa não pulsa nem no sucesso nem na recusa", () => {
    for (const resource of [
      "/professionals/a1/one-on-one-preparation?profile=moderate",
      "/reports/evolution/pdf",
      "/notices/n1/read",
      "/notices/read-all",
      "/auth/login",
    ]) {
      expect(SynapseOutcomeRule.toneOf({ method: "POST", resource, status: 200 })).toBeNull();
      expect(SynapseOutcomeRule.toneOf({ method: "POST", resource, status: 422 })).toBeNull();
    }
  });
});

describe("SilentRoutes — a lista nomeada do que não pulsa", () => {
  it.each([
    "/professionals/a1/one-on-one-preparation",
    "/professionals/a1/session-script?profile=empirical",
    "/professionals/a1/career-readiness-explanation",
    "/professionals/a1/development-plan-recommendation?competencyId=c1",
    "/evidences/e1/review-assistance",
    "/professionals/a1/calibration-assistance",
    "/professionals/a1/stagnation-alert",
    "/capabilities/quality-review",
    "/reports/evolution/pdf",
    "/reports/career-statement",
    "/notices/n1/read",
    "/notices/read-all",
    "/auth/login",
    "/auth/register",
    "/auth/logout",
    "/auth/change-password",
    "/auth/access-recovery",
    "/auth/set-password",
  ])("%s é silenciosa", (resource) => {
    expect(SilentRoutes.covers(resource)).toBe(true);
  });

  it.each([
    "/cycles",
    "/professionals/a1",
    "/auth/users",
    "/auth/users/u1",
    "/auth/users/u1/access-recovery",
    "/assessments/as1/scores",
    "/plans/p1/items/i1",
  ])("%s pulsa", (resource) => {
    expect(SilentRoutes.covers(resource)).toBe(false);
  });
});

describe("SynapseOutcomeRule — a resposta às portas (login, primeiro acesso, senha, recuperação)", () => {
  it("sucesso é primário; a recusa do serviço (401, 400) e a recusa local são `danger`", () => {
    expect(SynapseOutcomeRule.toneOfDoorResult(null)).toBe("primary");
    expect(SynapseOutcomeRule.toneOfDoorResult(new ApiError("recusado", 401))).toBe("danger");
    expect(SynapseOutcomeRule.toneOfDoorResult(new ApiError("senha fraca", 400))).toBe("danger");
    expect(SynapseOutcomeRule.toneOfDoorResult(new Error("senha não confere"))).toBe("danger");
  });

  it("o serviço fora do ar não é culpa do que foi digitado: 0 e 5xx não pulsam", () => {
    expect(SynapseOutcomeRule.toneOfDoorResult(networkUnavailableError(new Error()))).toBeNull();
    expect(SynapseOutcomeRule.toneOfDoorResult(new ApiError("caiu", 503))).toBeNull();
  });
});

describe("SynapseOutcomeAnnouncer — o anúncio coalescido", () => {
  function anunciador() {
    let now = 0;
    const signals = new SynapseSignals();
    const announcer = new SynapseOutcomeAnnouncer(signals, () => now);
    return { signals, announcer, advance: (ms: number) => (now += ms) };
  }

  it("doze escritas 2xx em 400 ms viram um pulso azul", () => {
    const { signals, announcer, advance } = anunciador();
    for (let index = 0; index < 12; index += 1) {
      announcer.observe({ method: "PATCH", resource: "/assessments/a1/scores", status: 200 });
      advance(30);
    }
    expect(signals.drainPulses()).toEqual(["primary"]);
  });

  it("passada a janela, a escrita seguinte pulsa de novo", () => {
    const { signals, announcer, advance } = anunciador();
    announcer.observe({ method: "POST", resource: "/cycles", status: 201 });
    expect(signals.drainPulses()).toEqual(["primary"]);
    advance(401);
    announcer.observe({ method: "POST", resource: "/cycles", status: 201 });
    expect(signals.drainPulses()).toEqual(["primary"]);
  });

  it("a recusa no meio do lote pulsa vermelho — a coalescência é por tom", () => {
    const { signals, announcer, advance } = anunciador();
    announcer.observe({ method: "PATCH", resource: "/assessments/a1/scores", status: 200 });
    advance(50);
    announcer.observe({ method: "PATCH", resource: "/assessments/a1/scores", status: 409 });
    expect([...signals.drainPulses()].sort()).toEqual(["danger", "primary"]);
  });

  it("leitura, queda e rota silenciosa não chegam à rede", () => {
    const { signals, announcer } = anunciador();
    announcer.observe({ method: "GET", resource: "/cycles", status: 200 });
    announcer.observe({ method: "POST", resource: "/cycles", status: 500 });
    announcer.observe({ method: "POST", resource: "/notices/read-all", status: 200 });
    expect(signals.drainPulses()).toEqual([]);
  });
});
