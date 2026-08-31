import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCORING_BANDS,
  defaultGapSeverityRuler,
  ScoringBandSet,
  ScoringRuler,
  type ScoringBand,
} from "@/lib/scoring-bands";

/**
 * CFG-02 — os derivadores das réguas: com bands "fake" a régua MUDA (o
 * ponto da fatia — recalibrar sem deploy), e sem bands carregados o
 * fallback reproduz byte a byte o comportamento hardcoded antigo.
 */

const band = (overrides: Partial<ScoringBand>): ScoringBand => ({
  key: "x",
  minValue: null,
  maxValue: null,
  labelKey: "gap.ok",
  tone: "ok",
  sortOrder: 1,
  ...overrides,
});

describe("ScoringRuler.fromLoaded (fallback)", () => {
  it("sem resposta nenhuma, devolve o default inteiro (o seed)", () => {
    expect(ScoringRuler.fromLoaded(undefined).scales).toEqual(DEFAULT_SCORING_BANDS);
    expect(ScoringRuler.fromLoaded({}).scales).toEqual(DEFAULT_SCORING_BANDS);
  });

  it("completa POR ESCALA — a escala carregada entra, as ausentes caem no default", () => {
    const custom = [
      band({ key: "baixo", maxValue: 2, tone: "ok", sortOrder: 1 }),
      band({ key: "alto", minValue: 2, tone: "critical", labelKey: "gap.critical", sortOrder: 2 }),
    ];
    const merged = ScoringRuler.fromLoaded({ GAP_SEVERITY: custom }).scales;
    expect(merged.GAP_SEVERITY).toEqual(custom);
    expect(merged.PROFICIENCY).toEqual(DEFAULT_SCORING_BANDS.PROFICIENCY);
    expect(merged.CONCENTRATION_RISK).toEqual(DEFAULT_SCORING_BANDS.CONCENTRATION_RISK);
  });

  it("escala vazia é tratada como ausente — uma régua sem faixa não classifica nada", () => {
    expect(ScoringRuler.fromLoaded({ GAP_SEVERITY: [] }).scales.GAP_SEVERITY).toEqual(
      DEFAULT_SCORING_BANDS.GAP_SEVERITY,
    );
  });
});

describe("ScoringBandSet.classify", () => {
  it("faixas meia-abertas min <= v < max, com null = ±infinito", () => {
    const bands = DEFAULT_SCORING_BANDS.PROFICIENCY;
    expect(ScoringBandSet.of(bands).classify(1).key).toBe("developing");
    expect(ScoringBandSet.of(bands).classify(2.5).key).toBe("practitioners"); // fronteira pertence à faixa de cima
    expect(ScoringBandSet.of(bands).classify(3.49).key).toBe("practitioners");
    expect(ScoringBandSet.of(bands).classify(4.5).key).toBe("experts");
    expect(ScoringBandSet.of(bands).classify(99).key).toBe("experts");
  });
});

describe("ScoringBandSet.gapSeverityRuler", () => {
  it("default reproduz a régua antiga (gap<=0 ok, 1 low, 2 high, 3+ critical) e o limiar 3", () => {
    const ruler = defaultGapSeverityRuler;
    expect(ruler.severityOf(-1)).toBe("ok");
    expect(ruler.severityOf(0)).toBe("ok");
    expect(ruler.severityOf(1)).toBe("low");
    expect(ruler.severityOf(2)).toBe("high");
    expect(ruler.severityOf(3)).toBe("critical");
    expect(ruler.severityOf(5)).toBe("critical");
    expect(ruler.criticalThreshold).toBe(3);
    expect(ruler.messageKey).toEqual({
      ok: "gap.ok",
      low: "gap.recommended",
      high: "gap.highPriority",
      critical: "gap.critical",
    });
  });

  it('bands fake mudam a régua — "gap 2 já é crítico no nosso time" (o caso do spec)', () => {
    const ruler = ScoringBandSet.of([
      band({ key: "adequate", maxValue: 1, tone: "ok", labelKey: "gap.ok", sortOrder: 1 }),
      band({
        key: "recommended",
        minValue: 1,
        maxValue: 2,
        tone: "low",
        labelKey: "gap.recommended",
        sortOrder: 2,
      }),
      band({
        key: "critical",
        minValue: 2,
        maxValue: null,
        tone: "critical",
        labelKey: "gap.critical",
        sortOrder: 3,
      }),
    ]).gapSeverityRuler;
    expect(ruler.severityOf(2)).toBe("critical"); // era "high" no default
    expect(ruler.criticalThreshold).toBe(2); // o painel passa a contar gap >= 2
    expect(ruler.messageKey.critical).toBe("gap.critical");
  });

  it("labelKey desconhecida deste build cai no rótulo default do tom — nunca chave crua na tela", () => {
    const ruler = ScoringBandSet.of([
      band({ key: "ok", maxValue: 3, tone: "ok", labelKey: "gap.chave.inventada", sortOrder: 1 }),
      band({
        key: "critical",
        minValue: 3,
        tone: "critical",
        labelKey: "gap.critical",
        sortOrder: 2,
      }),
    ]).gapSeverityRuler;
    expect(ruler.messageKey.ok).toBe("gap.ok");
    expect(ScoringBandSet.messageKeyOr("gap.critical", "gap.ok")).toBe("gap.critical");
    expect(ScoringBandSet.messageKeyOr("nao.existe", "gap.ok")).toBe("gap.ok");
  });
});

describe("ScoringBandSet.proficiencyViewBands", () => {
  it("default reproduz o BANDS antigo: cortes 2.5/3.5/4.5, ±Infinity nas pontas e as MESMAS classes CSS", () => {
    expect(ScoringBandSet.of(DEFAULT_SCORING_BANDS.PROFICIENCY).proficiencyViewBands).toEqual([
      {
        key: "developing",
        labelKey: "cap.band.developing",
        tone: "bg-level-1/60",
        min: -Infinity,
        max: 2.5,
      },
      {
        key: "practitioners",
        labelKey: "cap.band.practitioners",
        tone: "bg-level-3/60",
        min: 2.5,
        max: 3.5,
      },
      { key: "advanced", labelKey: "cap.band.advanced", tone: "bg-level-4/60", min: 3.5, max: 4.5 },
      {
        key: "experts",
        labelKey: "cap.band.experts",
        tone: "bg-level-5/60",
        min: 4.5,
        max: Infinity,
      },
    ]);
  });

  it("bands fake mudam os cortes das faixas da tela de Cobertura", () => {
    const view = ScoringBandSet.of([
      band({
        key: "novatos",
        maxValue: 3,
        tone: "low",
        labelKey: "cap.band.developing",
        sortOrder: 1,
      }),
      band({
        key: "veteranos",
        minValue: 3,
        tone: "ok",
        labelKey: "cap.band.experts",
        sortOrder: 2,
      }),
    ]).proficiencyViewBands;
    expect(view.map((b) => [b.key, b.min, b.max])).toEqual([
      ["novatos", -Infinity, 3],
      ["veteranos", 3, Infinity],
    ]);
  });
});

describe("ScoringBandSet.concentrationRiskMaxReferences", () => {
  it("default = 2 (o antigo referenceCount === 1)", () => {
    expect(
      ScoringBandSet.of(DEFAULT_SCORING_BANDS.CONCENTRATION_RISK).concentrationRiskMaxReferences,
    ).toBe(2);
  });

  it('bands fake sobem o limiar — "time de 40 pode querer <= 2 referências" (o caso do spec)', () => {
    expect(
      ScoringBandSet.of([
        band({
          key: "concentrationRisk",
          maxValue: 3,
          tone: "critical",
          labelKey: "cap.risk.badge.concentrationRisk",
          sortOrder: 1,
        }),
        band({
          key: "distributedCoverage",
          minValue: 3,
          tone: "ok",
          labelKey: "cap.risk.badge.distributedCoverage",
          sortOrder: 2,
        }),
      ]).concentrationRiskMaxReferences,
    ).toBe(3);
  });
});
