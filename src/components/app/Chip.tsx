import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * O chip da casa (revisão mestre 2026-09-08, [F-03]): um só raio, um só peso,
 * um só padding para nível, distância, status, tipo de evento e filtro ativo.
 * As famílias que têm paleta própria (`bg-level-*`, `bg-gap-*`, `bg-status-*`)
 * pintam por `className`; as demais escolhem um `tone` semântico.
 *
 * `sm` (11 px) é o chip de contagem e de célula apertada; `md` (12 px) é o
 * padrão — o `text-label` da escala, o tamanho de rótulo de tabela e badge
 * (decisão do dono, UX-a).
 *
 * `tooltip` ([F-02]): a explicação do valor sai do `title=` nativo — que não
 * abre no toque nem por teclado — e vai para o `Tooltip` acessível, com uma
 * cópia só para leitor de tela logo depois do chip (fora dele, para o texto
 * visível do chip continuar sendo só o valor). Não combina com `asChild`:
 * o `Slot` veste UM filho.
 */
export type ChipTone = "neutral" | "primary" | "info" | "success" | "warning" | "danger";
export type ChipSize = "sm" | "md";

const TONE_CLASS: Record<ChipTone, string> = {
  neutral: "bg-secondary text-muted-foreground",
  primary: "bg-primary-subtle text-primary",
  info: "bg-info text-info-fg",
  success: "bg-success text-success-fg",
  warning: "bg-warning text-warning-fg",
  danger: "bg-danger-subtle text-destructive",
};

const SIZE_CLASS: Record<ChipSize, string> = {
  sm: "h-4 px-1.5 text-meta",
  md: "px-2 py-0.5 text-label",
};

export type ChipProps = ComponentPropsWithoutRef<"span"> & {
  /** Sem `tone`, quem pinta é o `className` — as famílias com paleta própria. */
  tone?: ChipTone;
  size?: ChipSize;
  /** Renderiza o filho no lugar do `span` — um `<button>` no chip removível. */
  asChild?: boolean;
  /** A explicação do valor: `Tooltip` no ponteiro, texto só-leitor ao lado. */
  tooltip?: string;
  children: ReactNode;
};

export function Chip({
  tone,
  size = "md",
  asChild = false,
  tooltip,
  className,
  children,
  ...rest
}: ChipProps) {
  const Component = asChild ? Slot : "span";
  const chip = (
    <Component
      data-chip
      data-tone={tone}
      data-size={size}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md font-medium",
        SIZE_CLASS[size],
        tone && TONE_CLASS[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
  if (tooltip === undefined) return chip;
  return (
    <>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{chip}</TooltipTrigger>
          <TooltipContent side="top">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span className="sr-only">{tooltip}</span>
    </>
  );
}
