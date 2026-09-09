import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Th, type CellAlign } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/view-models";

/**
 * Cabeçalho que ordena a coluna: a seta ao lado do rótulo diz a direção
 * (dono, 2026-09-05), e `aria-sort` diz o mesmo a quem lê por leitor de tela.
 * Nasceu em "De quem o time depende", foi pedido de novo em Usuários (dono,
 * 2026-09-06) e de novo no Mapa de Calor (dono, 2026-09-08) — o par dele é o
 * `TableOrder`, que guarda coluna e direção. Compõe o `Th` da primitiva de
 * tabela ([F-05]): caixa alta, altura e padding vêm de lá; aqui só o botão e
 * a seta.
 */
export function SortableHeader<Column extends string>({
  column,
  label,
  short,
  direction,
  onToggle,
  align = "left",
  className,
}: {
  column: Column;
  label: string;
  /**
   * O rótulo CURTO que aparece quando o nome inteiro não cabe na coluna — a
   * sigla da capacidade no mapa de calor. O nome continua sendo o `label`: é
   * ele que nomeia o botão para quem lê por leitor de tela, e é ele que o
   * balão devolve no ponteiro e no teclado ([F-02] — `title=` nativo não abre
   * no toque). O gatilho do balão é o PRÓPRIO botão, e não um `TruncatedText`
   * dentro dele: elemento focalizável dentro de botão é foco em cima de foco.
   *
   * O corte é de 4rem NO RÓTULO, não na célula: `max-width` de `<th>` é
   * palpite para o algoritmo de tabela automática, e a coluna cresceria com a
   * sigla comprida.
   */
  short?: string;
  direction: SortDirection | null;
  onToggle: (column: Column) => void;
  align?: CellAlign;
  className?: string | undefined;
}) {
  const { t } = useI18n();
  const Arrow = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  const control = (
    <button
      type="button"
      onClick={() => onToggle(column)}
      aria-label={t("table.sort.by", { coluna: label })}
      className={cn(
        "inline-flex max-w-full items-center gap-1 transition-fast hover:text-foreground focus-visible:focus-ring",
        direction !== null && "text-foreground",
      )}
    >
      {short === undefined ? label : <span className="max-w-16 truncate">{short}</span>}
      <Arrow
        aria-hidden="true"
        className={cn("size-3.5 shrink-0", direction === null && "opacity-50")}
      />
    </button>
  );
  return (
    <Th
      align={align}
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
      className={className}
    >
      {short === undefined ? (
        control
      ) : (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>{control}</TooltipTrigger>
            <TooltipContent side="top" className="max-w-64">
              {label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </Th>
  );
}
