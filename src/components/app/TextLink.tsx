import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

/**
 * O LINK DENTRO DO TEXTO.
 *
 * A régua do sublinhado (revisão mestre 2026-09-08, [B-01]) diz que
 * `hover:underline` mora em UM lugar, e reservou dois donos: a variante `link`
 * do `Button`, para o que é BOTÃO com cara de link, e este componente, "quando
 * nascer, para `<a>`/`<Link>`". Ele nasceu na fatia AVISOS, quando o título do
 * aviso virou o hiperlink da linha (dono, 2026-09-08) — e o `Button` não servia
 * ali: ele é `inline-flex whitespace-nowrap` com altura de controle, e um
 * título de aviso precisa quebrar linha dentro do parágrafo em que vive.
 *
 * É um `<a>` de verdade: endereço na barra de status, alcançável por Tab,
 * abrível em aba nova pelo navegador. O anel de foco é o único da casa.
 */
export function TextLink({ className, ...props }: ComponentPropsWithoutRef<"a">) {
  return (
    <a
      {...props}
      className={cn(
        "rounded-sm text-primary underline-offset-4 hover:underline focus-visible:focus-ring",
        className,
      )}
    />
  );
}
