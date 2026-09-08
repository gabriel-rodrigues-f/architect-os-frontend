import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { FieldControl } from "@/components/ui/field-control";
import { cn } from "@/lib/utils";

interface FilterTriggerButtonProps extends ComponentPropsWithoutRef<"button"> {
  children: ReactNode;
}

/**
 * O gatilho de filtro veste a moldura do campo ([F-01]) — mesma borda,
 * mesma altura pelo token, mesmo anel de foco que o `Select` ao lado.
 *
 * Ele é SEMPRE um `<button>`, inclusive no seletor vazio: gatilho que vira
 * âncora deixa de ser gatilho, e o dono recusou esse desenho em 2026-09-08.
 */
export const FilterTriggerButton = forwardRef<HTMLButtonElement, FilterTriggerButtonProps>(
  function FilterTriggerButton({ className, disabled, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(
          FieldControl.campo(),
          "min-w-48 cursor-pointer items-center justify-between gap-2 bg-card text-body md:text-body",
          disabled && "cursor-not-allowed text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
