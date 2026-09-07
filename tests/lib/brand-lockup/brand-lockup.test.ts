import { describe, expect, it } from "vitest";

import { LockupFit } from "@/lib/brand-lockup";

/**
 * O lockup da marca (terceira avaliação de UX, 2026-09-07): "Synapse" e
 * "Desenvolvimento de Capacidades" numa unidade cujas extremidades esquerda e
 * direita coincidem opticamente (1–3 px). Sem `scaleX`, sem espaços manuais:
 * o wordmark ganha o `letter-spacing` que o descriptor pede, medido no
 * cliente e recalculado a cada largura. O `LockupFit` é a conta.
 *
 * O `LetterCascade` — o ritmo da piscada por letra — morreu em 2026-09-08,
 * com a piscada: o dono pediu a animação só na rede de sinapses.
 */
describe("LockupFit — o wordmark termina onde o descriptor termina", () => {
  it("calcula o tracking que leva a última letra do wordmark à borda direita do descriptor", () => {
    // 7 glifos com 224 px de tinta natural (medidos sem tracking); descriptor com 393 px.
    const fit = LockupFit.for({
      wordmarkWidth: 224,
      wordmarkTracking: 0,
      glyphs: 7,
      descriptorWidth: 393,
    });
    expect(fit.trackingPx).toBeCloseTo((393 - 224) / 6, 5);
    expect(Math.abs(fit.inkWidth(224, 7) - 393)).toBeLessThanOrEqual(LockupFit.TOLERANCE_PX);
  });

  it("é estável: medir de novo com o tracking já aplicado devolve o mesmo tracking", () => {
    const primeira = LockupFit.for({
      wordmarkWidth: 224,
      wordmarkTracking: 0,
      glyphs: 7,
      descriptorWidth: 393,
    });
    // A caixa do wordmark passa a incluir o tracking depois de cada glifo (o último também).
    const larguraMedida = 224 + 7 * primeira.trackingPx;
    const segunda = LockupFit.for({
      wordmarkWidth: larguraMedida,
      wordmarkTracking: primeira.trackingPx,
      glyphs: 7,
      descriptorWidth: 393,
    });
    expect(segunda.trackingPx).toBeCloseTo(primeira.trackingPx, 5);
    expect(segunda.differsFrom(primeira)).toBe(false);
  });

  it("é responsivo: outra largura de descriptor, outro tracking — nunca congelado", () => {
    const estreito = LockupFit.for({
      wordmarkWidth: 140,
      wordmarkTracking: 0,
      glyphs: 7,
      descriptorWidth: 280,
    });
    const largo = LockupFit.for({
      wordmarkWidth: 224,
      wordmarkTracking: 0,
      glyphs: 7,
      descriptorWidth: 393,
    });
    expect(estreito.trackingPx).not.toBeCloseTo(largo.trackingPx, 1);
    expect(estreito.differsFrom(largo)).toBe(true);
  });

  it("nunca aperta: se o descriptor for mais curto que a tinta natural, o tracking é zero", () => {
    const fit = LockupFit.for({
      wordmarkWidth: 300,
      wordmarkTracking: 0,
      glyphs: 7,
      descriptorWidth: 200,
    });
    expect(fit.trackingPx).toBe(0);
  });

  it("o estilo compensa o tracking sobrando depois da última letra, sem scaleX", () => {
    const fit = LockupFit.for({
      wordmarkWidth: 224,
      wordmarkTracking: 0,
      glyphs: 7,
      descriptorWidth: 393,
    });
    expect(fit.style.letterSpacing).toBe(`${fit.trackingPx}px`);
    expect(fit.style.marginInlineEnd).toBe(`${-fit.trackingPx}px`);
    expect(JSON.stringify(fit.style)).not.toContain("scale");
  });
});
