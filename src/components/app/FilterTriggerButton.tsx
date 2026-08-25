import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * R3-006 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — a investigação encontrou 6
 * componentes diferentes reimplementando a mesma string de classes pro botão-
 * gatilho de um popover de filtro (`flex h-9-ou-h-10 w-full items-center
 * justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm
 * [shadow-sm]`), o que deixa "Ordenar por" (um `<select>` nativo) visualmente
 * diferente dos outros filtros da mesma linha sem que nada force os dois a
 * bater. `FilterTriggerButton` é o miolo visual único: `MultiSelectFilter` e
 * `SingleSelectFilter` renderizam este mesmo componente, então altura,
 * largura, borda e sombra ficam garantidas por construção — não por duas
 * strings de classe copiadas que podem divergir de novo amanhã.
 *
 * Fica deliberadamente burro: não sabe nada de seleção múltipla/única, só
 * empresta o `<button>` com o visual certo. `children` decide o conteúdo
 * (texto truncado + ícone) porque cada chamador tem seu próprio resumo.
 */
export interface FilterTriggerButtonProps extends ComponentPropsWithoutRef<"button"> {
  children: ReactNode;
}

export const FilterTriggerButton = forwardRef<HTMLButtonElement, FilterTriggerButtonProps>(
  function FilterTriggerButton({ className, disabled, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(
          "mt-1.5 flex h-10 w-full min-w-48 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm shadow-sm",
          disabled && "cursor-not-allowed text-muted-foreground opacity-70",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
