import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/**
 * REVISAO-360-FRONTEND-UI-UX-ENTERPRISE-SYNAPSE-2026-08-22.md, Seção 6/97 —
 * padrão único de busca+filtros+contagem+paginação pra toda lista/tabela
 * relevante, em vez de cada tela reinventar o próprio layout de filtro.
 * Composição, não um componente monolítico: `children` recebe os controles
 * específicos do domínio de cada tela (select de capacidade, de papel
 * etc.) — este componente só organiza busca, chips de filtro ativo,
 * ordenação e contagem ao redor deles.
 */
export interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface SortOption {
  value: string;
  label: string;
}

export interface DataViewToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  /** Controles extras (selects de domínio) — entre a busca e a ordenação. */
  children?: ReactNode;
  resultCount: number;
  totalCount: number;
  activeFilters?: ActiveFilterChip[];
  onClearFilters?: () => void;
  sortValue?: string;
  sortOptions?: SortOption[];
  onSortChange?: (value: string) => void;
  sortLabel?: string;
}

export function DataViewToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  children,
  resultCount,
  totalCount,
  activeFilters,
  onClearFilters,
  sortValue,
  sortOptions,
  onSortChange,
  sortLabel,
}: DataViewToolbarProps) {
  const { t } = useI18n();
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {onSearchChange && (
          <div className="min-w-[200px] flex-1">
            {searchLabel && (
              <label className="block text-xs text-muted-foreground" htmlFor="data-view-search">
                {searchLabel}
              </label>
            )}
            <input
              id="data-view-search"
              type="search"
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder ?? t("dataView.searchPlaceholder")}
              aria-label={searchLabel ?? searchPlaceholder ?? t("dataView.searchPlaceholder")}
              className={`w-full rounded-md border border-input bg-card px-3 py-2 text-sm ${searchLabel ? "mt-1" : ""}`}
            />
          </div>
        )}

        {children}

        {sortOptions && sortOptions.length > 0 && (
          <div>
            <label className="block text-xs text-muted-foreground" htmlFor="data-view-sort">
              {sortLabel ?? t("dataView.sortLabel")}
            </label>
            <select
              id="data-view-sort"
              value={sortValue}
              onChange={(e) => onSortChange?.(e.target.value)}
              className="mt-1 rounded-md border border-input bg-card px-2 py-2 text-sm"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="ml-auto shrink-0 self-center whitespace-nowrap text-xs text-muted-foreground">
          {resultCount === totalCount
            ? t("dataView.resultCountAll", { n: totalCount })
            : t("dataView.resultCount", { n: resultCount, total: totalCount })}
        </p>
      </div>

      {activeFilters && activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={f.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20"
            >
              {f.label}
              <X className="h-3 w-3" />
            </button>
          ))}
          {onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {t("dataView.clearFilters")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Seção 9 — 25/50/100 por página, "1–25 de 238" explícito. `page` é
 * 1-based (mais legível na URL/estado do que 0-based).
 */
export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizeOptions = [25, 50, 100],
  onPageSizeChange,
}: PaginationProps) {
  const { t } = useI18n();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  /**
   * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1-12/B-13 — a
   * condição antiga (`total <= pageSizeOptions[0] && !onPageSizeChange`)
   * só escondia a barra pra quem NÃO deixa trocar o tamanho da página;
   * qualquer tela com `onPageSizeChange` (o caso real, Time) sempre
   * renderizava Anterior/Próxima/"Página 1 de 1", mesmo com tudo cabendo
   * numa página só. O critério certo é o número de páginas em si.
   */
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm">
      <p className="text-xs text-muted-foreground">
        {t("dataView.pageRange", { from, to, total })}
      </p>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            aria-label={t("dataView.pageSize")}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-md border border-input bg-card px-2 py-1.5 text-xs"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {t("dataView.pageSizeOption", { n })}
              </option>
            ))}
          </select>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t("dataView.previous")}
        </Button>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {t("dataView.pageOf", { page, totalPages })}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("dataView.next")}
        </Button>
      </div>
    </div>
  );
}

/** Seção 10 — "sem dados" (coleção vazia de verdade) é diferente de "sem resultado" (filtro zerou tudo); nunca a mesma mensagem. */
export function EmptyState({
  hasFilters,
  emptyMessage,
  noResultsMessage,
  onClearFilters,
}: {
  hasFilters: boolean;
  emptyMessage: string;
  noResultsMessage: string;
  onClearFilters?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="py-8 text-center">
      <p className="text-sm text-muted-foreground">
        {hasFilters ? noResultsMessage : emptyMessage}
      </p>
      {hasFilters && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-2 text-xs text-primary hover:underline"
        >
          {t("dataView.clearFilters")}
        </button>
      )}
    </div>
  );
}
