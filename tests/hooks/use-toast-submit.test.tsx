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
const FALLBACK_DO_APP = "Não foi possível concluir a operação. Tente de novo em alguns instantes.";

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

  /**
   * ONDA 42 — a régua VIROU. Este teste dizia "erro genérico usa a mensagem do
   * próprio Error" e guardava justamente o vazamento que o dono reclamou: um
   * `TypeError`, um `ZodError` ou uma invariante de componente chegavam ao
   * toast com o texto escrito para desenvolvedor. Só `UserFacingError` tem
   * frase feita PARA a tela; o resto cai no fallback do app, e o erro cru vai
   * para o console e a telemetria.
   */
  it("erro genérico NÃO mostra a mensagem do próprio Error — ela é de desenvolvedor", async () => {
    const { result } = renderHook(() => useToastSubmit());
    await act(async () => {
      await result.current.run(() => Promise.reject(new TypeError("Failed to fetch")));
    });
    expect(toast.error).not.toHaveBeenCalledWith("Failed to fetch");
    expect(toast.error).toHaveBeenCalledWith(FALLBACK_DO_APP);
  });

  it("rejeição que não é Error cai no fallback padrão do app", async () => {
    const { result } = renderHook(() => useToastSubmit());
    await act(async () => {
      await result.current.run(() => Promise.reject("string crua"));
    });
    expect(toast.error).toHaveBeenCalledWith(FALLBACK_DO_APP);
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
