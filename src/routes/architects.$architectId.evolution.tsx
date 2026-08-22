import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EvolutionLine, ProficiencyTimeline } from "@/components/app/charts";
import { Button } from "@/components/ui/button";
import { PageHeader, ProfileTabs, SectionCard, StatCard } from "@/components/app/ui-bits";
import { ApiError, evolutionApi, reportsApi } from "@/lib/api";
import type { CompetencyEvolutionComparison, EvolutionFilters, SelectionScope } from "@/lib/domain";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useSelectors, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { daysAgoIso, formatDate, todayIso } from "@/lib/text";

export const Route = createFileRoute("/architects/$architectId/evolution")({
  head: () => ({
    meta: [{ title: "Evolução — Synapse" }],
  }),
  component: ArchitectEvolution,
});

type PeriodPreset = "30" | "60" | "90" | "180" | "365" | "all" | "custom";

/** Seção 46 — presets cobrem os recortes mais pedidos; "todo o histórico" evita ter que adivinhar uma data inicial. */
function rangeForPreset(
  preset: PeriodPreset,
  custom: { from: string; to: string },
): { from: string; to: string } {
  switch (preset) {
    case "30":
      return { from: daysAgoIso(30), to: todayIso() };
    case "60":
      return { from: daysAgoIso(60), to: todayIso() };
    case "90":
      return { from: daysAgoIso(90), to: todayIso() };
    case "180":
      return { from: daysAgoIso(180), to: todayIso() };
    case "365":
      return { from: daysAgoIso(365), to: todayIso() };
    case "all":
      return { from: "2000-01-01", to: todayIso() };
    case "custom":
      return custom;
  }
}

/**
 * REVISAO-360-FRONTEND-UI-UX-ENTERPRISE-SYNAPSE-2026-08-22.md, FE-360-005
 * (P1 UX) — esta era "o maior problema de densidade da aplicação" (~8800px
 * de altura numa página só): KPIs, gráfico, drill-down por competência,
 * timeline INTEIRA e tabela com as 66 competências, tudo empilhado e
 * sempre renderizado. Vira quatro subvisões (Seção 51): Resumo, Capacidades,
 * Competências, Linha do tempo — mesmo dado já carregado por um `useQuery`
 * só, cada aba decide o que mostrar dele.
 */
type EvolutionView = "resumo" | "capacidades" | "competencias" | "timeline";
const VIEWS: { id: EvolutionView; labelKey: MessageKey }[] = [
  { id: "resumo", labelKey: "evolution.view.summary" },
  { id: "capacidades", labelKey: "evolution.view.capabilities" },
  { id: "competencias", labelKey: "evolution.view.competencies" },
  { id: "timeline", labelKey: "evolution.view.timeline" },
];

/** Seção 44/69 — mais de 6 séries num line chart deixa de ser legível; mostra as de maior variação por padrão, com opção de ver todas. */
const MAX_DEFAULT_SERIES = 6;

const TIMELINE_PAGE_SIZE = 25;

function ArchitectEvolution() {
  const { architectId } = Route.useParams();
  const store = useStore();
  const sel = useSelectors();
  const { t, locale } = useI18n();
  const architect = sel.architectById(architectId);

  const [preset, setPreset] = useState<PeriodPreset>("90");
  const [custom, setCustom] = useState({ from: daysAgoIso(90), to: todayIso() });
  const [selectedCapabilityIds, setSelectedCapabilityIds] = useState<string[]>([]);
  const [focusedCapabilityId, setFocusedCapabilityId] = useState<string | null>(null);
  const [source, setSource] = useState<"ALL" | "MENTORING" | "ASSESSMENT">("ALL");
  const [view, setView] = useState<EvolutionView>("resumo");
  /**
   * Painéis inativos ficam montados (`hidden`, nunca desmontados — Seção
   * FE-360-005) pra não perder o estado deles ao trocar de aba, mas isso
   * significa que o gráfico da aba recém-ativada mede o próprio container
   * ainda em transição de `display:none` pra visível — um `resize` só não
   * bastava (o `ResponsiveContainer` do recharts faz sua própria medição
   * com debounce interno; um disparo síncrono podia chegar cedo demais).
   * Duas tentativas escalonadas cobrem o próximo frame e a janela de
   * debounce sem precisar depender de uma versão específica do recharts.
   */
  useEffect(() => {
    const timers = [0, 60, 250].map((delay) =>
      window.setTimeout(() => window.dispatchEvent(new Event("resize")), delay),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [view]);
  const [showAllSeries, setShowAllSeries] = useState(false);
  const [competencySearch, setCompetencySearch] = useState("");
  const [timelineVisibleCount, setTimelineVisibleCount] = useState(TIMELINE_PAGE_SIZE);

  const range = rangeForPreset(preset, custom);
  const capabilities: SelectionScope = selectedCapabilityIds.length
    ? { mode: "SELECTED", ids: selectedCapabilityIds }
    : { mode: "ALL_VISIBLE" };

  /** Mesmos filtros pra tela e pro PDF (Fase 10.6) — exportar é "isto que estou vendo", nunca outro recorte. */
  const filters: EvolutionFilters = {
    range,
    capabilities,
    competencies: { mode: "ALL_VISIBLE" },
    source,
  };

  const queryKey = [
    "evolution-architect",
    architectId,
    range.from,
    range.to,
    selectedCapabilityIds.join(","),
    source,
  ];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => evolutionApi.architect(architectId, filters),
    enabled: !!architect,
  });

  const [exporting, setExporting] = useState(false);
  const exportPdf = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await reportsApi.exportEvolutionPdf(architectId, filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("evolution.export.error"));
    } finally {
      setExporting(false);
    }
  };

  const sortedComparisons = useMemo(
    () => (data ? [...data.comparisons].sort((a, b) => (b.delta ?? -99) - (a.delta ?? -99)) : []),
    [data],
  );

  /** As capacidades com maior |delta| primeiro — mesma ordem usada pro corte "top 6" e pra "maiores mudanças" do Resumo. */
  const capabilitiesByImpact = useMemo(() => {
    if (!data) return [];
    const deltaByCapability = new Map<string, number>();
    for (const c of data.comparisons) {
      if (c.delta === null) continue;
      deltaByCapability.set(
        c.capabilityId,
        Math.max(deltaByCapability.get(c.capabilityId) ?? 0, Math.abs(c.delta)),
      );
    }
    return [...data.capabilitySeries].sort(
      (a, b) =>
        (deltaByCapability.get(b.capabilityId) ?? 0) - (deltaByCapability.get(a.capabilityId) ?? 0),
    );
  }, [data]);

  const visibleSeriesIds = useMemo(() => {
    if (!data) return new Set<string>();
    if (showAllSeries || data.capabilitySeries.length <= MAX_DEFAULT_SERIES) {
      return new Set(data.capabilitySeries.map((s) => s.capabilityId));
    }
    return new Set(capabilitiesByImpact.slice(0, MAX_DEFAULT_SERIES).map((s) => s.capabilityId));
  }, [data, showAllSeries, capabilitiesByImpact]);

  /** Seção 33 — pivota `CapabilitySeries[]` (uma série por capacidade) numa linha por data, para o `EvolutionLine` genérico. Só as séries visíveis (Seção 44/69). */
  const capabilityChartData = useMemo(() => {
    if (!data) return { rows: [], series: [] };
    const visibleSeries = data.capabilitySeries.filter((s) => visibleSeriesIds.has(s.capabilityId));
    const dates = [...new Set(visibleSeries.flatMap((s) => s.points.map((p) => p.date)))].sort();
    const rows = dates.map((date) => {
      const row: Record<string, string | number> = { cycle: date };
      for (const s of visibleSeries) {
        const point = s.points.find((p) => p.date === date);
        if (point) row[s.capabilityId] = point.averageLevel;
      }
      return row;
    });
    const series = visibleSeries.map((s) => ({ key: s.capabilityId, label: s.capabilityName }));
    return { rows, series };
  }, [data, visibleSeriesIds]);

  const focusedCompetencies = useMemo(() => {
    if (!data || !focusedCapabilityId) return [];
    return data.competencySeries.filter((c) => c.capabilityId === focusedCapabilityId);
  }, [data, focusedCapabilityId]);

  const filteredComparisons = useMemo(() => {
    const query = competencySearch.trim().toLowerCase();
    if (!query) return sortedComparisons;
    return sortedComparisons.filter((c) => c.competencyName.toLowerCase().includes(query));
  }, [sortedComparisons, competencySearch]);

  const sortedEvents = useMemo(
    () =>
      data ? [...data.events].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)) : [],
    [data],
  );

  const topChanges = useMemo(
    () => sortedComparisons.filter((c) => c.delta !== null && c.delta !== 0).slice(0, 5),
    [sortedComparisons],
  );

  if (!architect) {
    return (
      <div className="surface-card p-6 text-sm">
        {t("arch.notFound")}{" "}
        <Link to="/team" className="text-primary underline">
          {t("arch.back")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t("evolution.title", { nome: architect.name })}
        description={`${architect.role}${
          data?.architect.careerLevelName && data.architect.careerLevelName !== architect.role
            ? ` · ${data.architect.careerLevelName}`
            : ""
        }`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={exporting || !data}
              onClick={() => void exportPdf()}
            >
              {exporting ? t("evolution.export.generating") : t("evolution.export.button")}
            </Button>
            <Link
              to="/architects/$architectId"
              params={{ architectId }}
              className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
            >
              {t("arch.back")}
            </Link>
          </div>
        }
      />

      <ProfileTabs architectId={architect.id} active="evolution" />

      <SectionCard title={t("evolution.filters.title")} className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-muted-foreground" htmlFor="evolution-period">
              {t("evolution.filters.period")}
            </label>
            <select
              id="evolution-period"
              className="mt-1 rounded-md border border-input bg-card px-2 py-2 text-sm"
              value={preset}
              onChange={(e) => setPreset(e.target.value as PeriodPreset)}
            >
              <option value="30">{t("evolution.period.last30")}</option>
              <option value="60">{t("evolution.period.last60")}</option>
              <option value="90">{t("evolution.period.last90")}</option>
              <option value="180">{t("evolution.period.last180")}</option>
              <option value="365">{t("evolution.period.last365")}</option>
              <option value="all">{t("evolution.period.all")}</option>
              <option value="custom">{t("evolution.period.custom")}</option>
            </select>
          </div>

          {preset === "custom" && (
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs text-muted-foreground" htmlFor="evolution-from">
                  {t("evolution.filters.from")}
                </label>
                <input
                  id="evolution-from"
                  type="date"
                  max={todayIso()}
                  className="mt-1 rounded-md border border-input bg-card px-2 py-2 text-sm"
                  value={custom.from}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground" htmlFor="evolution-to">
                  {t("evolution.filters.to")}
                </label>
                <input
                  id="evolution-to"
                  type="date"
                  max={todayIso()}
                  className="mt-1 rounded-md border border-input bg-card px-2 py-2 text-sm"
                  value={custom.to}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-muted-foreground" htmlFor="evolution-source">
              {t("evolution.filters.source")}
            </label>
            <select
              id="evolution-source"
              className="mt-1 rounded-md border border-input bg-card px-2 py-2 text-sm"
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
            >
              <option value="ALL">{t("evolution.source.all")}</option>
              <option value="MENTORING">{t("evolution.source.mentoring")}</option>
              <option value="ASSESSMENT">{t("evolution.source.assessment")}</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <span className="block text-xs text-muted-foreground">
            {t("evolution.filters.capabilities")}
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {store.capabilities.map((c) => {
              const active = selectedCapabilityIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${active ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-accent"}`}
                  onClick={() =>
                    setSelectedCapabilityIds((ids) =>
                      active ? ids.filter((id) => id !== c.id) : [...ids, c.id],
                    )
                  }
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {isLoading && <p className="text-sm text-muted-foreground">{t("evolution.loading")}</p>}
      {isError && <p className="text-sm text-destructive">{t("evolution.error")}</p>}

      {data && (
        <>
          <div
            className="mb-4 flex gap-1 border-b border-border"
            role="tablist"
            aria-label={t("evolution.view.title")}
          >
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  view === v.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t(v.labelKey)}
              </button>
            ))}
          </div>

          <div role="tabpanel" hidden={view !== "resumo"}>
            <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard
                label={t("evolution.kpi.initialAverage")}
                value={data.summary.initialAverage?.toFixed(2) ?? "—"}
              />
              <StatCard
                label={t("evolution.kpi.currentAverage")}
                value={data.summary.currentAverage?.toFixed(2) ?? "—"}
              />
              <StatCard
                label={t("evolution.kpi.delta")}
                value={
                  data.summary.averageDelta === null
                    ? "—"
                    : `${data.summary.averageDelta > 0 ? "+" : ""}${data.summary.averageDelta.toFixed(2)}`
                }
              />
              <StatCard
                label={t("evolution.kpi.coverage")}
                value={`${data.summary.coverage.covered}/${data.summary.coverage.total}`}
              />
              <StatCard
                label={t("evolution.kpi.mentoring")}
                value={String(data.summary.mentoringCount)}
              />
              <StatCard
                label={t("evolution.kpi.assessment")}
                value={String(data.summary.assessmentCount)}
              />
            </div>

            <SectionCard title={t("evolution.chart.capability.title")} className="mb-6">
              <EvolutionLine
                data={capabilityChartData.rows}
                series={capabilityChartData.series}
                height={280}
              />
              <SeriesLimitNotice
                total={data.capabilitySeries.length}
                showingAll={showAllSeries}
                onToggle={() => setShowAllSeries((v) => !v)}
                t={t}
              />
            </SectionCard>

            <SectionCard
              title={t("evolution.summary.topChanges.title")}
              description={t("evolution.summary.topChanges.subtitle")}
            >
              {topChanges.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("evolution.summary.topChanges.empty")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {topChanges.map((c) => (
                    <li
                      key={c.competencyId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">{c.competencyName}</span>
                      <span className="flex shrink-0 items-center gap-2 tabular-nums">
                        {c.initialLevel ? `L${c.initialLevel}` : "—"} →{" "}
                        {c.currentLevel ? `L${c.currentLevel}` : "—"}
                        <span className={c.delta! > 0 ? "text-emerald-600" : "text-destructive"}>
                          ({c.delta! > 0 ? "+" : ""}
                          {c.delta})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <div role="tabpanel" hidden={view !== "capacidades"}>
            <SectionCard title={t("evolution.chart.capability.title")} className="mb-6">
              <EvolutionLine
                data={capabilityChartData.rows}
                series={capabilityChartData.series}
                height={280}
              />
              <SeriesLimitNotice
                total={data.capabilitySeries.length}
                showingAll={showAllSeries}
                onToggle={() => setShowAllSeries((v) => !v)}
                t={t}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {t("evolution.chart.capability.hint")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.capabilitySeries.map((s) => (
                  <button
                    key={s.capabilityId}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs ${focusedCapabilityId === s.capabilityId ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-accent"}`}
                    onClick={() =>
                      setFocusedCapabilityId((id) =>
                        id === s.capabilityId ? null : s.capabilityId,
                      )
                    }
                  >
                    {s.capabilityName}
                  </button>
                ))}
              </div>
            </SectionCard>

            {focusedCapabilityId && focusedCompetencies.length > 0 && (
              <SectionCard title={t("evolution.chart.competency.title")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {focusedCompetencies.map((c) => (
                    <div key={c.competencyId}>
                      <p className="mb-1 text-sm font-medium">{c.competencyName}</p>
                      <ProficiencyTimeline
                        label={c.competencyName}
                        height={180}
                        data={c.events.map((e) => ({ date: e.effectiveDate, level: e.toLevel }))}
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>

          <div role="tabpanel" hidden={view !== "competencias"}>
            <SectionCard title={t("evolution.comparison.title")}>
              <input
                type="search"
                placeholder={t("evolution.comparison.search")}
                value={competencySearch}
                onChange={(e) => setCompetencySearch(e.target.value)}
                className="mb-3 w-full max-w-sm rounded-md border border-input bg-card px-3 py-2 text-sm"
                aria-label={t("evolution.comparison.search")}
              />
              <p className="mb-2 text-xs text-muted-foreground">
                {t("evolution.comparison.count", {
                  n: filteredComparisons.length,
                  total: sortedComparisons.length,
                })}
              </p>
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="sticky top-0 z-10 bg-card py-2">
                        {t("evolution.comparison.competency")}
                      </th>
                      <th className="sticky top-0 z-10 bg-card py-2 text-center">
                        {t("evolution.comparison.initial")}
                      </th>
                      <th className="sticky top-0 z-10 bg-card py-2 text-center">
                        {t("evolution.comparison.current")}
                      </th>
                      <th className="sticky top-0 z-10 bg-card py-2 text-center">
                        {t("evolution.comparison.delta")}
                      </th>
                      <th className="sticky top-0 z-10 bg-card py-2">
                        {t("evolution.comparison.source")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComparisons.map((c: CompetencyEvolutionComparison) => (
                      <tr key={c.competencyId} className="border-b border-border/60 last:border-0">
                        <td className="py-2 font-medium">{c.competencyName}</td>
                        <td className="py-2 text-center">
                          {c.initialLevel ? `L${c.initialLevel}` : "—"}
                        </td>
                        <td className="py-2 text-center">
                          {c.currentLevel ? `L${c.currentLevel}` : "—"}
                        </td>
                        <td className="py-2 text-center">
                          {c.delta === null ? "—" : `${c.delta > 0 ? "+" : ""}${c.delta}`}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {c.lastSourceType === "MENTORING"
                            ? t("evolution.source.mentoring")
                            : c.lastSourceType === "ASSESSMENT"
                              ? t("evolution.source.assessment")
                              : "—"}
                        </td>
                      </tr>
                    ))}
                    {filteredComparisons.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-3 text-sm text-muted-foreground">
                          {t("evolution.comparison.noResults")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          <div role="tabpanel" hidden={view !== "timeline"}>
            <SectionCard title={t("evolution.timeline.title")}>
              {sortedEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("evolution.timeline.empty")}</p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {sortedEvents.slice(0, timelineVisibleCount).map((event) => {
                      const competency = data.competencySeries.find(
                        (c) => c.competencyId === event.competencyId,
                      );
                      return (
                        <li
                          key={event.id}
                          className="border-b border-border/60 pb-2 text-sm last:border-0"
                        >
                          <span className="text-xs text-muted-foreground">
                            {formatDate(event.effectiveDate, locale)} ·{" "}
                            {event.sourceType === "MENTORING"
                              ? t("evolution.source.mentoring")
                              : t("evolution.source.assessment")}
                          </span>
                          <div>
                            <span className="font-medium">
                              {competency?.competencyName ?? event.competencyId}
                            </span>{" "}
                            {event.fromLevel ? `L${event.fromLevel} → ` : ""}L{event.toLevel}
                          </div>
                          {event.note && (
                            <p className="text-xs text-muted-foreground">{event.note}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {timelineVisibleCount < sortedEvents.length && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {t("evolution.timeline.shown", {
                          n: Math.min(timelineVisibleCount, sortedEvents.length),
                          total: sortedEvents.length,
                        })}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTimelineVisibleCount((n) => n + TIMELINE_PAGE_SIZE)}
                      >
                        {t("evolution.timeline.loadMore")}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </>
  );
}

/** Seção 44/69 — nunca mais de 6 séries por padrão; deixa explícito o corte e como ver todas. */
function SeriesLimitNotice({
  total,
  showingAll,
  onToggle,
  t,
}: {
  total: number;
  showingAll: boolean;
  onToggle: () => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  if (total <= MAX_DEFAULT_SERIES) return null;
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      {showingAll
        ? t("evolution.chart.series.showingAll", { n: total })
        : t("evolution.chart.series.showingTop", { n: MAX_DEFAULT_SERIES, total })}{" "}
      <button type="button" className="text-primary hover:underline" onClick={onToggle}>
        {showingAll ? t("evolution.chart.series.showTop") : t("evolution.chart.series.showAll")}
      </button>
    </p>
  );
}
