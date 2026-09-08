import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { FieldControl } from "@/components/ui/field-control";
import { cn } from "@/lib/utils";

interface FilterTriggerButtonProps extends ComponentPropsWithoutRef<"button"> {
  children: ReactNode;
  /**
   * BLOQUEADO NÃO É DESABILITADO. O gatilho não escolhe nada, mas continua na
   * ordem de tabulação e continua recebendo ponteiro — é a única forma de o
   * cartão que explica o bloqueio abrir no HOVER e no FOCO (dono, 2026-09-08).
   * Um `disabled` de verdade some do teclado e não emite evento de mouse:
   * quem só navega por teclado nunca chegaria ao botão de cadastro do cartão.
   */
  blocked?: boolean;
}

/**
 * O gatilho de filtro veste a moldura do campo ([F-01]) — mesma borda,
 * mesma altura pelo token, mesmo anel de foco que o `Select` ao lado.
 *
 * Ele é SEMPRE um `<button>`, inclusive no seletor vazio: gatilho que vira
 * âncora deixa de ser gatilho, e o dono recusou esse desenho em 2026-09-08.
 */
export const FilterTriggerButton = forwardRef<HTMLButtonElement, FilterTriggerButtonProps>(
  function FilterTriggerButton({ className, disabled, blocked, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-disabled={blocked ? true : undefined}
        className={cn(
          FieldControl.campo(),
          "min-w-48 cursor-pointer items-center justify-between gap-2 bg-card text-body md:text-body",
          (disabled || blocked) && "cursor-not-allowed text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
