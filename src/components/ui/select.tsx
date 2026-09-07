import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { FieldControl, type ControlSize } from "./field-control";

interface SelectProps extends Omit<React.ComponentProps<"select">, "size"> {
  /** `md` (36, o app) ou `lg` (44, as telas de porta). */
  size?: ControlSize | undefined;
}

/**
 * O `<select>` NATIVO com a moldura do `Input` ([F-01], [A-01]): mesma
 * borda, mesma altura pelo token, mesmo anel `focus-ring` por
 * `focus-visible` — o Tab mostra o anel, o clique do mouse não. Nativo de
 * propósito: o formulário do app escolhe entre poucas opções, e o
 * listbox custom traria teclado, leitor de tela e rolagem para reimplementar.
 * A seta é da casa (lucide), sobre a seta do sistema escondida.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size = "md", children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(FieldControl.campo(size), "appearance-none pr-8", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  ),
);
Select.displayName = "Select";

export { Select };
