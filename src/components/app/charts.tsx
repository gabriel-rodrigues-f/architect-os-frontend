import type { ReactElement, ReactNode } from "react";
import { lazy, Suspense, useState } from "react";

import { topByRelevance } from "@/lib/collections";
import { TruncationNotice } from "@/components/app/TruncationNotice";
import { useI18n } from "@/lib/i18n";

const CapabilityRadarFigure = lazy(() =>
  import("./charts-recharts").then((charts) => ({ default: charts.CapabilityRadarFigure })),
);

const ComparisonRadarFigure = lazy(() =>
  import("./charts-recharts").then((charts) => ({ default: charts.ComparisonRadarFigure })),
);

const EvolutionLineFigure = lazy(() =>
  import("./charts-recharts").then((charts) => ({ default: charts.EvolutionLineFigure })),
);

const ProficiencyTimelineFigure = lazy(() =>
  import("./charts-recharts").then((charts) => ({ default: charts.ProficiencyTimelineFigure })),
);

const LevelDistributionFigure = lazy(() =>
  import("./charts-recharts").then((charts) => ({ default: charts.LevelDistributionFigure })),
);

function ChartPlaceholder() {
  return <div aria-hidden="true" className="h-full w-full rounded-md bg-muted/40" />;
}

interface ChartFrameProps {
  label: string;

  height: number;

  isEmpty: boolean;
  emptyMessage: string;

  dataTable: ReactNode;
  children: ReactElement;
}

function ChartFrame({
  label,
  height,
  isEmpty,
  emptyMessage,
  dataTable,
  children,
}: ChartFrameProps) {
  if (isEmpty) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed border-border px-4 text-center"
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <figure className="m-0">
      <div style={{ height }} role="img" aria-label={label}>
        <Suspense fallback={<ChartPlaceholder />}>{children}</Suspense>
      </div>
      <figcaption className="sr-only">{dataTable}</figcaption>
    </figure>
  );
}

function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const MAX_RADAR_AXES = 12;

function RadarAxisNotice(props: {
  shown: number;
  total: number;
  showAll: boolean;
  onToggle: () => void;
}) {
  return (
    <TruncationNotice
      {...props}
      threshold={MAX_RADAR_AXES}
      className="mb-2 text-xs text-muted-foreground"
      messages={{
        showingAll: "chart.radar.showingAll",
        showingTopN: "chart.radar.showingTopN",
        showAll: "chart.radar.showAll",
        showTopOnly: "chart.radar.showTopOnly",
      }}
    />
  );
}

export interface RadarPoint {
  capability: string;
  atual: number;
  alvo: number;

  covered?: number;
  total?: number;
}

const LEVEL_SCALE_MIN = 1;
const LEVEL_SCALE_MAX = 5;

const clampToLevelScale = (value: number): number =>
  Math.min(LEVEL_SCALE_MAX, Math.max(LEVEL_SCALE_MIN, value));

export function CapabilityRadar({ data, height = 320 }: { data: RadarPoint[]; height?: number }) {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const visibleData = showAll
    ? data
    : topByRelevance(data, (d) => Math.abs(d.alvo - d.atual), MAX_RADAR_AXES);
  const plotData = visibleData.map((point) => ({
    ...point,
    atual: clampToLevelScale(point.atual),
    alvo: clampToLevelScale(point.alvo),
  }));

  const atual = t("chart.series.current");
  const alvo = t("chart.series.target");

  const withCoverage = data.some((d) => d.covered !== undefined);

  return (
    <>
      <RadarAxisNotice
        shown={visibleData.length}
        total={data.length}
        showAll={showAll}
        onToggle={() => setShowAll((v) => !v)}
      />
      <ChartFrame
        label={t("chart.radar.label")}
        height={height}
        isEmpty={data.length === 0}
        emptyMessage={t("chart.empty.radar")}
        dataTable={
          <DataTable
            caption={t("chart.radar.label")}
            columns={
              withCoverage
                ? [t("chart.axis.capability"), atual, alvo, t("chart.radar.coverageColumn")]
                : [t("chart.axis.capability"), atual, alvo]
            }
            rows={data.map((d) =>
              withCoverage
                ? [d.capability, d.atual, d.alvo, `${d.covered ?? 0}/${d.total ?? 0}`]
                : [d.capability, d.atual, d.alvo],
            )}
          />
        }
      >
        <CapabilityRadarFigure data={plotData} currentLabel={atual} targetLabel={alvo} />
      </ChartFrame>
    </>
  );
}

function variance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

export function ComparisonRadar({
  data,
  series,
  height = 360,
}: {
  data: Record<string, string | number>[];
  series: EvolutionSeries[];
  height?: number;
}) {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const seriesKeys = series.map((s) => s.key);
  const visibleData = showAll
    ? data
    : topByRelevance(
        data,
        (row) =>
          variance(seriesKeys.map((k) => row[k]).filter((v): v is number => typeof v === "number")),
        MAX_RADAR_AXES,
      );

  return (
    <>
      <RadarAxisNotice
        shown={visibleData.length}
        total={data.length}
        showAll={showAll}
        onToggle={() => setShowAll((v) => !v)}
      />
      <ChartFrame
        label={t("chart.comparison.label")}
        height={height}
        isEmpty={data.length === 0 || series.length === 0}
        emptyMessage={t("chart.empty.comparison")}
        dataTable={
          <DataTable
            caption={t("chart.comparison.label")}
            columns={[t("chart.axis.capability"), ...series.map((s) => s.label)]}
            rows={data.map((row) => [
              row["capability"] ?? "—",
              ...series.map((s) => row[s.key] ?? "—"),
            ])}
          />
        }
      >
        <ComparisonRadarFigure data={visibleData} series={series} />
      </ChartFrame>
    </>
  );
}

export interface EvolutionSeries {
  key: string;
  label: string;
}

export function EvolutionLine({
  data,
  series,
  xKey = "cycle",
  height = 280,
}: {
  data: Record<string, string | number>[];
  series: EvolutionSeries[];

  xKey?: string;
  height?: number;
}) {
  const { t } = useI18n();

  return (
    <ChartFrame
      label={t("chart.evolution.label")}
      height={height}
      isEmpty={data.length === 0 || series.length === 0}
      emptyMessage={t("chart.empty.evolution")}
      dataTable={
        <DataTable
          caption={t("chart.evolution.label")}
          columns={[t("chart.axis.cycle"), ...series.map((s) => s.label)]}
          rows={data.map((row) => [
            String(row[xKey] ?? ""),
            ...series.map((s) => row[s.key] ?? "—"),
          ])}
        />
      }
    >
      <EvolutionLineFigure data={data} series={series} xKey={xKey} />
    </ChartFrame>
  );
}

export interface ProficiencyPoint {
  date: string;
  level: number;
}

const LEVEL_NAMES: Record<number, string> = {
  1: "L1",
  2: "L2",
  3: "L3",
  4: "L4",
  5: "L5",
};

export function ProficiencyTimeline({
  data,
  label,
  height = 240,
}: {
  data: ProficiencyPoint[];
  label: string;
  height?: number;
}) {
  const { t } = useI18n();

  return (
    <ChartFrame
      label={label}
      height={height}
      isEmpty={data.length === 0}
      emptyMessage={t("chart.empty.evolution")}
      dataTable={
        <DataTable
          caption={label}
          columns={[t("chart.axis.date"), t("chart.axis.level")]}
          rows={data.map((d) => [d.date, LEVEL_NAMES[d.level] ?? String(d.level)])}
        />
      }
    >
      <ProficiencyTimelineFigure data={data} label={label} levelNames={LEVEL_NAMES} />
    </ChartFrame>
  );
}

export interface LevelDistributionRow {
  level: number;
  count: number;
}

export function LevelDistribution({
  data,
  height = 160,
}: {
  data: LevelDistributionRow[];
  height?: number;
}) {
  const { t } = useI18n();
  const label = t("chart.distribution.label");
  const rows = data.map((row) => ({
    level: LEVEL_NAMES[row.level] ?? String(row.level),
    count: row.count,
  }));

  return (
    <ChartFrame
      label={label}
      height={height}
      isEmpty={data.every((row) => row.count === 0)}
      emptyMessage={t("chart.empty.distribution")}
      dataTable={
        <DataTable
          caption={label}
          columns={[t("chart.axis.level"), t("chart.axis.count")]}
          rows={rows.map((row) => [row.level, row.count])}
        />
      }
    >
      <LevelDistributionFigure data={rows} label={label} />
    </ChartFrame>
  );
}
