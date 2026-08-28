import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  useDisplayPreferences,
  useForcedColors,
  useIncreasedContrast,
  useReducedMotion,
} from "@/hooks";

/**
 * A família de preferências lê o sistema operacional — `prefers-reduced-motion`,
 * `prefers-contrast`, `forced-colors` — em vez de pedir que a pessoa se declare
 * num botão dentro do app. O que estes testes travam é essa direção: mudou a
 * preferência do SO, mudou o app; não existe estado próprio a sincronizar.
 */

const original = window.matchMedia;

function stubMatchMedia(consultasAtivas: readonly string[]) {
  window.matchMedia = ((query: string) => ({
    matches: consultasAtivas.some((ativa) => query.includes(ativa)),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = original;
});

describe("preferências de exibição", () => {
  it("sem nenhuma preferência ligada, tudo fica falso", () => {
    stubMatchMedia([]);
    const { result } = renderHook(() => useDisplayPreferences());
    expect(result.current).toEqual({
      reducedMotion: false,
      increasedContrast: false,
      forcedColors: false,
      needsStrongerEncoding: false,
    });
  });

  it("cada hook responde à sua própria consulta de mídia", () => {
    stubMatchMedia(["prefers-contrast"]);
    expect(renderHook(() => useIncreasedContrast()).result.current).toBe(true);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
    expect(renderHook(() => useForcedColors()).result.current).toBe(false);
  });

  /**
   * Em `forced-colors` o sistema operacional substitui toda cor da página: o
   * segundo canal (traço, símbolo, padrão) vira o único canal, e por isso a
   * codificação sobe de intensidade — mesmo sem `prefers-contrast`.
   */
  it("contraste alto e cores forçadas pedem codificação mais forte", () => {
    stubMatchMedia(["prefers-contrast"]);
    expect(renderHook(() => useDisplayPreferences()).result.current.needsStrongerEncoding).toBe(
      true,
    );

    stubMatchMedia(["forced-colors"]);
    expect(renderHook(() => useDisplayPreferences()).result.current.needsStrongerEncoding).toBe(
      true,
    );
  });

  it("movimento reduzido continua sendo lido do sistema", () => {
    stubMatchMedia(["prefers-reduced-motion"]);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
  });
});
