import { describe, expect, it } from "vitest";

import {
  areDistinguishableByColorAlone,
  DICHROMACIES,
  perceptualDistance,
  SEPARATION,
  separationUnder,
  simulateColorVision,
  worstSeparation,
} from "@/lib/accessibility";
import { Oklch } from "@/lib/design";

/**
 * Simulação de dicromacia por matriz sobre RGB linear — Machado, Oliveira &
 * Fernandes (2009), severidade 1.0. É o mesmo modelo que os validadores de
 * paleta usam; trocá-lo por Viénot-1999 desloca os pares limítrofes e obrigaria
 * a recalibrar os limiares de `SEPARATION`.
 *
 * A distância é euclidiana em OKLab ×100 ("ΔE"): ~100 separa preto de branco,
 * 8 é o alvo para duas séries se distinguirem só pela cor, 6 é o piso abaixo do
 * qual um segundo canal (traço, símbolo, padrão) deixa de ser opcional.
 */

const cinza = Oklch.parse("oklch(0.6 0 0)");
const vermelho = Oklch.parse("oklch(0.58 0.2 25)");
const verde = Oklch.parse("oklch(0.58 0.2 145)");
const azul = Oklch.parse("oklch(0.58 0.2 265)");

describe("distância perceptual", () => {
  it("é zero entre a cor e ela mesma", () => {
    expect(perceptualDistance(vermelho, vermelho)).toBeCloseTo(0);
  });

  it("é simétrica", () => {
    expect(perceptualDistance(vermelho, verde)).toBeCloseTo(perceptualDistance(verde, vermelho));
  });

  /** Referência de escala: os extremos do eixo de luminosidade ficam perto de 100. */
  it("põe preto e branco perto de 100", () => {
    const distancia = perceptualDistance(Oklch.parse("oklch(0 0 0)"), Oklch.parse("oklch(1 0 0)"));
    expect(distancia).toBeGreaterThan(95);
    expect(distancia).toBeLessThanOrEqual(100);
  });
});

describe("simulação de dicromacia", () => {
  /** Cinza não tem matiz a perder: a simulação precisa devolvê-lo praticamente intacto. */
  it("deixa o acromático quase intacto", () => {
    for (const deficiency of DICHROMACIES) {
      expect(
        perceptualDistance(cinza, simulateColorVision(cinza, deficiency)),
        deficiency,
      ).toBeLessThan(3);
    }
  });

  /** O eixo vermelho–verde é exatamente o que protanopia e deuteranopia colapsam. */
  it("colapsa vermelho contra verde", () => {
    const normal = perceptualDistance(vermelho, verde);
    expect(normal).toBeGreaterThan(SEPARATION.distinguishable);

    for (const deficiency of DICHROMACIES) {
      expect(separationUnder(vermelho, verde, deficiency), deficiency).toBeLessThan(normal / 2);
    }
  });

  /** E preserva o eixo azul–amarelo, que é por onde a dicromacia vermelho-verde ainda enxerga. */
  it("preserva vermelho contra azul melhor do que vermelho contra verde", () => {
    for (const deficiency of DICHROMACIES) {
      expect(separationUnder(vermelho, azul, deficiency), deficiency).toBeGreaterThan(
        separationUnder(vermelho, verde, deficiency),
      );
    }
  });

  it("reporta a pior das duas condições, com o nome de quem falhou", () => {
    const pior = worstSeparation(vermelho, verde);
    expect(DICHROMACIES).toContain(pior.deficiency);
    expect(pior.distance).toBeLessThanOrEqual(separationUnder(vermelho, verde, "protanopia"));
    expect(pior.distance).toBeLessThanOrEqual(separationUnder(vermelho, verde, "deuteranopia"));
  });

  it("o veredito de cor-sozinha segue o limiar declarado", () => {
    expect(areDistinguishableByColorAlone(vermelho, verde)).toBe(false);
    expect(areDistinguishableByColorAlone(cinza, Oklch.parse("oklch(0.2 0 0)"))).toBe(true);
  });
});
