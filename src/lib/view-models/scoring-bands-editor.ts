import type { ScoringBand, ScoringScale } from "../scoring-bands";

/**
 * CFG-02 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.2) — ViewModel do editor de
 * UMA escala de `scoring_bands` na aba "Réguas e limiares" de /settings.
 * Segue a régua da casa (payload/validação em classe testável, render na
 * tela): a tela só liga inputs a `withCut` e botões a `payload()`.
 *
 * O que um admin edita são os CORTES (as fronteiras internas entre faixas),
 * nunca o formato da régua: as pontas continuam `null` (±infinito), as
 * faixas continuam meia-abertas `min <= v < max` e keys/tones/labels ficam
 * como estão — é calibragem, não modelagem (mesma divisão do backend, onde
 * `ScoringBandScale.create` valida contiguidade). O corte `i` é
 * simultaneamente o `maxValue` da faixa `i` e o `minValue` da faixa `i+1`,
 * então editar UM número nunca produz furo/sobreposição por construção; a
 * validação client-side que resta é numérica (corte vazio/não-número) e de
 * ordem (estritamente crescente). O 400 `INVALID_SCORING_BANDS` do backend
 * continua sendo a autoridade final.
 *
 * Imutável de propósito (cada edição devolve um editor novo) — encaixa em
 * `useState` sem `useEffect` de sincronização.
 */
export class ScoringBandsEditor {
  private constructor(
    readonly scale: ScoringScale,
    /** As faixas originais, já ordenadas por `sortOrder`. */
    readonly bands: readonly ScoringBand[],
    /** Rascunho textual de cada corte interno (índice `i` = fronteira entre a faixa `i` e a `i+1`). */
    readonly cuts: readonly string[],
  ) {}

  static from(scale: ScoringScale, bands: readonly ScoringBand[]): ScoringBandsEditor {
    const sorted = [...bands].sort((a, b) => a.sortOrder - b.sortOrder);
    const cuts = sorted.slice(0, -1).map((band) => String(band.maxValue ?? ""));
    return new ScoringBandsEditor(scale, sorted, cuts);
  }

  withCut(index: number, text: string): ScoringBandsEditor {
    const cuts = this.cuts.map((cut, i) => (i === index ? text : cut));
    return new ScoringBandsEditor(this.scale, this.bands, cuts);
  }

  private parsedCuts(): number[] | null {
    const values: number[] = [];
    for (const cut of this.cuts) {
      if (cut.trim().length === 0) return null;
      const value = Number(cut);
      if (!Number.isFinite(value)) return null;
      values.push(value);
    }
    return values;
  }

  /** Chave i18n do erro de validação client-side, ou `null` quando o rascunho é válido. */
  get errorKey(): "config.bands.error.number" | "config.bands.error.order" | null {
    const values = this.parsedCuts();
    if (values === null) return "config.bands.error.number";
    for (let i = 1; i < values.length; i += 1) {
      if (values[i]! <= values[i - 1]!) return "config.bands.error.order";
    }
    return null;
  }

  get isValid(): boolean {
    return this.errorKey === null;
  }

  get isDirty(): boolean {
    const original = this.bands.slice(0, -1).map((band) => String(band.maxValue ?? ""));
    return this.cuts.some((cut, i) => Number(cut) !== Number(original[i]));
  }

  /**
   * As faixas com os cortes do rascunho aplicados (corte `i` = `maxValue`
   * da faixa `i` E `minValue` da faixa `i+1`) — o corpo do
   * `PUT /api/config/bands/:scale`. `null` quando o rascunho é inválido.
   */
  payload(): ScoringBand[] | null {
    const values = this.parsedCuts();
    if (values === null || !this.isValid) return null;
    return this.bands.map((band, i) => ({
      ...band,
      minValue: i === 0 ? band.minValue : values[i - 1]!,
      maxValue: i === this.bands.length - 1 ? band.maxValue : values[i]!,
    }));
  }

  /** As faixas para o preview do badge: o rascunho quando válido, senão as originais. */
  previewBands(): readonly ScoringBand[] {
    return this.payload() ?? this.bands;
  }
}
