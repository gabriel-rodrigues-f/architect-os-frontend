import { describe, expect, it } from "vitest";

import { LetterCascade, LockupFit } from "@/lib/brand-lockup";

/**
 * O lockup da marca (terceira avaliação de UX, 2026-09-07): "Synapse" e
 * "Desenvolvimento de Capacidades" numa unidade cujas extremidades esquerda e
 * direita coincidem opticamente (1–3 px). Sem `scaleX`, sem espaços manuais:
 * o wordmark ganha o `letter-spacing` que o descriptor pede, medido no
 * cliente e recalculado a cada largura. O `LockupFit` é a conta; o
 * `LetterCascade` é o ritmo da piscada — cada linha com o seu passo, as duas
 * começando e terminando no mesmo instante.
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

describe("LetterCascade — as duas linhas começam e terminam juntas", () => {
  it("o atraso é proporcional ao índice e a última letra termina exatamente no fim do pulso", () => {
    const cascata = new LetterCascade(1200, 7);
    expect(cascata.letterMs).toBeCloseTo(1200 * 0.35, 5);
    expect(cascata.delayOf(0)).toBe(0);
    expect(cascata.delayOf(3)).toBeCloseTo((3 / 6) * (1200 - cascata.letterMs), 5);
    expect(cascata.delayOf(6) + cascata.letterMs).toBeCloseTo(1200, 5);
  });

  it("'Synapse' (7) e 'Desenvolvimento de Capacidades' (30) têm passos diferentes, mas o mesmo início e o mesmo fim", () => {
    const curta = new LetterCascade(1200, 7);
    const longa = new LetterCascade(1200, 30);
    expect(curta.delayOf(0)).toBe(longa.delayOf(0));
    expect(curta.delayOf(6) + curta.letterMs).toBeCloseTo(longa.delayOf(29) + longa.letterMs, 5);
    expect(curta.delayOf(1)).toBeGreaterThan(longa.delayOf(1));
  });

  it("uma linha de uma letra só pisca no início, sem dividir por zero", () => {
    const uma = new LetterCascade(1000, 1);
    expect(uma.delayOf(0)).toBe(0);
    expect(Number.isFinite(uma.delayOf(0))).toBe(true);
  });
});
