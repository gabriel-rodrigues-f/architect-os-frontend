import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Título de cartão e de seção (referência FIAP 2026-09-06, §2 item 5): caixa
 * alta com tracking, peso médio. `h2` por padrão — `h3` dentro de um
 * `SectionGroup`, `p` quando é rótulo de número (KPI, média) e não título de
 * região. `muted` é o rótulo discreto sobre um valor grande.
 */
export function SectionHeading({
  as: Tag = "h2",
  id,
  muted = false,
  className,
  children,
}: {
  as?: "h2" | "h3" | "p";
  id?: string | undefined;
  muted?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag id={id} className={cn("section-heading", muted && "text-muted-foreground", className)}>
      {children}
    </Tag>
  );
}
