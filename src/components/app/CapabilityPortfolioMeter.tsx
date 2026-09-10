import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Chip, type ChipTone } from "@/components/app/Chip";
import { useI18n, type I18nApi, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * O PORTFÓLIO DO CICLO, VISTO DE UMA VEZ.
 *
 * Dono (2026-09-09, com captura): *"O menu 'Portfólio de Capacidades do
 * Ciclo' está atualmente confuso e visualmente ruim. Precisamos de mais
 * ícones e gráficos relevantes."* O levantamento dos três estados mostrou que
 * a confusão era outra em cada um:
 *
 *   VAZIO     cinco textos dizendo "você não selecionou nada" — o selo do
 *             tamanho, a barra em 0%, o selo `0/3`, a dica do mínimo e a
 *             frase do vazio;
 *   PARCIAL   dois selos de MESMA forma ("2 selecionada(s) · mínimo 3" e
 *             "1/3 qualificadas") contra o MESMO denominador, com
 *             significados diferentes, mais uma barra de 66% que pertencia só
 *             ao primeiro e não dizia isso;
 *   COMPLETO  o veredito — `eligible` do contrato — não aparecia em lugar
 *             nenhum: o selo só trocava de variante.
 *
 * A pergunta que o bloco responde é UMA: *o que conta para a minha progressão
 * neste ciclo, e quanto falta?* Daí o desenho: um número-síntese (as
 * qualificadas sobre o mínimo), UM medidor onde os dois antigos "números"
 * viram posições da mesma pista — uma vaga por capacidade do portfólio,
 * tingida pelo estágio, e uma vaga tracejada por capacidade que ainda falta
 * selecionar — e a legenda que ensina a tinta.
 *
 * O ÍCONE não é enfeite: é a MESMA marca do estágio na vaga do medidor, na
 * legenda e no selo da linha da capacidade. Quem aprende a marca uma vez lê o
 * bloco inteiro sem legenda.
 */
export type PortfolioSlot = "qualified" | "belowBar" | "pending" | "unselected";

export interface PortfolioEntry {
  readonly confirmed: boolean;
  readonly qualified: boolean;
}

/**
 * Os três estágios de uma capacidade do portfólio, na ordem em que a
 * progressão os atravessa: proposta → confirmada → qualificada. Cada um
 * carrega a própria tinta, o próprio ícone, o rótulo curto do selo e a frase
 * inteira que explica o que ele quer dizer.
 */
export class PortfolioStage {
  /** Confirmada pelo Tech Lead E atendendo à régua — é o que conta. */
  static readonly QUALIFIED = new PortfolioStage(
    "qualified",
    "success",
    CircleCheck,
    "asmt.portfolio.stage.qualified",
    "asmt.portfolio.qualified",
    "asmt.portfolio.legend.qualified",
    "asmt.portfolio.legend.qualified.one",
  );

  /** Confirmada, mas com competência abaixo do exigido — está no portfólio e não conta. */
  static readonly BELOW_BAR = new PortfolioStage(
    "belowBar",
    "warning",
    TriangleAlert,
    "asmt.portfolio.stage.belowBar",
    "asmt.portfolio.notQualified",
    "asmt.portfolio.legend.belowBar",
  );

  /** Proposta, esperando a confirmação de quem lidera. */
  static readonly PENDING = new PortfolioStage(
    "pending",
    "neutral",
    Clock,
    "asmt.portfolio.stage.pending",
    "asmt.portfolio.pendingConfirmation",
    "asmt.portfolio.legend.pending",
  );

  static readonly ALL: readonly PortfolioStage[] = [
    PortfolioStage.QUALIFIED,
    PortfolioStage.BELOW_BAR,
    PortfolioStage.PENDING,
  ];

  /** O estágio de uma entrada do portfólio — a única régua, num lugar só. */
  static of(entry: PortfolioEntry): PortfolioStage {
    if (!entry.confirmed) return PortfolioStage.PENDING;
    return entry.qualified ? PortfolioStage.QUALIFIED : PortfolioStage.BELOW_BAR;
  }

  private constructor(
    readonly slot: PortfolioSlot,
    readonly tone: ChipTone,
    readonly Icon: LucideIcon,
    /** O rótulo curto — o selo da linha e a legenda. */
    readonly labelKey: MessageKey,
    /** A frase inteira: o que o estágio quer dizer, no tooltip do selo. */
    readonly meaningKey: MessageKey,
    /** "{n} qualificadas" — a contagem da legenda, no plural. */
    readonly legendKey: MessageKey,
    /**
     * O singular, quando a concordância muda ("1 qualificada"). Só o estágio
     * qualificado precisa: "abaixo da régua" e "aguardando confirmação" não
     * flexionam. Ninguém escreve "(s)" num selo de contagem.
     */
    readonly legendKeyOne?: MessageKey,
  ) {}

  quantas(entries: readonly PortfolioEntry[]): number {
    return entries.filter((entry) => PortfolioStage.of(entry) === this).length;
  }

  /** A contagem já concordada — a tela não escolhe entre singular e plural. */
  legenda(quantas: number, t: I18nApi["t"]): string {
    const chave =
      quantas === 1 && this.legendKeyOne !== undefined ? this.legendKeyOne : this.legendKey;
    return t(chave, { n: quantas });
  }
}

/** A tinta de cada vaga do medidor — literal, nunca montada por string. */
const SLOT_CLASS: Record<PortfolioSlot, string> = {
  qualified: "bg-success text-success-fg",
  belowBar: "bg-warning text-warning-fg",
  pending: "bg-secondary text-muted-foreground",
  unselected: "border border-dashed border-border text-muted-foreground",
};

/** O selo do estágio: a marca, o rótulo curto e a frase inteira no tooltip. */
export function PortfolioStageChip({ stage }: { stage: PortfolioStage }) {
  const { t } = useI18n();
  return (
    <Chip tone={stage.tone} tooltip={t(stage.meaningKey)}>
      <stage.Icon className="size-3" aria-hidden />
      {t(stage.labelKey)}
    </Chip>
  );
}

/**
 * O MEDIDOR — a pista do ciclo. Uma vaga por capacidade do portfólio, tingida
 * pelo estágio, e uma vaga tracejada por capacidade que ainda falta selecionar
 * para chegar ao mínimo. É o gráfico que substituiu a porcentagem: com mínimo
 * de 1 a 3, "0%" não é informação — vaga vazia é.
 *
 * As vagas são decoração de leitura (`aria-hidden` pelo `role="img"` com nome):
 * quem não as vê lê o mesmo conteúdo na legenda logo abaixo e na lista.
 */
export function CapabilityPortfolioMeter({
  entries,
  label,
}: {
  entries: readonly PortfolioEntry[];
  label: string;
}) {
  const { t } = useI18n();
  const preenchidas = entries.map((entry) => PortfolioStage.of(entry));
  const legendas = PortfolioStage.ALL.filter((stage) => stage.quantas(entries) > 0);

  return (
    <div>
      <div role="img" aria-label={label} className="flex flex-wrap items-center gap-1.5">
        {preenchidas.map((stage, indice) => (
          <span
            /* A vaga é posição, não identidade: duas capacidades no mesmo estágio
               são vagas iguais, e o nome delas está na lista abaixo. */
            key={`${stage.slot}-${String(indice)}`}
            data-portfolio-slot={stage.slot}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md",
              SLOT_CLASS[stage.slot],
            )}
          >
            <stage.Icon className="size-4" aria-hidden />
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {legendas.map((stage) => (
          <Chip key={stage.slot} tone={stage.tone}>
            <stage.Icon className="size-3" aria-hidden />
            {stage.legenda(stage.quantas(entries), t)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
