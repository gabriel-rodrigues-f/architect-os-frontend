import type { CycleCadence } from "./operational-settings";

interface PeriodSpec {
  readonly key: string;
  readonly start: string;
  readonly end: string;
}

const PERIODS: Record<CycleCadence, readonly PeriodSpec[]> = {
  SEMIANNUAL: [
    { key: "H1", start: "01-01", end: "06-30" },
    { key: "H2", start: "07-01", end: "12-31" },
  ],
  QUARTERLY: [
    { key: "Q1", start: "01-01", end: "03-31" },
    { key: "Q2", start: "04-01", end: "06-30" },
    { key: "Q3", start: "07-01", end: "09-30" },
    { key: "Q4", start: "10-01", end: "12-31" },
  ],
  ANNUAL: [{ key: "Y", start: "01-01", end: "12-31" }],
};

interface CyclePeriod {
  year: number;
  period: string;
}

export class CycleCadenceScheme {
  private static readonly instances = new Map<CycleCadence, CycleCadenceScheme>();

  private constructor(
    readonly cadence: CycleCadence,
    private readonly specs: readonly PeriodSpec[],
  ) {}

  static of(cadence: CycleCadence): CycleCadenceScheme {
    let scheme = CycleCadenceScheme.instances.get(cadence);
    if (!scheme) {
      scheme = new CycleCadenceScheme(cadence, PERIODS[cadence]);
      CycleCadenceScheme.instances.set(cadence, scheme);
    }
    return scheme;
  }

  get periods(): readonly string[] {
    return this.specs.map((spec) => spec.key);
  }

  get singlePeriod(): boolean {
    return this.specs.length === 1;
  }

  cycleName(year: number, period: string): string {
    return this.singlePeriod ? String(year) : `${year} ${period}`;
  }

  cycleId(year: number, period: string): string {
    return this.singlePeriod ? String(year) : `${year}-${period.toLowerCase()}`;
  }

  datesFor(year: number, period: string): { start: string; end: string } {
    const spec = this.specs.find((s) => s.key === period) ?? this.specs[0]!;
    return { start: `${year}-${spec.start}`, end: `${year}-${spec.end}` };
  }

  parseCycleName(name: string): CyclePeriod {
    const pattern = this.singlePeriod
      ? /^(\d{4})$/
      : new RegExp(`^(\\d{4}) (${this.specs.map((s) => s.key).join("|")})$`);
    const match = pattern.exec(name);
    if (match) return { year: Number(match[1]), period: match[2] ?? this.specs[0]!.key };
    return { year: new Date().getFullYear(), period: this.specs[0]!.key };
  }

  nextAvailable(existing: readonly { id: string }[]): CyclePeriod {
    const used = new Set(existing.map((c) => c.id));
    let year = new Date().getFullYear();
    let index = 0;
    while (used.has(this.cycleId(year, this.specs[index]!.key))) {
      index += 1;
      if (index === this.specs.length) {
        index = 0;
        year += 1;
      }
    }
    return { year, period: this.specs[index]!.key };
  }
}
