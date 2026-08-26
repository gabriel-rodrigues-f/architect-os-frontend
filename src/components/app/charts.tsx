import type { ReactElement, ReactNode } from "react";
import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useNarrowViewport, useReducedMotion } from "@/hooks";
import { axisTick, CHART_INK, ChartPalette, tooltipStyle } from "@/lib/design";
import { topByRelevance } from "@/lib/collections";
import { TruncationNotice } from "@/components/app/TruncationNotice";
import { useI18n } from "@/lib/i18n";

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
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
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

export function CapabilityRadar({ data, height = 320 }: { data: RadarPoint[]; height?: number }) {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const visibleData = showAll
    ? data
    : topByRelevance(data, (d) => Math.abs(d.alvo - d.atual), MAX_RADAR_AXES);
  const semMovimento = useReducedMotion();
  const estreita = useNarrowViewport();

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
        <RadarChart data={visibleData} outerRadius={estreita ? "65%" : "72%"}>
          <PolarGrid stroke={CHART_INK.grid} />
          <PolarAngleAxis dataKey="capability" tick={axisTick} />
          {}
          <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
          {}
          <Radar
            name={alvo}
            dataKey="alvo"
            stroke={CHART_INK.reference}
            strokeDasharray="4 3"
            fill={CHART_INK.reference}
            fillOpacity={0.08}
            isAnimationActive={!semMovimento}
          />
          <Radar
            name={atual}
            dataKey="atual"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="var(--chart-1)"
            fillOpacity={0.28}
            isAnimationActive={!semMovimento}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.axis }} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: CHART_INK.surfaceText }} />
        </RadarChart>
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
  const semMovimento = useReducedMotion();
  const estreita = useNarrowViewport();

  const palette = new ChartPalette();
  const estilos = palette.forKeys(series.map((s) => s.key));

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
        <RadarChart data={visibleData} outerRadius={estreita ? "65%" : "72%"}>
          <PolarGrid stroke={CHART_INK.grid} />
          <PolarAngleAxis dataKey="capability" tick={axisTick} />
          <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
          {series.map((s, i) => {
            const estilo = estilos[i] ?? { color: "var(--chart-1)" };
            return (
              <Radar
                key={s.key}
                name={s.label}
                dataKey={s.key}
                stroke={estilo.color}
                strokeWidth={2}
                {...(estilo.dash ? { strokeDasharray: estilo.dash } : {})}
                fill={estilo.color}
                fillOpacity={0.12}
                isAnimationActive={!semMovimento}
              />
            );
          })}
          <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.axis }} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: CHART_INK.surfaceText }} />
        </RadarChart>
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
  const semMovimento = useReducedMotion();

  const palette = new ChartPalette();
  const estilos = palette.forKeys(series.map((s) => s.key));

  const pontos = data.length <= 12;

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
      <LineChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INK.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={axisTick} stroke={CHART_INK.grid} />
        <YAxis domain={[0, 5]} tickCount={6} tick={axisTick} stroke={CHART_INK.grid} />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={{ color: CHART_INK.surfaceText }}
          cursor={{ stroke: CHART_INK.grid }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.axis }} />
        {series.map((s, i) => {
          const estilo = estilos[i] ?? { color: "var(--chart-1)" };
          return (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={estilo.color}
              strokeWidth={2}
              {...(estilo.dash ? { strokeDasharray: estilo.dash } : {})}
              dot={pontos}
              activeDot={{ r: 5 }}
              isAnimationActive={!semMovimento}
            />
          );
        })}
      </LineChart>
    </ChartFrame>
  );
}

export interface ProficiencyPoint {
  date: string;
  level: number;
}

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
  const semMovimento = useReducedMotion();
  const levelNames: Record<number, string> = {
    1: "L1",
    2: "L2",
    3: "L3",
    4: "L4",
    5: "L5",
  };

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
          rows={data.map((d) => [d.date, levelNames[d.level] ?? String(d.level)])}
        />
      }
    >
      <LineChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INK.grid} vertical={false} />
        <XAxis dataKey="date" tick={axisTick} stroke={CHART_INK.grid} />
        <YAxis
          domain={[1, 5]}
          ticks={[1, 2, 3, 4, 5]}
          tickFormatter={(v: number) => levelNames[v] ?? String(v)}
          tick={axisTick}
          stroke={CHART_INK.grid}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={{ color: CHART_INK.surfaceText }}
          cursor={{ stroke: CHART_INK.grid }}
          formatter={(value: number) => levelNames[value] ?? String(value)}
        />
        <Line
          type="stepAfter"
          dataKey="level"
          name={label}
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
          isAnimationActive={!semMovimento}
        />
      </LineChart>
    </ChartFrame>
  );
}
