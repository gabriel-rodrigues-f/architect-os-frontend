import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FilterTriggerButtonProps extends ComponentPropsWithoutRef<"button"> {
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
          "flex h-9 w-full min-w-48 items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm shadow-sm",
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
