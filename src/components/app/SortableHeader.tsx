import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/view-models";

/**
 * Cabeçalho que ordena a coluna: a seta ao lado do rótulo diz a direção
 * (dono, 2026-09-05), e `aria-sort` diz o mesmo a quem lê por leitor de tela.
 * Nasceu em "De quem o time depende" e foi pedido de novo em Usuários (dono,
 * 2026-09-06) — o par dele é o `TableOrder`, que guarda coluna e direção.
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
  align?: "left" | "center";
  className?: string | undefined;
}) {
  const { t } = useI18n();
  const Arrow = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <th
      scope="col"
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
      className={cn(className ?? "px-4 py-3", align === "center" && "text-center")}
    >
      <button
        type="button"
        onClick={() => onToggle(column)}
        aria-label={t("table.sort.by", { coluna: label })}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground",
          direction !== null && "text-foreground",
        )}
      >
        {label}
        <Arrow aria-hidden="true" className={cn("size-3.5", direction === null && "opacity-50")} />
      </button>
    </th>
  );
}
