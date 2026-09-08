import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * O texto que a tela CORTA e devolve INTEIRO no ponteiro e no teclado.
 *
 * Nasceu privado na Mentoria (o nome longo de competência na lista do
 * diálogo) e já estava escrito à mão em quatro outros lugares — o e-mail e a
 * maior distância do cartão de time, o e-mail e o time da tabela, a
 * capacidade do Risco de Concentração e a coluna do mapa de calor. A regra
 * da casa é que dois já bastam: agora é um componente só.
 *
 * Duas coisas que ele resolve e o `title=` nativo não ([F-02]): o balão abre
 * no TOQUE e por TECLADO — o gatilho é focalizável de propósito. Quem lê com
 * leitor de tela ouve o texto inteiro, porque o texto inteiro é o conteúdo
 * do próprio gatilho quando não há rótulo curto.
 *
 * `children` existe para o caso em que o que APARECE não é o texto inteiro —
 * a coluna do mapa de calor mostra a sigla da capacidade e devolve o nome.
 */
export function TruncatedText({
  text,
  children,
  className,
}: {
  /** O texto inteiro — o que o balão devolve. */
  text: string;
  /** O que aparece cortado. Sem ele, o próprio texto. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className={cn("min-w-0 truncate", className)}>
            {children ?? text}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
