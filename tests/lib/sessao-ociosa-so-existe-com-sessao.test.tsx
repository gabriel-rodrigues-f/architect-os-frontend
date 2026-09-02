import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configurationCatalog } from "@/lib/configuration-queries";
import type { AppSettingRecord, AppSettingsResponse } from "@/lib/operational-settings";
import { useIdleSession } from "@/lib/use-idle-session";

/**
 * ARMADILHA 4 — O AVISO SÓ EXISTE PARA QUEM TEM SESSÃO.
 *
 * Nada disso roda na tela de login. Em produção quem garante isso é o
 * `AuthGate` de `__root.tsx` (sem `user`, o `AppShell` nem monta), mas
 * depender só da árvore de componentes é depender de uma decisão que outra
 * fatia pode mudar sem perceber. O adaptador tem o interruptor próprio, e é
 * ele que este arquivo prende.
 *
 * ONDA 31, fatia `ociosidade-na-tela` — pedido literal do dono:
 *
 *   "eu quero que seja configurável pelo administrador em uma tela de
 *    configuração." · "o tempo mínimo sem acesso deve ser 5 minutos."
 *
 * O orçamento deixa de ser constante: vem de `session.idleTimeoutMinutes`
 * em `GET /config/settings`, e o aviso é DERIVADO (timeout − 1). Enquanto a
 * configuração não chegou, o vigia NÃO conta — a régua da casa é não desenhar
 * número plausível quando não sabe (DECISOES.md, "régua × enfeite").
 */
const MINUTO = 60_000;
const CHAVE = configurationCatalog.operationalSettings.queryKey;

const registro = (key: string, value: number): AppSettingRecord => ({
  key,
  value,
  valueType: "int",
  scope: "operational",
  description: null,
  updatedAt: "2026-09-01T00:00:00Z",
  updatedBy: null,
});

const configuradoEm = (minutos: number): AppSettingsResponse => ({
  settings: [registro("session.idleTimeoutMinutes", minutos)],
});

let queryClient: QueryClient;

const embrulho = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const montar = (active: boolean, encerrar: () => void) =>
  renderHook(() => useIdleSession({ active, onEnd: encerrar }), { wrapper: embrulho });

describe("sessão ociosa — só existe para quem tem sessão, e só com a configuração na mão", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T09:00:00.000Z").getTime());
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("sem sessão, o relógio nem começa: nada avisa e nada desloga", () => {
    queryClient.setQueryData(CHAVE, configuradoEm(5));
    const encerrar = vi.fn();

    const { result } = montar(false, encerrar);

    act(() => {
      vi.advanceTimersByTime(30 * MINUTO);
    });

    expect(result.current).toBe("active");
    expect(encerrar).not.toHaveBeenCalled();
  });

  it("com a configuração em 5, avisa aos 4 e encerra aos 5", () => {
    queryClient.setQueryData(CHAVE, configuradoEm(5));
    const encerrar = vi.fn();

    const { result } = montar(true, encerrar);

    act(() => {
      vi.advanceTimersByTime(4 * MINUTO - 1_000);
    });
    expect(result.current, "antes dos 4 minutos, nada").toBe("active");

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe("warning");
    expect(encerrar).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(MINUTO);
    });
    expect(result.current).toBe("ended");
    expect(encerrar).toHaveBeenCalledTimes(1);
  });

  it("sem a configuração carregada, NADA dispara — nem com o padrão de fábrica", () => {
    const encerrar = vi.fn();

    const { result } = montar(true, encerrar);

    act(() => {
      vi.advanceTimersByTime(30 * MINUTO);
    });

    expect(result.current).toBe("active");
    expect(encerrar).not.toHaveBeenCalled();
  });

  /**
   * É o que acontece quando o administrador salva um tempo novo: a consulta é
   * invalidada, o número muda e o vigia recomeça com o orçamento novo. O
   * `advanceTimersByTime(0)` entrega a notificação do cache, que o react-query
   * agenda num `setTimeout(0)` — sem ele o vigia só nasceria no fim do avanço.
   */
  it("a configuração que chega depois liga o vigia a partir DALI, com o orçamento dela", () => {
    const encerrar = vi.fn();

    const { result } = montar(true, encerrar);

    act(() => {
      vi.advanceTimersByTime(30 * MINUTO);
    });
    expect(result.current).toBe("active");

    act(() => {
      queryClient.setQueryData(CHAVE, configuradoEm(5));
    });
    act(() => {
      vi.advanceTimersByTime(0);
    });

    act(() => {
      vi.advanceTimersByTime(4 * MINUTO);
    });
    expect(result.current, "o vigia começa a contar quando a configuração chega").toBe("warning");

    act(() => {
      vi.advanceTimersByTime(MINUTO);
    });
    expect(result.current).toBe("ended");
    expect(encerrar).toHaveBeenCalledTimes(1);
  });

  it("configuração carregada SEM a chave cai no padrão da casa: 10 minutos, aviso aos 9", () => {
    queryClient.setQueryData(CHAVE, { settings: [] } satisfies AppSettingsResponse);
    const encerrar = vi.fn();

    const { result } = montar(true, encerrar);

    act(() => {
      vi.advanceTimersByTime(9 * MINUTO);
    });
    expect(result.current).toBe("warning");

    act(() => {
      vi.advanceTimersByTime(MINUTO);
    });
    expect(result.current).toBe("ended");
  });

  it("desmontar solta o vigia: nada dispara depois que a tela sai", () => {
    queryClient.setQueryData(CHAVE, configuradoEm(5));
    const encerrar = vi.fn();

    const { unmount } = montar(true, encerrar);
    unmount();

    act(() => {
      vi.advanceTimersByTime(30 * MINUTO);
    });

    expect(encerrar).not.toHaveBeenCalled();
  });
});
