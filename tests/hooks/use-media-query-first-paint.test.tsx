import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useReducedMotion } from "@/hooks";

/**
 * QA-UX gate 1 (2026-08-29), achado 1 (parte 2) — o radar saía "colado no
 * centro" nos PNGs porque `useMediaQuery` nascia `false` e só corrigia num
 * efeito: o PRIMEIRO render montava o recharts com animação LIGADA mesmo
 * sob `prefers-reduced-motion: reduce` (a animação de entrada começava e o
 * flag chegava tarde demais para pará-la). Isso atinge usuário real de
 * reduced-motion, não só screenshot. O invariante: no cliente, o primeiro
 * render já responde o que o media query diz. Nasceu VERMELHO (primeira
 * leitura era `false` com o media casando).
 */
const originalMatchMedia = window.matchMedia;

function ReducedMotionProbe({ readings }: { readings: boolean[] }) {
  const reducedMotion = useReducedMotion();
  readings.push(reducedMotion);
  return null;
}

describe("useMediaQuery — o primeiro render já enxerga o media query", () => {
  beforeEach(() => {
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
  });

  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
  });

  it("com prefers-reduced-motion ativo, a primeira leitura já é true", () => {
    const readings: boolean[] = [];
    render(<ReducedMotionProbe readings={readings} />);

    expect(readings[0]).toBe(true);
  });
});
