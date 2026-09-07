import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ReactNode } from "react";

import { useAsyncSubmit, useToastSubmit } from "@/hooks";
import { ApiError } from "@/lib/api";
import { DependencyProvider } from "@/lib/dependencies";
import { FrontendContainer } from "@/lib/gateways/container";

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

/**
 * A RECUSA LOCAL (inventário 2026-09-08, §5.8): campos vazios, senha que não
 * confere, duração inválida — a mensagem vermelha aparece SEM ir ao serviço,
 * então o anúncio à rede não pode vir do `ApiClient`. Vem do ponto que já
 * centraliza o envio: `rejectLocally()` pulsa vermelho nos sinais da
 * aplicação. Sem container por perto (uma tela de porta), não pulsa nada e
 * não quebra.
 */
describe("useAsyncSubmit / useToastSubmit — rejectLocally", () => {
  function comContainer() {
    const container = FrontendContainer.create({ baseUrl: "http://api.local" });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DependencyProvider container={container}>{children}</DependencyProvider>
    );
    return { container, wrapper };
  }

  it("pulsa vermelho nos sinais do container, sem tocar em `error` nem em `submitting`", () => {
    const { container, wrapper } = comContainer();
    const { result } = renderHook(() => useAsyncSubmit("fallback"), { wrapper });
    act(() => result.current.rejectLocally());
    expect(container.synapseSignals.drainPulses()).toEqual(["danger"]);
    expect(result.current.error).toBeNull();
    expect(result.current.submitting).toBe(false);
  });

  it("o mesmo ponto existe no envio com toast", () => {
    const { container, wrapper } = comContainer();
    const { result } = renderHook(() => useToastSubmit(), { wrapper });
    act(() => result.current.rejectLocally());
    expect(container.synapseSignals.drainPulses()).toEqual(["danger"]);
  });

  it("sem container, não pulsa e não quebra", () => {
    const { result } = renderHook(() => useAsyncSubmit("fallback"));
    expect(() => act(() => result.current.rejectLocally())).not.toThrow();
  });
});
