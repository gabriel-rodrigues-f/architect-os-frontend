import { X } from "lucide-react";
import type { ReactNode } from "react";

import { SingleSelectFilter } from "@/components/app/SingleSelectFilter";
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

/**
 * R3-008 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o par `sortValue`/
 * `sortOptions`/`onSortChange`/`sortLabel` que `DataViewToolbar` tinha (e
 * que usava este tipo) nunca foi passado por chamador nenhum — era código
 * morto, removido. O tipo em si continua exportado porque `team-shared.tsx`
 * o usa pra tipar `roster.sortOptions`, hoje consumido por
 * `SingleSelectFilter` em `team.tsx` (que aceita `SortOption[]` porque seu
 * próprio `SingleSelectFilterOption` é estruturalmente idêntico).
 */
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
  /**
   * R2-UX-05 — `"grid-3"` é a grade 2×3 do Time: `children` (6 controles,
   * na ordem que devem aparecer) enchem um `grid-cols-3` sozinhos — o
   * auto-flow do CSS Grid já quebra em duas linhas de 3 sem precisar
   * partir `children` em dois grupos manualmente. Busca/ordenação por
   * `props` dedicadas ficam de fora desse modo: quem chama passa TUDO
   * como `children`, inclusive o controle de ordenação. A contagem sai da
   * linha de filtros e migra para a linha de chips (sempre visível nesse
   * modo, mesmo sem filtro ativo — "5 de 5" é informação, não só aviso de
   * corte). Default `"flex"` preserva o layout de sempre.
   */
  layout?: "flex" | "grid-3";
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
  layout = "flex",
}: DataViewToolbarProps) {
  const { t } = useI18n();
  const countLabel =
    resultCount === totalCount
      ? t("dataView.resultCountAll", { n: totalCount })
      : t("dataView.resultCount", { n: resultCount, total: totalCount });

  if (layout === "grid-3") {
    return (
      <div className="mb-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {activeFilters?.map((f) => (
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
            {onClearFilters && activeFilters && activeFilters.length > 0 && (
              <button
                type="button"
                onClick={onClearFilters}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {t("dataView.clearFilters")}
              </button>
            )}
          </div>
          <p className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{countLabel}</p>
        </div>
      </div>
    );
  }

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

        <p className="ml-auto shrink-0 self-center whitespace-nowrap text-xs text-muted-foreground">
          {countLabel}
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
        {/*
          R3-008 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — era um `<select>`
          nativo sem rótulo visível (só `aria-label`), do tamanho errado ao
          lado dos botões `size="sm"` "Anterior"/"Próxima". `SingleSelectFilter`
          sem `label` (uso compacto) reusa o mesmo `Popover`/`FilterTriggerButton`
          dos outros filtros, mas `triggerClassName` encolhe o gatilho padrão
          (`w-full min-w-48 h-10`) para bater com a altura/tamanho de fonte
          dos botões vizinhos (`h-8`/`text-xs`), em vez de esticar a barra de
          paginação.
        */}
        {onPageSizeChange && (
          <SingleSelectFilter
            id="data-view-page-size"
            ariaLabel={t("dataView.pageSize")}
            options={pageSizeOptions.map((n) => ({
              value: String(n),
              label: t("dataView.pageSizeOption", { n }),
            }))}
            value={String(pageSize)}
            onChange={(v) => onPageSizeChange(Number(v))}
            triggerClassName="mt-0 h-8 w-auto min-w-0 px-2 text-xs"
          />
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
