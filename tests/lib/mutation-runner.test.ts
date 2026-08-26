import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-errors";
import { MutationRunner, type MutationCache } from "@/lib/mutation-runner";

/**
 * OO3-09 (Fase OO-3) — o `MutationRunner` carrega o ciclo otimista inteiro
 * que `buildApi()` (`store.tsx`) repetia em cada método. Testado direto com
 * um cache/notificador falsos (`vi.fn()`, sem montar React/React Query),
 * mesmo padrão dos ViewModels (`learning-paths-view-model.test.ts` etc.):
 * a cobertura de tela existente (store/rotas) continua sendo a
 * characterization do comportamento fim-a-fim; este cobre a classe isolada.
 */
type State = { items: string[] };

const FALLBACK = "Não foi possível salvar.";

function makeRunner() {
  let state: State = { items: [] };
  const cache: MutationCache<State> & { invalidate: ReturnType<typeof vi.fn> } = {
    update: vi.fn((fn: (s: State) => State) => {
      state = fn(state);
    }),
    invalidate: vi.fn(),
  };
  const notifyError = vi.fn();
  const runner = new MutationRunner<State>(cache, notifyError, FALLBACK);
  return { runner, cache, notifyError, getState: () => state };
}

/** Deixa as microtasks pendentes (then/catch do "dispara e esquece") rodarem. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("MutationRunner.optimistic", () => {
  it("aplica a mudança local ANTES de criar a chamada remota (mesma ordem do par local/remote)", () => {
    const { runner, getState } = makeRunner();
    let itemsAtCallTime: string[] = [];
    runner.optimistic(
      (s) => ({ items: [...s.items, "otimista"] }),
      () => {
        itemsAtCallTime = getState().items;
        return Promise.resolve("ok");
      },
    );
    expect(itemsAtCallTime).toEqual(["otimista"]);
  });

  it("sem reconcile: sucesso não toca mais no cache", async () => {
    const { runner, cache } = makeRunner();
    runner.optimistic(
      (s) => ({ items: [...s.items, "a"] }),
      () => Promise.resolve("ok"),
    );
    await flush();
    expect(cache.update).toHaveBeenCalledTimes(1);
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it("com reconcile: grava a resposta real por cima do palpite otimista (B-09, 409 espúrios)", async () => {
    const { runner, getState } = makeRunner();
    runner.optimistic(
      (s) => ({ items: [...s.items, "palpite"] }),
      () => Promise.resolve("resposta-real"),
      (result) => () => ({ items: [result] }),
    );
    await flush();
    expect(getState().items).toEqual(["resposta-real"]);
  });

  it("erro ApiError: notifica com a mensagem do servidor e revalida o snapshot", async () => {
    const { runner, cache, notifyError, getState } = makeRunner();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    runner.optimistic(
      (s) => ({ items: [...s.items, "mentira-otimista"] }),
      () => Promise.reject(new ApiError("Versão desatualizada", 409)),
    );
    await flush();
    expect(getState().items).toEqual(["mentira-otimista"]); // rollback é via revalidação, não via undo local
    expect(notifyError).toHaveBeenCalledWith("Versão desatualizada");
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith("[api] 409: Versão desatualizada");
    consoleError.mockRestore();
  });

  it("erro não-ApiError: notifica com a mensagem padrão injetada", async () => {
    const { runner, cache, notifyError } = makeRunner();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    runner.optimistic(
      (s) => s,
      () => Promise.reject(new Error("rede caiu")),
    );
    await flush();
    expect(notifyError).toHaveBeenCalledWith(FALLBACK);
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});

describe("MutationRunner.command", () => {
  it("espera o servidor, grava a resposta no cache e a devolve — nada de otimismo", async () => {
    const { runner, cache, getState } = makeRunner();
    const call = vi.fn(() => Promise.resolve("criado-no-servidor"));
    const result = await runner.command(call, (created) => (s) => ({
      items: [...s.items, created],
    }));
    expect(result).toBe("criado-no-servidor");
    expect(getState().items).toEqual(["criado-no-servidor"]);
    expect(cache.update).toHaveBeenCalledTimes(1);
  });

  it("erro sobe cru para o chamador — sem toast, sem invalidate (a tela mostra o erro de verdade)", async () => {
    const { runner, cache, notifyError } = makeRunner();
    const boom = new ApiError("Só o Tech Lead pode", 403);
    await expect(
      runner.command(
        () => Promise.reject(boom),
        () => (s) => s,
      ),
    ).rejects.toBe(boom);
    expect(cache.update).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });
});

describe("MutationRunner.guarded", () => {
  it("sucesso: mesmo contrato de command", async () => {
    const { runner, getState } = makeRunner();
    const result = await runner.guarded(
      () => Promise.resolve({ archived: true }),
      ({ archived }) =>
        (s) => ({ items: [...s.items, archived ? "arquivada" : "apagada"] }),
    );
    expect(result).toEqual({ archived: true });
    expect(getState().items).toEqual(["arquivada"]);
  });

  it("erro: revalida o snapshot e propaga — sem notificação (a tela decide como mostrar)", async () => {
    const { runner, cache, notifyError } = makeRunner();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = new ApiError("Competência em uso", 409);
    await expect(
      runner.guarded(
        () => Promise.reject(boom),
        () => (s) => s,
      ),
    ).rejects.toBe(boom);
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
    expect(cache.update).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("[api] 409: Competência em uso");
    consoleError.mockRestore();
  });
});
