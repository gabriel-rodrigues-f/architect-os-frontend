import type { MessageKey } from "./i18n";
import type { BandTone, GapSeverityRuler } from "./scoring-bands";
import type { Gap } from "./selectors";

/**
 * A PRONTIDÃO DE UMA PESSOA, na linha dela.
 *
 * Dono (2026-09-09, com referência visual): *"Gostei também da coluna
 * 'Prontidão / Distância', que possui uma régua que muda de cor dentro da
 * linha de cada profissional."*
 *
 * A leitura tem DUAS partes, e cada uma responde a uma pergunta diferente:
 *
 *   COMPRIMENTO  quanto da pessoa já está no alvo — as competências avaliadas
 *                cuja distância cai na faixa adequada, sobre as avaliadas. É
 *                proporção com denominador à vista, e não contagem solta: a
 *                análise do Painel (`painel-executivo-analise-2026-09-09.md`,
 *                A.3 item 3) mediu o preço de esconder o denominador.
 *   COR          a severidade da MAIOR distância — a mesma faixa que o selo
 *                "Distância N · Crítico" ao lado já nomeia. A cor e o rótulo
 *                nunca discordam porque saem da mesma leitura.
 *
 * NENHUM CORTE NOVO. As faixas são as de `GAP_SEVERITY` — adequada, recomendada,
 * alta e crítica —, servidas pelo backend (`config/bands`) e com o padrão em
 * `scoring-bands.ts`. Esta classe agrupa, não corta: "Em atenção" é a união das
 * faixas recomendada e alta. Ela nasceu de falta de espaço na linha de chips e
 * SOBREVIVE por decisão do dono (2026-09-10): quando os cinco estados passaram
 * a caber numa lista, ele nomeou estes cinco — "Todos, Prontos, Em atenção,
 * Críticos, Não avaliados" —, e não seis.
 *
 * AUSÊNCIA NÃO É ZERO (radar `cc3b07b`, cartão de distância): quem não tem
 * avaliação concluída no ciclo — ou tem uma sem nenhum item pontuado — é
 * `unknown`, e a régua dele fica vazia, nunca cheia de verde.
 */
export const READINESS_BUCKETS = ["ready", "attention", "critical", "unknown"] as const;

export type ReadinessBucket = (typeof READINESS_BUCKETS)[number];

const BUCKET_BY_TONE: Record<BandTone, ReadinessBucket> = {
  ok: "ready",
  low: "attention",
  high: "attention",
  critical: "critical",
};

/**
 * O rótulo de cada estado no FILTRO de prontidão, no plural que o dono
 * escreveu (2026-09-10): *"Todos, Prontos, Em atenção, Críticos, Não
 * avaliados"*. Eram chips, um botão por estado; viraram opções de uma lista
 * só — o que muda é onde o rótulo aparece, não o que ele nomeia.
 */
export const READINESS_OPTION_KEY: Record<ReadinessBucket, MessageKey> = {
  ready: "team.readiness.option.ready",
  attention: "team.readiness.option.attention",
  critical: "team.readiness.option.critical",
  unknown: "team.readiness.option.unknown",
};

/** A primeira opção da lista: o time inteiro do recorte, sem corte de prontidão. */
export const READINESS_ALL_OPTION_KEY: MessageKey = "team.readiness.option.all";

/** O valor da opção "Todos" — a ausência de corte, num seletor de uma escolha. */
export const READINESS_ALL = "all";

export class ReadinessReading {
  private constructor(
    readonly bucket: ReadinessBucket,
    /** A faixa da maior distância — `null` quando não há medida. */
    readonly tone: BandTone | null,
    /** A maior distância medida — `null` quando não há medida. */
    readonly worstGap: number | null,
    /** Competências avaliadas já na faixa adequada. */
    readonly onTarget: number,
    /** Competências avaliadas — o denominador da régua. */
    readonly measured: number,
  ) {}

  static readonly UNKNOWN = new ReadinessReading("unknown", null, null, 0, 0);

  static of(
    gaps: readonly Gap[],
    hasOfficialAssessment: boolean,
    ruler: GapSeverityRuler,
  ): ReadinessReading {
    if (!hasOfficialAssessment || gaps.length === 0) return ReadinessReading.UNKNOWN;
    const worst = gaps.reduce((maior, atual) => Math.max(maior, atual.gap), gaps[0]?.gap ?? 0);
    const tone = ruler.severityOf(worst);
    const onTarget = gaps.filter((gap) => ruler.severityOf(gap.gap) === "ok").length;
    return new ReadinessReading(
      BUCKET_BY_TONE[tone],
      tone,
      Math.max(0, worst),
      onTarget,
      gaps.length,
    );
  }

  /** A fração no alvo, de 0 a 100 — `null` quando não há o que medir. */
  get percentageOnTarget(): number | null {
    return this.measured === 0 ? null : (this.onTarget / this.measured) * 100;
  }
}
