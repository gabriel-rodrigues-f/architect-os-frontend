import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { FieldControl } from "@/components/ui/field-control";
import { cn } from "@/lib/utils";

interface FilterTriggerButtonProps extends ComponentPropsWithoutRef<"button"> {
  children: ReactNode;
  /**
   * Veste o elemento de quem chama — um `Link` — com a moldura do gatilho.
   * É como o seletor VAZIO oferece a porta de cadastro sem inventar um
   * segundo desenho de campo (dono, 2026-09-08).
   */
  asChild?: boolean;
}

/**
 * O gatilho de filtro veste a moldura do campo ([F-01]) — mesma borda,
 * mesma altura pelo token, mesmo anel de foco que o `Select` ao lado.
 */
export const FilterTriggerButton = forwardRef<HTMLButtonElement, FilterTriggerButtonProps>(
  function FilterTriggerButton({ className, disabled, asChild = false, children, ...props }, ref) {
    const Componente = asChild ? Slot : "button";
    return (
      <Componente
        ref={ref}
        {...(asChild ? {} : { type: "button" as const, disabled })}
        className={cn(
          FieldControl.campo(),
          "min-w-48 cursor-pointer items-center justify-between gap-2 bg-card text-body md:text-body",
          disabled && "cursor-not-allowed text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </Componente>
    );
  },
);
