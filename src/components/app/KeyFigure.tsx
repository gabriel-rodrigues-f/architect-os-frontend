import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useId, type ReactNode } from "react";

import { useI18n } from "@/lib/i18n";
import { type KeyFigureFormat, KeyFigureFormatter } from "@/lib/key-figure-format";
import { cn } from "@/lib/utils";

import { SectionHeading } from "./SectionHeading";
import { type StatTone, statToneStyles } from "./ui-bits";

/**
 * O número-síntese de um bloco (referência FIAP 2026-09-06, §2 itens 1 e 2):
 * "uma dobra, uma ideia" — o rótulo em caixa alta, UM valor grande (40–48 px,
 * pelo token `--text-key-figure`), a legenda pequena e, se houver, a
 * tendência. O tom é o mesmo vocabulário do `StatCard` (`StatTones`): quem
 * sabe o que o número significa decide; o número só publica.
 *
 * O valor numérico passa pelo `KeyFigureFormatter` no idioma da sessão; um
 * valor em texto (o nome do ciclo) entra como está.
 */
export type KeyFigureTrend = {
  direction: "up" | "down" | "flat";
  label: string;
};

const TREND_ICON: Record<KeyFigureTrend["direction"], typeof ArrowUpRight> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
};

export function KeyFigure({
  as = "p",
  labelId,
  label,
  value,
  format = "integer",
  caption,
  trend,
  tone = "neutral",
  help,
  className,
}: {
  /** `h2` quando o rótulo É o título do bloco (`KeyFigureCard`); `p` quando é um número entre outros. */
  as?: "h2" | "h3" | "p";
  labelId?: string;
  label: string;
  value: number | string;
  format?: KeyFigureFormat;
  caption?: string;
  trend?: KeyFigureTrend;
  tone?: StatTone;
  /** O "?" do próprio número — ao lado do rótulo. */
  help?: ReactNode;
  className?: string;
}) {
  const { locale } = useI18n();
  const text =
    typeof value === "number" ? new KeyFigureFormatter(locale).format(value, format) : value;
  const TrendIcon = trend ? TREND_ICON[trend.direction] : undefined;

  return (
    <div data-key-figure data-tone={tone} className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-2">
        <SectionHeading as={as} id={labelId} muted={as === "p"}>
          {label}
        </SectionHeading>
        {help}
      </div>
      <p className={cn("key-figure-value mt-3", statToneStyles[tone].value)}>{text}</p>
      {caption && <p className="mt-2 text-sm text-muted-foreground">{caption}</p>}
      {trend && TrendIcon && (
        <p
          data-trend={trend.direction}
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"
        >
          <TrendIcon className="h-3.5 w-3.5" aria-hidden />
          {trend.label}
        </p>
      )}
    </div>
  );
}

/**
 * Um bloco inteiro — "uma dobra, uma ideia": o rótulo é o título (`h2`), o
 * número vem logo abaixo e o detalhe (`children`), mais leve, fecha o bloco.
 * É a unidade do Painel Executivo e da Visão do Sistema, e o número-síntese
 * das telas de análise quando não há detalhe.
 */
export function KeyFigureCard({
  className,
  children,
  ...figure
}: Omit<Parameters<typeof KeyFigure>[0], "as" | "labelId"> & { children?: ReactNode }) {
  const labelId = useId();
  return (
    <section aria-labelledby={labelId} className={cn("surface-card p-5", className)}>
      <KeyFigure as="h2" labelId={labelId} {...figure} />
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}
