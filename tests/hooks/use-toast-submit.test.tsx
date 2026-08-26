import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useToastSubmit } from "@/hooks";
import { ApiError } from "@/lib/api";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

/**
 * OO3-18/F-1 — irmão de `useAsyncSubmit` para o esqueleto "erro vira
 * toast.error(authErrorMessage)". Mesmo contrato `AsyncSubmitResult`;
 * `submitting` liga durante a ação e desliga SEMPRE — inclusive nos 3 call
 * sites que antes não tinham `finally`/`setSaving` (bug latente de
 * duplo-submit corrigido pela unificação).
 */
describe("useToastSubmit", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it("sucesso: devolve { ok: true, value }, sem toast, e submitting volta a false", async () => {
    const { result } = renderHook(() => useToastSubmit());
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.run(() => Promise.resolve("valor"));
    });
    expect(outcome).toEqual({ ok: true, value: "valor" });
    expect(toast.error).not.toHaveBeenCalled();
    expect(result.current.submitting).toBe(false);
  });

  it("submitting fica true enquanto a ação está em voo — é o que desabilita o botão", async () => {
    const { result } = renderHook(() => useToastSubmit());
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });

    let inFlight!: Promise<unknown>;
    act(() => {
      inFlight = result.current.run(() => pending);
    });
    expect(result.current.submitting).toBe(true);

    await act(async () => {
      release();
      await inFlight;
    });
    expect(result.current.submitting).toBe(false);
  });

  it("ApiError vira toast.error com a mensagem do servidor; o erro CRU volta no resultado", async () => {
    const { result } = renderHook(() => useToastSubmit());
    const apiError = new ApiError("VERSION_CONFLICT do servidor", 409);
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.run(() => Promise.reject(apiError));
    });
    expect(toast.error).toHaveBeenCalledWith("VERSION_CONFLICT do servidor");
    expect(outcome).toEqual({ ok: false, error: apiError });
    expect(result.current.submitting).toBe(false);
  });

  it("erro genérico usa a mensagem do próprio Error (contrato de authErrorMessage)", async () => {
    const { result } = renderHook(() => useToastSubmit());
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error("boom")));
    });
    expect(toast.error).toHaveBeenCalledWith("boom");
  });

  it("rejeição que não é Error cai no fallback padrão do app", async () => {
    const { result } = renderHook(() => useToastSubmit());
    await act(async () => {
      await result.current.run(() => Promise.reject("string crua"));
    });
    expect(toast.error).toHaveBeenCalledWith("Não foi possível concluir a operação");
  });

  it("sucesso com Promise<void> ainda é { ok: true } — nunca ambíguo com falha", async () => {
    const { result } = renderHook(() => useToastSubmit());
    let outcome: { ok: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.run(async () => {});
    });
    expect(outcome?.ok).toBe(true);
  });
});
