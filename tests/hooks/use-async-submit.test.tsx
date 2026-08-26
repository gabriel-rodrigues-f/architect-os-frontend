import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAsyncSubmit } from "@/hooks/use-async-submit";
import { ApiError } from "@/lib/api";

/**
 * OO3-11/D-6 (reuso final) — contrato do ciclo assíncrono compartilhado
 * (base do `CommandWithReasonDialog` e dos submits de development-plans/
 * settings). O esqueleto: limpa o erro, liga `submitting`, mapeia a
 * rejeição (ApiError.message | fallback), desliga `submitting` SEMPRE, e
 * devolve `{ ok }` explícito — sucesso é distinguível mesmo quando a ação
 * resolve `void`.
 */
describe("useAsyncSubmit", () => {
  it("sucesso: devolve { ok: true, value }, sem erro, e submitting volta a false", async () => {
    const { result } = renderHook(() => useAsyncSubmit("fallback"));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.run(() => Promise.resolve("valor"));
    });
    expect(outcome).toEqual({ ok: true, value: "valor" });
    expect(result.current.error).toBeNull();
    expect(result.current.submitting).toBe(false);
  });

  it("sucesso com Promise<void> ainda é { ok: true } — nunca ambíguo com falha", async () => {
    const { result } = renderHook(() => useAsyncSubmit("fallback"));
    let outcome: { ok: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.run(async () => {});
    });
    expect(outcome?.ok).toBe(true);
  });

  it("ApiError usa a mensagem do servidor; erro genérico usa o fallback; o erro CRU volta no resultado", async () => {
    const { result } = renderHook(() => useAsyncSubmit("mensagem de fallback"));
    const apiError = new ApiError("VERSION_CONFLICT do servidor", 409);
    await act(async () => {
      await result.current.run(() => Promise.reject(apiError));
    });
    expect(result.current.error).toBe("VERSION_CONFLICT do servidor");

    let outcome: { ok: boolean; error?: unknown } | undefined;
    const generic = new Error("qualquer coisa");
    await act(async () => {
      outcome = await result.current.run(() => Promise.reject(generic));
    });
    expect(result.current.error).toBe("mensagem de fallback");
    expect(outcome).toEqual({ ok: false, error: generic });
    expect(result.current.submitting).toBe(false);
  });

  it("fallback como função mapeia o erro (ex.: authErrorMessage)", async () => {
    const { result } = renderHook(() =>
      useAsyncSubmit((e) => (e instanceof Error ? `mapeado: ${e.message}` : "outro")),
    );
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error("boom")));
    });
    expect(result.current.error).toBe("mapeado: boom");
  });

  it("run limpa o erro anterior ao começar; clearError limpa sob demanda", async () => {
    const { result } = renderHook(() => useAsyncSubmit("fallback"));
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error("x")));
    });
    expect(result.current.error).toBe("fallback");
    await act(async () => {
      await result.current.run(() => Promise.resolve(1));
    });
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.run(() => Promise.reject(new Error("x")));
    });
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
