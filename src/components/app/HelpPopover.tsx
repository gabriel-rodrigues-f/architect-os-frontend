import { HelpCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHoverDisclosure } from "@/hooks";

/**
 * O "?" em si. Ele é um `<button>` de verdade — e não um ícone com `title` —
 * porque precisa estar na ordem de tabulação: a ajuda abre no HOVER, e quem
 * não tem ponteiro chega nela pelo foco ou pelo clique. E, por estar na
 * tabulação, o anel dele é o anel ÚNICO da casa ([A-01]) — a utility
 * `focus-ring`, a mesma do "?" de campo (`FieldLabel`), e não um anel só dele.
 */
function HelpTrigger({
  label,
  ref,
  ...rest
}: Omit<ComponentProps<"button">, "type" | "aria-label" | "aria-haspopup"> & { label: string }) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      className="grid h-6 w-6 shrink-0 place-content-center rounded-full text-muted-foreground transition-base hover:bg-secondary hover:text-foreground focus-visible:focus-ring"
      {...rest}
    >
      <HelpCircle className="h-4 w-4" />
    </button>
  );
}

/**
 * O "?" DA CASA — um só, para as três ajudas: a da tela (`PageHelp`), a do
 * card do Painel (`CardHelp`) e a da seção (`SectionHelp`).
 *
 * Dono (2026-09-09), literal: *"percebi algo no nosso botão de interrogação
 * ao lado direito do título: ele mostra para que aquela tela serve quando
 * clicamos. Está incorreto. Isso deve ocorrer em hover."* A régua vale para
 * TODAS as telas porque é o mesmo gatilho — e o gatilho é este componente,
 * não três cópias do mesmo `Popover` que precisariam concordar.
 *
 * O CUIDADO que a troca exige mora no `useHoverDisclosure`, junto com o do
 * cartão do filtro bloqueado: hover não existe no toque nem no teclado, então
 * o gatilho ganhou hover E foco e CONTINUA abrindo por clique. Aqui só ficam
 * as duas escolhas de desenho:
 *
 *  - `sideOffset={0}`: o cartão encosta no "?" para o ponteiro atravessar sem
 *    cair no vão — no vão o cartão fecharia no meio do caminho.
 *  - o TÍTULO é sempre a primeira linha, e o resto é dos campos de quem chama
 *    (`HelpField`), que já sabem o formato da casa.
 */
export function HelpPopover({
  label,
  title,
  align = "start",
  children,
}: {
  /** O nome do gatilho para quem usa leitor de tela ("Como usar Painel"). */
  label: string;
  title: string;
  align?: "start" | "end";
  children: ReactNode;
}) {
  const ajuda = useHoverDisclosure();

  return (
    <Popover open={ajuda.open} onOpenChange={ajuda.onOpenChange}>
      <PopoverTrigger asChild>
        <HelpTrigger ref={ajuda.triggerRef} label={label} {...ajuda.triggerProps} />
      </PopoverTrigger>
      <PopoverContent
        ref={ajuda.contentRef}
        align={align}
        sideOffset={0}
        className="w-80 max-w-[calc(100vw-2rem)] space-y-3 text-body"
        {...ajuda.contentProps}
      >
        <p className="font-display font-semibold">{title}</p>
        {children}
      </PopoverContent>
    </Popover>
  );
}
