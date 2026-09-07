import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useId, type ReactNode } from "react";

import { useI18n } from "@/lib/i18n";
import { type KeyFigureFormat, KeyFigureFormatter } from "@/lib/key-figure-format";
import { cn } from "@/lib/utils";

import { SectionHeading } from "./SectionHeading";

/**
 * O TOM de um big number diz, antes do número, se ele pede ação. Pedido do
 * dono (2026-09-05): "Gráficos e big number precisam ter cor, precisamos
 * começar a retocar isso para sermos mais claros." Oito cartões iguais no
 * painel do admin faziam "Distâncias críticas: 7" pesar o mesmo que
 * "Profissionais: 5".
 *
 *   neutral    contagem que não pede nada (pessoas, competências)
 *   attention  fila que espera alguém (evidências a revisar, PDIs a aprovar)
 *   critical   o que já passou do limite (distâncias críticas)
 *   good       zero pendência, ou meta batida
 */
export type StatTone = "neutral" | "attention" | "critical" | "good";

export class StatTones {
  /** Fila: vazia é bom; cheia pede atenção. */
  static byPending(count: number): StatTone {
    return count > 0 ? "attention" : "good";
  }

  /** Severidade: qualquer ocorrência já é crítica. */
  static bySeverity(count: number): StatTone {
    return count > 0 ? "critical" : "good";
  }
}

/** Os estilos de cada tom — o valor e a caixa do ícone lêem o mesmo mapa. */
export const statToneStyles: Record<StatTone, { value: string; icon: string }> = {
  neutral: { value: "", icon: "bg-secondary text-muted-foreground" },
  attention: { value: "text-[var(--warning-fg)]", icon: "bg-warning text-warning-fg" },
  critical: { value: "text-destructive", icon: "bg-danger-subtle text-destructive" },
  good: { value: "text-[var(--success-fg)]", icon: "bg-success text-success-fg" },
};

/**
 * O número-síntese de um bloco (referência FIAP 2026-09-06, §2 itens 1 e 2):
 * "uma dobra, uma ideia" — o rótulo em caixa alta, UM valor grande, a legenda
 * pequena e, se houver, a tendência. Dois tamanhos da escala: `md` é o
 * Display XL (40–48 px, token `--text-key-figure`) do Painel; `sm` é o
 * Display 32 (`--text-kpi`) do cartão de contagem — o antigo `StatCard`
 * ([D-01]: um só cartão de KPI).
 *
 * O valor numérico passa pelo `KeyFigureFormatter` no idioma da sessão; um
 * valor em texto (o nome do ciclo, um "—") entra como está.
 */
export type KeyFigureTrend = {
  direction: "up" | "down" | "flat";
  label: string;
};

export type KeyFigureSize = "md" | "sm";

const TREND_ICON: Record<KeyFigureTrend["direction"], typeof ArrowUpRight> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
};

const VALUE_CLASS: Record<KeyFigureSize, string> = {
  md: "key-figure-value mt-3",
  sm: "mt-1.5 font-display text-(length:--text-kpi) leading-(--text-kpi--line-height) font-semibold tracking-tight tabular-nums",
};

export type KeyFigureProps = {
  /** `h2` quando o rótulo É o título do bloco (`KeyFigureCard`); `p` quando é um número entre outros. */
  as?: "h2" | "h3" | "p";
  labelId?: string;
  label: string;
  value: ReactNode;
  format?: KeyFigureFormat;
  size?: KeyFigureSize;
  caption?: ReactNode;
  trend?: KeyFigureTrend;
  tone?: StatTone;
  /** O "?" do próprio número — ao lado do rótulo. */
  help?: ReactNode;
  className?: string;
};

export function KeyFigure({
  as = "p",
  labelId,
  label,
  value,
  format = "integer",
  size = "md",
  caption,
  trend,
  tone = "neutral",
  help,
  className,
}: KeyFigureProps) {
  const { locale } = useI18n();
  const text =
    typeof value === "number" ? new KeyFigureFormatter(locale).format(value, format) : value;
  const TrendIcon = trend ? TREND_ICON[trend.direction] : undefined;
  const heading = (
    <SectionHeading as={as} id={labelId} muted={as === "p"}>
      {label}
    </SectionHeading>
  );

  return (
    <div
      data-key-figure
      data-tone={tone}
      data-size={size}
      className={cn("flex flex-col", className)}
    >
      {help ? (
        <div className="flex items-start justify-between gap-2">
          {heading}
          {help}
        </div>
      ) : (
        heading
      )}
      <p className={cn(VALUE_CLASS[size], statToneStyles[tone].value)}>{text}</p>
      {caption && <p className="mt-2 text-sm text-muted-foreground">{caption}</p>}
      {trend && TrendIcon && (
        <p
          data-trend={trend.direction}
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground"
        >
          <TrendIcon className="size-3.5" aria-hidden />
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
 * das telas de análise quando não há detalhe. O `icon`, na caixa tingida pelo
 * tom, é o do cartão de contagem (`size="sm"`).
 */
export function KeyFigureCard({
  className,
  icon,
  children,
  ...figure
}: Omit<KeyFigureProps, "as" | "labelId"> & { icon?: ReactNode; children?: ReactNode }) {
  const labelId = useId();
  const tone = figure.tone ?? "neutral";
  const key = <KeyFigure as="h2" labelId={labelId} {...figure} />;
  return (
    <section
      aria-labelledby={labelId}
      data-tone={tone}
      className={cn("surface-card p-6", className)}
    >
      {icon ? (
        <div className="flex items-start justify-between gap-3">
          {key}
          <span className={cn("shrink-0 rounded-md p-2", statToneStyles[tone].icon)}>{icon}</span>
        </div>
      ) : (
        key
      )}
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}
