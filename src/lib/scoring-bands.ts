import { baseMessages, type MessageKey } from "./i18n/registry";

/**
 * CFG-02 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.1 / B1, B2, B3) — as réguas
 * numéricas de negócio deixaram de ser literais espalhados: a autoridade é
 * a tabela `scoring_bands` do backend, servida por `GET /api/config/bands`
 * (`ConfigGateway.bands`). Este módulo é o lado do frontend dessa fatia:
 *
 * - os TIPOS espelham o domínio do backend
 *   (`backend/src/modules/config/domain/scoring-bands.ts`): faixas
 *   meia-abertas `min <= v < max`, `null` = ±infinito na ponta;
 * - `DEFAULT_SCORING_BANDS` é o ÚNICO lugar onde as constantes antigas
 *   sobrevivem, como fallback byte-idêntico ao seed da migration
 *   (`20260826000000000_scoring-bands.sql`) — enquanto a consulta não
 *   resolve (ou falha), tudo se comporta exatamente como antes, sem flash;
 * - os DERIVADORES abaixo transformam uma escala carregada na forma que
 *   cada consumidor usa: `gapSeverityRulerFrom` (GapBadge, relatório do
 *   time, limiar de "gap crítico" do painel), `proficiencyViewBandsFrom`
 *   e `concentrationRiskMaxReferencesFrom` (Cobertura de Capacidades).
 *
 * Quem quer a régua EFETIVA (servidor com fallback) usa `useScoringBands`/
 * `useGapSeverityRuler` (`store.tsx`); os exports `default*` daqui existem
 * para código não-React e para preservar o comportamento default.
 */

export const SCORING_SCALES = ["GAP_SEVERITY", "PROFICIENCY", "CONCENTRATION_RISK"] as const;
export type ScoringScale = (typeof SCORING_SCALES)[number];

/**
 * Eixo semântico ESTÁVEL de cada faixa — é dele que o código deriva
 * comportamento (cor do badge, limiar crítico), nunca de `key`/`labelKey`
 * (que um admin pode renomear sem quebrar nada). Coincide de propósito com
 * `GapSeverity` (`domain.ts`), que agora é um alias deste tipo.
 */
export const BAND_TONES = ["ok", "low", "high", "critical"] as const;
export type BandTone = (typeof BAND_TONES)[number];

/** Uma faixa de uma régua, na MESMA forma serializada por `GET /api/config/bands`. */
export interface ScoringBand {
  key: string;
  minValue: number | null;
  maxValue: number | null;
  labelKey: string;
  tone: BandTone;
  sortOrder: number;
}

export type ScoringBands = Record<ScoringScale, readonly ScoringBand[]>;

/**
 * O fallback único — espelho EXATO do seed da migration do backend (que por
 * sua vez espelha os literais que o código tinha antes da fatia). Se o seed
 * mudar lá, este arquivo muda junto; os testes de fallback denunciam
 * qualquer divergência de comportamento com a régua antiga.
 *
 * `labelKey` aqui é tipado como `MessageKey` de propósito: o default nunca
 * pode apontar para uma chave i18n inexistente (o servidor pode — ver
 * `messageKeyOrDefault`).
 */
export const DEFAULT_SCORING_BANDS: Record<
  ScoringScale,
  readonly (ScoringBand & {
    labelKey: MessageKey;
  })[]
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

/**
 * Régua efetiva = servidor onde houver, default onde não houver. Por ESCALA,
 * não tudo-ou-nada: um `PUT` que só recalibrou GAP_SEVERITY não pode fazer
 * PROFICIENCY cair no default. Escala ausente ou vazia cai no fallback —
 * uma régua sem faixa nenhuma classificaria nada.
 */
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

/**
 * A faixa que cobre `value` (`min <= value < max`, `null` = ±infinito). O
 * backend garante réguas contíguas cobrindo (-∞, +∞) (`ScoringBandScale`),
 * então sempre existe exatamente uma; a última é o fallback defensivo para
 * uma régua malformada que tenha escapado.
 */
export const classifyBand = (bands: readonly ScoringBand[], value: number): ScoringBand => {
  const sorted = bySortOrder(bands);
  const found = sorted.find(
    (band) =>
      (band.minValue === null || value >= band.minValue) &&
      (band.maxValue === null || value < band.maxValue),
  );
  return found ?? sorted[sorted.length - 1]!;
};

/**
 * `labelKey` vem do servidor como string livre — um admin pode gravar uma
 * chave que este build não conhece. `t()` só aceita `MessageKey`, então uma
 * chave desconhecida cai no rótulo default correspondente em vez de vazar
 * a chave crua para a tela.
 */
export const messageKeyOrDefault = (labelKey: string, fallback: MessageKey): MessageKey =>
  labelKey in baseMessages ? (labelKey as MessageKey) : fallback;

/**
 * A régua de severidade de gap na forma que os consumidores usam (OO3-11i):
 * o degrau (`severityOf`), a chave i18n de cada degrau (`messageKey`) e o
 * limiar de "gap crítico" do painel (`criticalThreshold`). O texto continua
 * vindo do `t()` de quem exibe.
 */
export interface GapSeverityRuler {
  severityOf: (gap: number) => BandTone;
  messageKey: Record<BandTone, MessageKey>;
  /** `min` da faixa de tom `critical` — o antigo `CRITICAL_GAP_THRESHOLD = 3` do painel. */
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

/** A régua default — o que `gapSeverityOf`/`GAP_SEVERITY_MESSAGE_KEY` (`domain.ts`) reexportam. */
export const defaultGapSeverityRuler: GapSeverityRuler = gapSeverityRulerFrom(
  DEFAULT_SCORING_BANDS.GAP_SEVERITY,
);

/**
 * Faixa de proficiência na forma que a tela de Cobertura consome (o antigo
 * `BANDS` do `CapabilityCoveragePresenter`): pontas em ±Infinity em vez de
 * `null` (a comparação `level >= min && level < max` do presenter não muda)
 * e `tone` como classe CSS — vocabulário de apresentação, que nunca vem do
 * servidor.
 */
export interface ProficiencyViewBand {
  key: string;
  labelKey: MessageKey;
  tone: string;
  min: number;
  max: number;
}

/**
 * Paleta por POSIÇÃO (da menor proficiência para a maior), não por `key` —
 * um admin pode renomear/recortar faixas, e a cor é leitura visual de
 * "quão avançado", não identidade da faixa. Com o seed default o resultado
 * é byte-idêntico ao `BANDS` antigo (level-1/3/4/5).
 */
const PROFICIENCY_BAND_TONES = [
  "bg-level-1/60",
  "bg-level-3/60",
  "bg-level-4/60",
  "bg-level-5/60",
] as const;

export const proficiencyViewBandsFrom = (bands: readonly ScoringBand[]): ProficiencyViewBand[] => {
  const defaults = DEFAULT_SCORING_BANDS.PROFICIENCY;
  return bySortOrder(bands).map((band, i) => {
    const positionFallback = defaults[Math.min(i, defaults.length - 1)]!.labelKey;
    return {
      key: band.key,
      labelKey: messageKeyOrDefault(band.labelKey, positionFallback),
      tone: PROFICIENCY_BAND_TONES[Math.min(i, PROFICIENCY_BAND_TONES.length - 1)]!,
      min: band.minValue ?? -Infinity,
      max: band.maxValue ?? Infinity,
    };
  });
};

/**
 * Limiar de concentração — "abaixo de QUANTAS referências a capacidade está
 * concentrada": o `max` da faixa de tom `critical` da escala
 * CONCENTRATION_RISK (2 no seed → `referenceCount < 2`, o antigo
 * `referenceCount === 1`; um time de 40 pode subir para 3 → `<= 2`).
 */
export const concentrationRiskMaxReferencesFrom = (bands: readonly ScoringBand[]): number =>
  bands.find((band) => band.tone === "critical")?.maxValue ?? 2;
