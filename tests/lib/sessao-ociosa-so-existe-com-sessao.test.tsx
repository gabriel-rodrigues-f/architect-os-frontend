import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IdleSessionBudget } from "@/lib/idle-session";
import { useIdleSession } from "@/lib/use-idle-session";

/**
 * ARMADILHA 4 — O AVISO SÓ EXISTE PARA QUEM TEM SESSÃO.
 *
 * Nada disso roda na tela de login. Em produção quem garante isso é o
 * `AuthGate` de `__root.tsx` (sem `user`, o `AppShell` nem monta), mas
 * depender só da árvore de componentes é depender de uma decisão que outra
 * fatia pode mudar sem perceber. O adaptador tem o interruptor próprio, e é
 * ele que este arquivo prende.
 */
const ORCAMENTO_CURTO = new IdleSessionBudget(9, 10);
const MINUTO = 60_000;

describe("sessão ociosa — só existe para quem tem sessão", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T09:00:00.000Z").getTime());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("sem sessão, o relógio nem começa: nada avisa e nada desloga", () => {
    const encerrar = vi.fn();

    const { result } = renderHook(() =>
      useIdleSession({ active: false, onEnd: encerrar, budget: ORCAMENTO_CURTO }),
    );

    act(() => {
      vi.advanceTimersByTime(30 * MINUTO);
    });

    expect(result.current).toBe("active");
    expect(encerrar).not.toHaveBeenCalled();
  });

  it("com sessão, o relógio conta — avisa aos 9 e encerra aos 10", () => {
    const encerrar = vi.fn();

    const { result } = renderHook(() =>
      useIdleSession({ active: true, onEnd: encerrar, budget: ORCAMENTO_CURTO }),
    );

    act(() => {
      vi.advanceTimersByTime(9 * MINUTO);
    });
    expect(result.current).toBe("warning");
    expect(encerrar).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(MINUTO);
    });
    expect(result.current).toBe("ended");
    expect(encerrar).toHaveBeenCalledTimes(1);
  });

  it("desmontar solta o vigia: nada dispara depois que a tela sai", () => {
    const encerrar = vi.fn();

    const { unmount } = renderHook(() =>
      useIdleSession({ active: true, onEnd: encerrar, budget: ORCAMENTO_CURTO }),
    );
    unmount();

    act(() => {
      vi.advanceTimersByTime(30 * MINUTO);
    });

    expect(encerrar).not.toHaveBeenCalled();
  });
});
