import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Th, type CellAlign } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/view-models";

/**
 * Cabeçalho que ordena a coluna: a seta ao lado do rótulo diz a direção
 * (dono, 2026-09-05), e `aria-sort` diz o mesmo a quem lê por leitor de tela.
 * Nasceu em "De quem o time depende" e foi pedido de novo em Usuários (dono,
 * 2026-09-06) — o par dele é o `TableOrder`, que guarda coluna e direção.
 * Compõe o `Th` da primitiva de tabela ([F-05]): caixa alta, altura e
 * padding vêm de lá; aqui só o botão e a seta.
 */
export function SortableHeader<Column extends string>({
  column,
  label,
  direction,
  onToggle,
  align = "left",
  className,
}: {
  column: Column;
  label: string;
  direction: SortDirection | null;
  onToggle: (column: Column) => void;
  align?: CellAlign;
  className?: string | undefined;
}) {
  const { t } = useI18n();
  const Arrow = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <Th
      align={align}
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
      className={className}
    >
      <button
        type="button"
        onClick={() => onToggle(column)}
        aria-label={t("table.sort.by", { coluna: label })}
        className={cn(
          "inline-flex items-center gap-1 transition-fast hover:text-foreground focus-visible:focus-ring",
          direction !== null && "text-foreground",
        )}
      >
        {label}
        <Arrow aria-hidden="true" className={cn("size-3.5", direction === null && "opacity-50")} />
      </button>
    </Th>
  );
}
