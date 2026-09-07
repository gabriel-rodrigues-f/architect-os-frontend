import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * O badge não é botão: não tem hover ([P-02] — os `hover:bg-…/80` eram
 * opacidade sobre token num elemento que ninguém clica). O foco por
 * `focus-visible` fica para o caso raro de badge focável.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-label font-semibold transition-base focus-visible:focus-ring",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
