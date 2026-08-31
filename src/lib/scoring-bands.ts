import { UserFacingError } from "./api-errors";
import { baseMessages, type MessageKey } from "./i18n/registry";

export const SCORING_SCALES = ["GAP_SEVERITY", "PROFICIENCY", "CONCENTRATION_RISK"] as const;
export type ScoringScale = (typeof SCORING_SCALES)[number];

const BAND_TONES = ["ok", "low", "high", "critical"] as const;
export type BandTone = (typeof BAND_TONES)[number];

export interface ScoringBand {
  key: string;
  minValue: number | null;
  maxValue: number | null;
  labelKey: string;
  tone: BandTone;
  sortOrder: number;
}

export type ScoringBands = Record<ScoringScale, readonly ScoringBand[]>;

export type ServedScoringBands = Partial<Record<ScoringScale, readonly ScoringBand[] | undefined>>;

type DefaultScoringBand = ScoringBand & { labelKey: MessageKey };

export const DEFAULT_SCORING_BANDS: Record<
  ScoringScale,
  readonly [DefaultScoringBand, ...DefaultScoringBand[]]
> = {
  GAP_SEVERITY: [
    { key: "adequate", minValue: null, maxValue: 1, labelKey: "gap.ok", tone: "ok", sortOrder: 1 },
    {
      key: "recommended",
      minValue: 1,
      maxValue: 2,
      labelKey: "gap.recommended",
      tone: "low",
      sortOrder: 2,
    },
    {
      key: "high",
      minValue: 2,
      maxValue: 3,
      labelKey: "gap.highPriority",
      tone: "high",
      sortOrder: 3,
    },
    {
      key: "critical",
      minValue: 3,
      maxValue: null,
      labelKey: "gap.critical",
      tone: "critical",
      sortOrder: 4,
    },
  ],
  PROFICIENCY: [
    {
      key: "developing",
      minValue: null,
      maxValue: 2.5,
      labelKey: "cap.band.developing",
      tone: "low",
      sortOrder: 1,
    },
    {
      key: "practitioners",
      minValue: 2.5,
      maxValue: 3.5,
      labelKey: "cap.band.practitioners",
      tone: "ok",
      sortOrder: 2,
    },
    {
      key: "advanced",
      minValue: 3.5,
      maxValue: 4.5,
      labelKey: "cap.band.advanced",
      tone: "ok",
      sortOrder: 3,
    },
    {
      key: "experts",
      minValue: 4.5,
      maxValue: null,
      labelKey: "cap.band.experts",
      tone: "ok",
      sortOrder: 4,
    },
  ],
  CONCENTRATION_RISK: [
    {
      key: "concentrationRisk",
      minValue: null,
      maxValue: 2,
      labelKey: "cap.risk.badge.concentrationRisk",
      tone: "critical",
      sortOrder: 1,
    },
    {
      key: "distributedCoverage",
      minValue: 2,
      maxValue: null,
      labelKey: "cap.risk.badge.distributedCoverage",
      tone: "ok",
      sortOrder: 2,
    },
  ],
};

const DEFAULT_GAP_MESSAGE_KEY: Record<BandTone, MessageKey> = {
  ok: "gap.ok",
  low: "gap.recommended",
  high: "gap.highPriority",
  critical: "gap.critical",
};

const PROFICIENCY_BAND_TONES = [
  "bg-level-1/60",
  "bg-level-3/60",
  "bg-level-4/60",
  "bg-level-5/60",
] as const;

const DEFAULT_CRITICAL_GAP_THRESHOLD = 3;

const DEFAULT_CONCENTRATION_RISK_MAX_REFERENCES = 2;

export interface ProficiencyViewBand {
  key: string;
  labelKey: MessageKey;
  tone: string;
  min: number;
  max: number;
}

export class ScoringBandSet {
  private constructor(readonly bands: readonly ScoringBand[]) {}

  static of(bands: readonly ScoringBand[]): ScoringBandSet {
    return new ScoringBandSet(bands);
  }

  static messageKeyOr(labelKey: string, fallback: MessageKey): MessageKey {
    return labelKey in baseMessages ? (labelKey as MessageKey) : fallback;
  }

  private static clampedAt<T>(items: readonly [T, ...T[]], index: number): T {
    return items[Math.min(Math.max(index, 0), items.length - 1)] ?? items[0];
  }

  get inSortOrder(): ScoringBand[] {
    return [...this.bands].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  classify(value: number): ScoringBand {
    const sorted = this.inSortOrder;
    const widest = sorted[sorted.length - 1];
    if (!widest)
      throw new UserFacingError("Nenhuma faixa de pontuação configurada para classificar.");
    return (
      sorted.find(
        (band) =>
          (band.minValue === null || value >= band.minValue) &&
          (band.maxValue === null || value < band.maxValue),
      ) ?? widest
    );
  }

  get gapSeverityRuler(): GapSeverityRuler {
    return GapSeverityRuler.over(this);
  }

  get proficiencyViewBands(): ProficiencyViewBand[] {
    const defaults = DEFAULT_SCORING_BANDS.PROFICIENCY;
    return this.inSortOrder.map((band, position) => ({
      key: band.key,
      labelKey: ScoringBandSet.messageKeyOr(
        band.labelKey,
        ScoringBandSet.clampedAt(defaults, position).labelKey,
      ),
      tone: ScoringBandSet.clampedAt(PROFICIENCY_BAND_TONES, position),
      min: band.minValue ?? -Infinity,
      max: band.maxValue ?? Infinity,
    }));
  }

  get concentrationRiskMaxReferences(): number {
    return (
      this.bands.find((band) => band.tone === "critical")?.maxValue ??
      DEFAULT_CONCENTRATION_RISK_MAX_REFERENCES
    );
  }

  get criticalThreshold(): number {
    return (
      this.bands.find((band) => band.tone === "critical")?.minValue ??
      DEFAULT_CRITICAL_GAP_THRESHOLD
    );
  }

  get messageKeyByTone(): Record<BandTone, MessageKey> {
    const byTone = { ...DEFAULT_GAP_MESSAGE_KEY };
    for (const band of this.inSortOrder) {
      byTone[band.tone] = ScoringBandSet.messageKeyOr(
        band.labelKey,
        DEFAULT_GAP_MESSAGE_KEY[band.tone],
      );
    }
    return byTone;
  }
}

export class GapSeverityRuler {
  private constructor(
    private readonly severityBands: ScoringBandSet,
    readonly messageKey: Record<BandTone, MessageKey>,
    readonly criticalThreshold: number,
  ) {}

  static over(bands: ScoringBandSet): GapSeverityRuler {
    return new GapSeverityRuler(bands, bands.messageKeyByTone, bands.criticalThreshold);
  }

  static get defaults(): GapSeverityRuler {
    return GapSeverityRuler.over(ScoringBandSet.of(DEFAULT_SCORING_BANDS.GAP_SEVERITY));
  }

  severityOf(gap: number): BandTone {
    return this.severityBands.classify(gap).tone;
  }
}

export class ScoringRuler {
  private constructor(readonly scales: ScoringBands) {}

  static fromLoaded(loaded?: ServedScoringBands): ScoringRuler {
    const served = (scale: ScoringScale): readonly ScoringBand[] => {
      const bands = loaded?.[scale];
      return bands !== undefined && bands.length > 0 ? bands : DEFAULT_SCORING_BANDS[scale];
    };
    return new ScoringRuler({
      GAP_SEVERITY: served("GAP_SEVERITY"),
      PROFICIENCY: served("PROFICIENCY"),
      CONCENTRATION_RISK: served("CONCENTRATION_RISK"),
    });
  }

  forScale(scale: ScoringScale): ScoringBandSet {
    return ScoringBandSet.of(this.scales[scale]);
  }

  get gapSeverity(): GapSeverityRuler {
    return this.forScale("GAP_SEVERITY").gapSeverityRuler;
  }
}

export const defaultGapSeverityRuler: GapSeverityRuler = GapSeverityRuler.defaults;
