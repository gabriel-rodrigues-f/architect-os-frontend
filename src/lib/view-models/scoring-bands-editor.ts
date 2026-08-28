import type { ScoringBand, ScoringScale } from "../scoring-bands";

export class ScoringBandsEditor {
  private constructor(
    readonly scale: ScoringScale,

    readonly bands: readonly ScoringBand[],

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

  get errorKey(): "config.bands.error.number" | "config.bands.error.order" | null {
    const values = this.parsedCuts();
    if (values === null) return "config.bands.error.number";
    let previous: number | undefined;
    for (const value of values) {
      if (previous !== undefined && value <= previous) return "config.bands.error.order";
      previous = value;
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

  payload(): ScoringBand[] | null {
    const values = this.parsedCuts();
    if (values === null || !this.isValid) return null;
    const lastIndex = this.bands.length - 1;
    const bands: ScoringBand[] = [];
    for (const [i, band] of this.bands.entries()) {
      const minValue = i === 0 ? band.minValue : values[i - 1];
      const maxValue = i === lastIndex ? band.maxValue : values[i];
      if (minValue === undefined || maxValue === undefined) return null;
      bands.push({ ...band, minValue, maxValue });
    }
    return bands;
  }

  previewBands(): readonly ScoringBand[] {
    return this.payload() ?? this.bands;
  }
}
