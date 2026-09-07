import * as React from "react";

import { cn } from "@/lib/utils";
import { FieldControl, type ControlSize } from "./field-control";

interface InputProps extends Omit<React.ComponentProps<"input">, "size"> {
  /** `md` (36, o app) ou `lg` (44, as telas de porta). */
  size?: ControlSize | undefined;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size = "md", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          FieldControl.campo(size),
          "py-1 file:border-0 file:bg-transparent file:text-body file:font-medium file:text-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

/**
 * A caixa de leitura com a moldura do campo ([F-01]): o valor que a tela
 * mostra ao lado de campos editáveis sem ser editável — as 20 `<div>` que
 * copiavam a classe do `Input` à mão.
 */
const ReadOnlyField = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(FieldControl.campo(), "items-center bg-muted text-muted-foreground", className)}
      {...props}
    />
  ),
);
ReadOnlyField.displayName = "ReadOnlyField";

export { Input, ReadOnlyField };
