import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CapabilityRadarFigure } from "@/components/app/charts-recharts";

/**
 * QA-UX gate 1 (2026-08-29), achado 1 — o radar "Perfil por capacidade"
 * plotava fora da régua de níveis: a escala radial ia de 0 a 5, mas nível é
 * 1–5 — não existe nível 0. O invariante que este teste fixa é a RÉGUA:
 * vértice de valor 1 fica no CENTRO do radar e vértice de valor 5 ENCOSTA no
 * anel externo (domínio 1–5 explícito). Contra o código antigo (domínio
 * [0,5]) o vértice de valor 1 caía a 20% do raio — este teste nasceu
 * VERMELHO provando isso.
 *
 * A geometria é medida no SVG que o recharts emite: o polígono da série
 * "Atual" e o anel externo do PolarGrid compartilham o mesmo centro e a
 * mesma escala radial.
 */

class SizedResizeObserver {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    const contentRect = {
      width: 500,
      height: 500,
      top: 0,
      left: 0,
      bottom: 500,
      right: 500,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
    this.callback(
      [{ target, contentRect } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}

const originalResizeObserver = globalThis.ResizeObserver;
const originalMatchMedia = window.matchMedia;

/** Ponto (x,y) lido de um path "M x,y L x,y … Z" do recharts. */
function verticesOf(path: string): { x: number; y: number }[] {
  return [...path.matchAll(/([\d.-]+),([\d.-]+)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }));
}

const distance = (from: { x: number; y: number }, to: { x: number; y: number }) =>
  Math.hypot(from.x - to.x, from.y - to.y);

describe("radar de capacidades — a escala radial é a régua de níveis 1–5", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = SizedResizeObserver as unknown as typeof ResizeObserver;
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
    globalThis.ResizeObserver = originalResizeObserver;
    window.matchMedia = originalMatchMedia;
  });

  it("valor 5 encosta no anel externo e valor 1 fica no centro", async () => {
    const dados = [
      { capability: "Integração", atual: 5, alvo: 1 },
      { capability: "Segurança", atual: 1, alvo: 1 },
      { capability: "Dados", atual: 3, alvo: 1 },
    ];

    const { container } = render(
      <CapabilityRadarFigure data={dados} currentLabel="Atual" targetLabel="Esperado" />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".recharts-radar-polygon path").length).toBeGreaterThan(1);
    });

    const gridRings = [...container.querySelectorAll(".recharts-polar-grid path")];
    const outerRing = verticesOf(gridRings.at(-1)?.getAttribute("d") ?? "");
    expect(outerRing.length).toBeGreaterThanOrEqual(3);

    const center = {
      x: outerRing.slice(0, 3).reduce((sum, vertex) => sum + vertex.x, 0) / 3,
      y: outerRing.slice(0, 3).reduce((sum, vertex) => sum + vertex.y, 0) / 3,
    };
    const outerRadius = distance(outerRing[0]!, center);
    expect(outerRadius).toBeGreaterThan(50);

    const [, atualPath] = [...container.querySelectorAll(".recharts-radar-polygon path")];
    const [vertexLevel5, vertexLevel1] = verticesOf(atualPath?.getAttribute("d") ?? "");

    expect(distance(vertexLevel5!, center)).toBeCloseTo(outerRadius, 0);
    expect(distance(vertexLevel1!, center)).toBeCloseTo(0, 0);
  });
});
