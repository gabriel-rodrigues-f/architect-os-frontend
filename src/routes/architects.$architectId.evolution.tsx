import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EvolutionLine, ProficiencyTimeline } from "@/components/app/charts";
import { Button } from "@/components/ui/button";
import { PageHeader, ProfileTabs, SectionCard, StatCard } from "@/components/app/ui-bits";
import { ApiError, evolutionApi, reportsApi } from "@/lib/api";
import type { EvolutionFilters, SelectionScope } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/architects/$architectId/evolution")({
  head: () => ({
    meta: [{ title: "Evolução — Synapse" }],
  }),
  component: ArchitectEvolution,
});

type PeriodPreset = "30" | "60" | "90" | "180" | "365" | "all" | "custom";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Seção 46 — presets cobrem os recortes mais pedidos; "todo o histórico" evita ter que adivinhar uma data inicial. */
function rangeForPreset(preset: PeriodPreset, custom: { from: string; to: string }): { from: string; to: string } {
  switch (preset) {
    case "30":
      return { from: isoDaysAgo(30), to: todayIso() };
    case "60":
      return { from: isoDaysAgo(60), to: todayIso() };
    case "90":
      return { from: isoDaysAgo(90), to: todayIso() };
    case "180":
      return { from: isoDaysAgo(180), to: todayIso() };
    case "365":
      return { from: isoDaysAgo(365), to: todayIso() };
    case "all":
      return { from: "2000-01-01", to: todayIso() };
    case "custom":
      return custom;
  }
}

function ArchitectEvolution() {
  const { architectId } = Route.useParams();
  const store = useStore();
  const sel = useSelectors();
  const { t } = useI18n();
  const architect = sel.architectById(architectId);

  const [preset, setPreset] = useState<PeriodPreset>("90");
  const [custom, setCustom] = useState({ from: isoDaysAgo(90), to: todayIso() });
  const [selectedCapabilityIds, setSelectedCapabilityIds] = useState<string[]>([]);
  const [focusedCapabilityId, setFocusedCapabilityId] = useState<string | null>(null);
  const [source, setSource] = useState<"ALL" | "MENTORING" | "ASSESSMENT">("ALL");

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

  const queryKey = ["evolution-architect", architectId, range.from, range.to, selectedCapabilityIds.join(","), source];
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

  /** Seção 33 — pivota `CapabilitySeries[]` (uma série por capacidade) numa linha por data, para o `EvolutionLine` genérico. */
  const capabilityChartData = useMemo(() => {
    if (!data) return { rows: [], series: [] };
    const dates = [...new Set(data.capabilitySeries.flatMap((s) => s.points.map((p) => p.date)))].sort();
    const rows = dates.map((date) => {
      const row: Record<string, string | number> = { cycle: date };
      for (const s of data.capabilitySeries) {
        const point = s.points.find((p) => p.date === date);
        if (point) row[s.capabilityId] = point.averageLevel;
      }
      return row;
    });
    const series = data.capabilitySeries.map((s) => ({ key: s.capabilityId, label: s.capabilityName }));
    return { rows, series };
  }, [data]);

  const focusedCompetencies = useMemo(() => {
    if (!data || !focusedCapabilityId) return [];
    return data.competencySeries.filter((c) => c.capabilityId === focusedCapabilityId);
  }, [data, focusedCapabilityId]);

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

  const sortedComparisons = data ? [...data.comparisons].sort((a, b) => (b.delta ?? -99) - (a.delta ?? -99)) : [];

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
            <Button size="sm" variant="secondary" disabled={exporting || !data} onClick={() => void exportPdf()}>
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
          <span className="block text-xs text-muted-foreground">{t("evolution.filters.capabilities")}</span>
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
            <StatCard label={t("evolution.kpi.mentoring")} value={String(data.summary.mentoringCount)} />
            <StatCard label={t("evolution.kpi.assessment")} value={String(data.summary.assessmentCount)} />
          </div>

          <SectionCard title={t("evolution.chart.capability.title")} className="mb-6">
            <EvolutionLine data={capabilityChartData.rows} series={capabilityChartData.series} height={280} />
            <p className="mt-2 text-xs text-muted-foreground">{t("evolution.chart.capability.hint")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.capabilitySeries.map((s) => (
                <button
                  key={s.capabilityId}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${focusedCapabilityId === s.capabilityId ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-accent"}`}
                  onClick={() =>
                    setFocusedCapabilityId((id) => (id === s.capabilityId ? null : s.capabilityId))
                  }
                >
                  {s.capabilityName}
                </button>
              ))}
            </div>
          </SectionCard>

          {focusedCapabilityId && focusedCompetencies.length > 0 && (
            <SectionCard title={t("evolution.chart.competency.title")} className="mb-6">
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

          <SectionCard title={t("evolution.timeline.title")} className="mb-6">
            {data.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("evolution.timeline.empty")}</p>
            ) : (
              <ul className="space-y-3">
                {[...data.events]
                  .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
                  .map((event) => {
                    const competency = data.competencySeries.find((c) => c.competencyId === event.competencyId);
                    return (
                      <li key={event.id} className="border-b border-border/60 pb-2 text-sm last:border-0">
                        <span className="text-xs text-muted-foreground">
                          {event.effectiveDate} ·{" "}
                          {event.sourceType === "MENTORING"
                            ? t("evolution.source.mentoring")
                            : t("evolution.source.assessment")}
                        </span>
                        <div>
                          <span className="font-medium">{competency?.competencyName ?? event.competencyId}</span>{" "}
                          {event.fromLevel ? `L${event.fromLevel} → ` : ""}L{event.toLevel}
                        </div>
                        {event.note && <p className="text-xs text-muted-foreground">{event.note}</p>}
                      </li>
                    );
                  })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title={t("evolution.comparison.title")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2">{t("evolution.comparison.competency")}</th>
                    <th className="py-2 text-center">{t("evolution.comparison.initial")}</th>
                    <th className="py-2 text-center">{t("evolution.comparison.current")}</th>
                    <th className="py-2 text-center">{t("evolution.comparison.delta")}</th>
                    <th className="py-2">{t("evolution.comparison.source")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedComparisons.map((c) => (
                    <tr key={c.competencyId} className="border-b border-border/60 last:border-0">
                      <td className="py-2 font-medium">{c.competencyName}</td>
                      <td className="py-2 text-center">{c.initialLevel ? `L${c.initialLevel}` : "—"}</td>
                      <td className="py-2 text-center">{c.currentLevel ? `L${c.currentLevel}` : "—"}</td>
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
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </>
  );
}
