import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function FilterField({
  label,
  htmlFor,
  className,
  children,
}: {
  label?: string | undefined;
  htmlFor?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-sm text-muted-foreground" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}
