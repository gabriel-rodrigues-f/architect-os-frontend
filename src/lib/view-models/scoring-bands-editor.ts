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

  payload(): ScoringBand[] | null {
    const values = this.parsedCuts();
    if (values === null || !this.isValid) return null;
    return this.bands.map((band, i) => ({
      ...band,
      minValue: i === 0 ? band.minValue : values[i - 1]!,
      maxValue: i === this.bands.length - 1 ? band.maxValue : values[i]!,
    }));
  }

  previewBands(): readonly ScoringBand[] {
    return this.payload() ?? this.bands;
  }
}
