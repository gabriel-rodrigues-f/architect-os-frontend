import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Seis variantes ([B-01], decisão UX-d do dono): `primary`, `secondary`
 * (borda + fundo de card — o `outline` de ontem; o sólido `bg-secondary`
 * sumiu), `ghost`, `danger` (sólido, só em confirmação), `danger-ghost`
 * (texto destrutivo, hover na faixa `danger-subtle` — o ato destrutivo na
 * lista) e `link`. Hover e active leem `primary-hover`/`primary-active`, não
 * opacidade sobre o primário ([P-02]).
 *
 * Aliases para os 98 usos que o PR 10 migra, rota a rota: `default` →
 * `primary`, `outline` → `secondary`, `destructive` → `danger`,
 * `destructive-soft` → `danger-ghost`. Saem com o último uso.
 */
const PRIMARY =
  "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active";
const SECONDARY =
  "border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground";
const DANGER =
  "bg-destructive text-destructive-foreground hover:brightness-110 active:brightness-95";
const DANGER_GHOST = "text-destructive hover:bg-danger-subtle";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-body font-medium cursor-pointer transition-base focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: PRIMARY,
        secondary: SECONDARY,
        ghost: "hover:bg-accent hover:text-accent-foreground",
        danger: DANGER,
        "danger-ghost": DANGER_GHOST,
        link: "text-primary underline-offset-4 hover:underline",
        default: PRIMARY,
        outline: SECONDARY,
        destructive: DANGER,
        "destructive-soft": DANGER_GHOST,
      },
      size: {
        default: "h-(--control-h) px-4 py-2",
        sm: "h-8 rounded-md px-3 text-label",
        lg: "h-(--control-h-lg) rounded-md px-8",
        icon: "size-(--control-h)",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, type ButtonVariant };
