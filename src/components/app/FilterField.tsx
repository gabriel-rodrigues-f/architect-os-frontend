import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Rótulo + controle de filtro. O rótulo é o `Label` da casa (14, decisão
 * UX-a) em tinta secundária — era um `<label>` cru com classe própria.
 */
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
        <Label className="block font-normal text-text-secondary" htmlFor={htmlFor}>
          {label}
        </Label>
      )}
      {children}
    </div>
  );
}
