import type { ButtonVariant } from "@/components/ui/button";

/** O que um diálogo de comando aceita para o botão de confirmar: a palavra nova e a de ontem. */
export type CommandVariantName = "primary" | "danger" | "default" | "destructive";

/**
 * A variante do botão de confirmar de `CommandDialog` e
 * `CommandWithReasonDialog` (dois lugares, uma tradução). `default` e
 * `destructive` são a palavra de ontem dos chamadores que o PR 10 migra;
 * aqui viram `primary` e `danger`.
 */
export class CommandVariant {
  private static readonly DE_ONTEM: Record<CommandVariantName, ButtonVariant> = {
    primary: "primary",
    danger: "danger",
    default: "primary",
    destructive: "danger",
  };

  static of(name: CommandVariantName): ButtonVariant {
    return CommandVariant.DE_ONTEM[name];
  }
}
