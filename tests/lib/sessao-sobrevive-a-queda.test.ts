import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/api";
import { networkUnavailableError } from "@/lib/api-client";
import { ApiError } from "@/lib/api-errors";
import { SessionBootstrap, SessionBootstrapReader } from "@/lib/session-bootstrap";
import { fixtureAdminUser } from "../helpers/fixtures";

/**
 * Dono (2026-09-07): "eu estava logado, derrubei o backend propositalmente e
 * comecei a jogar o joguinho. quando atualizei a tela fui deslogado. isso não
 * pode ocorrer, somente se o token do frontend expirar".
 *
 * A leitura de `/auth/me` da montagem tem QUATRO desfechos, não dois: lendo,
 * sessão aberta, sem sessão (401) e serviço fora. Só o 401 diz "não há
 * sessão"; o resto é desconhecimento — e desconhecimento se resolve
 * perguntando de novo, não mandando a pessoa ao login. Este arquivo prende a
 * política sem relógio de verdade.
 */

const semServico = () => Promise.reject(networkUnavailableError(new TypeError("fetch failed")));
const semSessao = () =>
  Promise.reject(new ApiError("Sem sessão.", 401, undefined, "AUTHENTICATION_REQUIRED"));
const comSessao = () => Promise.resolve<SessionUser>(fixtureAdminUser);

describe("SessionBootstrap — o que cada desfecho da leitura significa", () => {
  it("401 é ausência de sessão; queda de rede, 502, 504 e 500 são serviço fora", () => {
    expect(SessionBootstrap.afterFailure(new ApiError("x", 401)).kind).toBe("absent");
    expect(SessionBootstrap.afterFailure(networkUnavailableError(new Error())).kind).toBe(
      "serviceDown",
    );
    expect(SessionBootstrap.afterFailure(new ApiError("x", 502)).kind).toBe("serviceDown");
    expect(SessionBootstrap.afterFailure(new ApiError("x", 504)).kind).toBe("serviceDown");
    expect(SessionBootstrap.afterFailure(new ApiError("x", 500)).kind).toBe("serviceDown");
  });

  it("erro que nem é da API (parse, invariante) também é serviço fora — nunca login", () => {
    expect(SessionBootstrap.afterFailure(new SyntaxError("Unexpected token")).kind).toBe(
      "serviceDown",
    );
  });

  it("só o estado aberto carrega usuário; só o estado lendo é `loading`", () => {
    expect(SessionBootstrap.open(fixtureAdminUser).user).toBe(fixtureAdminUser);
    expect(SessionBootstrap.reading().loading).toBe(true);
    expect(SessionBootstrap.serviceDown().loading).toBe(false);
    expect(SessionBootstrap.serviceDown().user).toBeNull();
    expect(SessionBootstrap.absent().user).toBeNull();
  });
});

describe("SessionBootstrapReader — insiste enquanto o serviço está fora", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queda → serviceDown, tenta de novo no intervalo, e abre a sessão quando o serviço volta", async () => {
    let servicoNoAr = false;
    const read = vi.fn(() => (servicoNoAr ? comSessao() : semServico()));
    const estados: string[] = [];
    const reader = new SessionBootstrapReader(read, (estado) => estados.push(estado.kind));

    reader.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(estados).toEqual(["serviceDown"]);
    expect(read).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(SessionBootstrapReader.RETRY_INTERVAL_MS);
    expect(read).toHaveBeenCalledTimes(2);
    expect(estados).toEqual(["serviceDown", "serviceDown"]);

    servicoNoAr = true;
    await vi.advanceTimersByTimeAsync(SessionBootstrapReader.RETRY_INTERVAL_MS);
    expect(read).toHaveBeenCalledTimes(3);
    expect(estados.at(-1)).toBe("open");

    // Sessão aberta: nada mais é agendado.
    await vi.advanceTimersByTimeAsync(SessionBootstrapReader.RETRY_INTERVAL_MS * 3);
    expect(read).toHaveBeenCalledTimes(3);
    reader.stop();
  });

  it("401 → absent, e NÃO tenta de novo", async () => {
    const read = vi.fn(semSessao);
    const estados: string[] = [];
    const reader = new SessionBootstrapReader(read, (estado) => estados.push(estado.kind));

    reader.start();
    await vi.advanceTimersByTimeAsync(SessionBootstrapReader.RETRY_INTERVAL_MS * 3);

    expect(estados).toEqual(["absent"]);
    expect(read).toHaveBeenCalledTimes(1);
    reader.stop();
  });

  it("o serviço que volta com 401 leva ao login, não à aplicação", async () => {
    let servicoNoAr = false;
    const read = vi.fn(() => (servicoNoAr ? semSessao() : semServico()));
    const estados: string[] = [];
    const reader = new SessionBootstrapReader(read, (estado) => estados.push(estado.kind));

    reader.start();
    await vi.advanceTimersByTimeAsync(0);
    servicoNoAr = true;
    await vi.advanceTimersByTimeAsync(SessionBootstrapReader.RETRY_INTERVAL_MS);

    expect(estados).toEqual(["serviceDown", "absent"]);
    reader.stop();
  });

  it("retryNow lê na hora e substitui a tentativa agendada — sem leituras em dobro", async () => {
    let servicoNoAr = false;
    const read = vi.fn(() => (servicoNoAr ? comSessao() : semServico()));
    const estados: string[] = [];
    const reader = new SessionBootstrapReader(read, (estado) => estados.push(estado.kind));

    reader.start();
    await vi.advanceTimersByTimeAsync(0);
    servicoNoAr = true;
    reader.retryNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(estados).toEqual(["serviceDown", "open"]);
    expect(read).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(SessionBootstrapReader.RETRY_INTERVAL_MS * 2);
    expect(read).toHaveBeenCalledTimes(2);
    reader.stop();
  });

  it("stop cancela a tentativa agendada e silencia a leitura em voo", async () => {
    const read = vi.fn(semServico);
    const estados: string[] = [];
    const reader = new SessionBootstrapReader(read, (estado) => estados.push(estado.kind));

    reader.start();
    reader.stop();
    await vi.advanceTimersByTimeAsync(SessionBootstrapReader.RETRY_INTERVAL_MS * 3);

    expect(estados).toEqual([]);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
