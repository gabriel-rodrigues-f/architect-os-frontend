import { useI18n, type MessageKey } from "@/lib/i18n";
import type { BandTone } from "@/lib/scoring-bands";
import { useGapSeverityRuler } from "@/lib/store";

/**
 * A explicação de cada faixa, pelo TOM — nunca pelo rótulo. O rótulo é
 * configurável (`ScoringBand.labelKey` chega do servidor); o tom é a faixa em
 * si, e é dele que a frase depende.
 */
const gapExplanation: Record<BandTone, MessageKey> = {
  ok: "gap.help.ok",
  low: "gap.help.recommended",
  high: "gap.help.highPriority",
  critical: "gap.help.critical",
};

export interface GapReading {
  tone: BandTone;
  /** A frase do selo — "Distância 1 · Recomendado". */
  badge: string;
  /** O que aquela distância significa, em texto de gente. */
  explanation: string;
}

/**
 * O QUE A DISTÂNCIA DIZ, num objeto só: o tom da faixa, a frase do selo e a
 * explicação.
 *
 * Existe porque o selo (`GapBadge`) e o "?" ao lado dele (`CompetencyGapCard`)
 * mostram a MESMA frase — o "?" a usa como título do balão. Montá-la nos dois
 * lugares seria deixar duas cópias concordarem por sorte; a régua da casa é
 * que o que serve a dois lugares nasce componente.
 */
export function useGapReading(gap: number): GapReading {
  const { t } = useI18n();
  const ruler = useGapSeverityRuler();
  const tone = ruler.severityOf(gap);
  return {
    tone,
    badge: t("gap.badge", { n: Math.max(0, gap), rotulo: t(ruler.messageKey[tone]) }),
    explanation: t(gapExplanation[tone]),
  };
}
