import { describe, expect, it } from "vitest";

import { DEFAULT_SCORING_BANDS } from "@/lib/scoring-bands";
import { ScoringBandsEditor } from "@/lib/view-models";

/**
 * CFG-02 (admin UI) — o ViewModel do editor de réguas: o admin edita só os
 * CORTES internos; o payload reconstrói as faixas com `max` da faixa `i` ==
 * `min` da faixa `i+1` (contiguidade por construção) e as pontas em `null`.
 */
describe("ScoringBandsEditor (CFG-02 admin UI)", () => {
  const gap = DEFAULT_SCORING_BANDS.GAP_SEVERITY;

  it("nasce com os cortes internos da régua (1, 2, 3 no seed de GAP_SEVERITY)", () => {
    const editor = ScoringBandsEditor.from("GAP_SEVERITY", gap);
    expect(editor.cuts).toEqual(["1", "2", "3"]);
    expect(editor.isValid).toBe(true);
    expect(editor.isDirty).toBe(false);
  });

  it("payload aplica o corte nas DUAS faixas vizinhas e preserva as pontas null", () => {
    const editor = ScoringBandsEditor.from("GAP_SEVERITY", gap).withCut(2, "2.5");
    expect(editor.isDirty).toBe(true);
    const payload = editor.payload();
    expect(payload).not.toBeNull();
    const high = payload!.find((b) => b.key === "high")!;
    const critical = payload!.find((b) => b.key === "critical")!;
    expect(high.maxValue).toBe(2.5);
    expect(critical.minValue).toBe(2.5);
    expect(payload![0]!.minValue).toBeNull();
    expect(payload![payload!.length - 1]!.maxValue).toBeNull();
  });

  it("corte vazio ou não-numérico invalida com a chave de erro numérica", () => {
    const editor = ScoringBandsEditor.from("GAP_SEVERITY", gap).withCut(1, "abc");
    expect(editor.errorKey).toBe("config.bands.error.number");
    expect(editor.payload()).toBeNull();
  });

  it("cortes fora de ordem (não estritamente crescentes) invalidam com a chave de ordem", () => {
    const editor = ScoringBandsEditor.from("GAP_SEVERITY", gap).withCut(0, "2");
    expect(editor.errorKey).toBe("config.bands.error.order");
    expect(editor.payload()).toBeNull();
  });

  it("previewBands usa o rascunho quando válido e cai nas originais quando inválido", () => {
    const valid = ScoringBandsEditor.from("GAP_SEVERITY", gap).withCut(2, "2.5");
    expect(valid.previewBands().find((b) => b.key === "critical")!.minValue).toBe(2.5);

    const invalid = valid.withCut(0, "");
    expect(invalid.previewBands().find((b) => b.key === "critical")!.minValue).toBe(3);
  });

  it("escala de 2 faixas (CONCENTRATION_RISK) tem um único corte", () => {
    const editor = ScoringBandsEditor.from(
      "CONCENTRATION_RISK",
      DEFAULT_SCORING_BANDS.CONCENTRATION_RISK,
    );
    expect(editor.cuts).toEqual(["2"]);
    const payload = editor.withCut(0, "3").payload()!;
    expect(payload[0]!.maxValue).toBe(3);
    expect(payload[1]!.minValue).toBe(3);
  });
});
