export class Scale<Step extends string> {
  constructor(
    readonly prefix: string,
    private readonly steps: Readonly<Record<Step, number>>,

    private readonly unit: "px" | "rem" | "" = "px",

    readonly utilityNamespace?: string,
  ) {}

  get(step: Step): number {
    return this.steps[step];
  }

  toCssLines(): string[] {
    return Object.entries(this.steps).map(
      ([step, valor]) => `  --${this.prefix}-${step}: ${String(valor)}${this.unit};`,
    );
  }

  toThemeLines(): string[] {
    const namespace = this.utilityNamespace;
    if (!namespace) return [];
    return Object.keys(this.steps).map(
      (step) => `  --${namespace}-${step}: var(--${this.prefix}-${step});`,
    );
  }

  entries(): [Step, number][] {
    return Object.entries(this.steps) as [Step, number][];
  }

  isMonotonic(): boolean {
    const valores = Object.values(this.steps) as number[];
    return valores.every((v, i) => i === 0 || v > (valores[i - 1] as number));
  }
}

export const radius = new Scale("radius", {
  xs: 3,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
});

export const spacing = new Scale(
  "space",
  {
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "6": 24,
    "8": 32,
    "12": 48,
    "16": 64,
  },
  "px",
  "spacing",
);

export const fontSize = new Scale(
  "text",
  {
    meta: 11,
    label: 12,
    table: 13,
    body: 14,
    subtitle: 15,
    section: 18,
    page: 28,
    kpi: 32,
  },
  "px",
  "text",
);

export const fontWeight = new Scale(
  "weight",
  {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
  "",
);

export const SCALES = [radius, spacing, fontSize, fontWeight] as const;
