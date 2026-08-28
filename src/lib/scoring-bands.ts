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

export const withDefaultScoringBands = (
  loaded?: Partial<Record<ScoringScale, readonly ScoringBand[] | undefined>>,
): ScoringBands => {
  const pick = (scale: ScoringScale): readonly ScoringBand[] => {
    const bands = loaded?.[scale];
    return bands !== undefined && bands.length > 0 ? bands : DEFAULT_SCORING_BANDS[scale];
  };
  return {
    GAP_SEVERITY: pick("GAP_SEVERITY"),
    PROFICIENCY: pick("PROFICIENCY"),
    CONCENTRATION_RISK: pick("CONCENTRATION_RISK"),
  };
};

const bySortOrder = (bands: readonly ScoringBand[]): ScoringBand[] =>
  [...bands].sort((a, b) => a.sortOrder - b.sortOrder);

const clampedAt = <T>(items: readonly [T, ...T[]], index: number): T =>
  items[Math.min(Math.max(index, 0), items.length - 1)] ?? items[0];

export const classifyBand = (bands: readonly ScoringBand[], value: number): ScoringBand => {
  const sorted = bySortOrder(bands);
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
};

export const messageKeyOrDefault = (labelKey: string, fallback: MessageKey): MessageKey =>
  labelKey in baseMessages ? (labelKey as MessageKey) : fallback;

export interface GapSeverityRuler {
  severityOf: (gap: number) => BandTone;
  messageKey: Record<BandTone, MessageKey>;

  criticalThreshold: number;
}

const DEFAULT_GAP_MESSAGE_KEY: Record<BandTone, MessageKey> = {
  ok: "gap.ok",
  low: "gap.recommended",
  high: "gap.highPriority",
  critical: "gap.critical",
};

export const gapSeverityRulerFrom = (bands: readonly ScoringBand[]): GapSeverityRuler => {
  const messageKey = { ...DEFAULT_GAP_MESSAGE_KEY };
  for (const band of bySortOrder(bands)) {
    messageKey[band.tone] = messageKeyOrDefault(band.labelKey, DEFAULT_GAP_MESSAGE_KEY[band.tone]);
  }
  const critical = bands.find((band) => band.tone === "critical");
  return {
    severityOf: (gap) => classifyBand(bands, gap).tone,
    messageKey,
    criticalThreshold: critical?.minValue ?? 3,
  };
};

export const defaultGapSeverityRuler: GapSeverityRuler = gapSeverityRulerFrom(
  DEFAULT_SCORING_BANDS.GAP_SEVERITY,
);

export interface ProficiencyViewBand {
  key: string;
  labelKey: MessageKey;
  tone: string;
  min: number;
  max: number;
}

const PROFICIENCY_BAND_TONES = [
  "bg-level-1/60",
  "bg-level-3/60",
  "bg-level-4/60",
  "bg-level-5/60",
] as const;

export const proficiencyViewBandsFrom = (bands: readonly ScoringBand[]): ProficiencyViewBand[] => {
  const defaults = DEFAULT_SCORING_BANDS.PROFICIENCY;
  return bySortOrder(bands).map((band, i) => {
    const positionFallback = clampedAt(defaults, i).labelKey;
    return {
      key: band.key,
      labelKey: messageKeyOrDefault(band.labelKey, positionFallback),
      tone: clampedAt(PROFICIENCY_BAND_TONES, i),
      min: band.minValue ?? -Infinity,
      max: band.maxValue ?? Infinity,
    };
  });
};

export const concentrationRiskMaxReferencesFrom = (bands: readonly ScoringBand[]): number =>
  bands.find((band) => band.tone === "critical")?.maxValue ?? 2;
