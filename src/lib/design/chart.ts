export const SERIES_COUNT = 6;

export type SeriesSymbol = "circle" | "square" | "triangle" | "diamond" | "cross" | "star" | "wye";

export interface SeriesStyle {
  readonly color: string;

  readonly dash?: string;

  readonly symbol: SeriesSymbol;
}

export class ChartPalette {
  private readonly assigned = new Map<string, number>();

  at(index: number): SeriesStyle {
    const slot = index % SERIES_COUNT;
    const volta = Math.floor(index / SERIES_COUNT);
    const traco = DASHES[(slot + volta) % DASHES.length];
    return {
      color: `var(--chart-${String(slot + 1)})`,
      symbol: SYMBOLS[(slot + volta) % SYMBOLS.length]!,
      ...(traco ? { dash: traco } : {}),
    };
  }

  forKey(key: string): SeriesStyle {
    let index = this.assigned.get(key);
    if (index === undefined) {
      index = this.assigned.size;
      this.assigned.set(key, index);
    }
    return this.at(index);
  }

  forKeys(keys: readonly string[]): SeriesStyle[] {
    return keys.map((k) => this.forKey(k));
  }
}

const DASHES = [undefined, "6 3", "2 3", "8 3 2 3", "1 4", "12 4 2 4"] as const;

const SYMBOLS: readonly SeriesSymbol[] = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "cross",
  "star",
  "wye",
];

export const CHART_INK = {
  reference: "var(--chart-reference)",

  grid: "var(--color-border)",

  axis: "var(--color-muted-foreground)",

  surface: "var(--chart-surface)",

  surfaceText: "var(--color-foreground)",
} as const;

export const tooltipStyle = {
  background: CHART_INK.surface,
  color: CHART_INK.surfaceText,
  border: `1px solid ${CHART_INK.grid}`,
  borderRadius: "var(--radius-md)",
  boxShadow: "0 4px 12px oklch(0 0 0 / 0.12)",
  fontSize: "var(--text-label)",
  padding: "var(--space-2) var(--space-3)",
} as const;

export const axisTick = { fontSize: 11, fill: CHART_INK.axis } as const;
