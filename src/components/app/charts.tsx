import type { ReactElement, ReactNode } from "react";
import { lazy, Suspense, useState } from "react";

import { topByRelevance } from "@/lib/collections";
import { TruncationNotice } from "@/components/app/TruncationNotice";
import { useI18n } from "@/lib/i18n";
import { EmptySubject } from "@/lib/empty-subject";

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

const AssessmentCoverageFigure = lazy(() =>
  import("./charts-recharts").then((charts) => ({ default: charts.AssessmentCoverageFigure })),
);

const GapSeverityFigure = lazy(() =>
  import("./charts-recharts").then((charts) => ({ default: charts.GapSeverityFigure })),
);

function ChartPlaceholder() {
  return <div aria-hidden="true" className="h-full w-full rounded-md bg-muted/40" />;
}

interface ChartFrameProps {
  label: string;

  height: number;

  isEmpty: boolean;
  /** A LINHA 1 do vazio, no molde da casa ("Nenhum nível registrado neste ciclo"). */
  emptyMessage: string;
  /** A LINHA 2: a regra de negócio que explica por que o gráfico está vazio. */
  emptyHint: string;

  dataTable: ReactNode;
  children: ReactElement;
}

function ChartFrame({
  label,
  height,
  isEmpty,
  emptyMessage,
  emptyHint,
  dataTable,
  children,
}: ChartFrameProps) {
  if (isEmpty) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed border-border px-4 text-center"
        style={{ height }}
      >
        <div>
          <p className="text-body text-foreground">{emptyMessage}</p>
          <p className="mt-1 text-meta text-muted-foreground">{emptyHint}</p>
        </div>
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

/**
 * SEM MEDIDA É `null`, NUNCA ZERO — a mesma régua do radar comparativo
 * (`RadarRows`). Zero é o CENTRO do radar: um eixo sem medida desenhado em
 * zero afirma "esta pessoa tem zero aqui" e faz a aresta atravessar o
 * polígono. `null` + `connectNulls` liga os pontos que existem.
 */
export interface RadarPoint {
  capability: string;
  atual: number | null;
  alvo: number | null;

  covered?: number;
  total?: number;
}

/**
 * A ESCALA DE NÍVEL (1 a 5) E O QUE ELA FAZ COM A AUSÊNCIA.
 *
 * Ausência não é zero, e as três perguntas que o radar faz sobre um nível
 * respondem a essa distinção do mesmo jeito: quem não tem medida não é
 * espremido para dentro da escala, não é ordenado contra o centro e não vira
 * um número na tabela de dados.
 */
class LevelScale {
  private static readonly MIN = 1;
  private static readonly MAX = 5;
  private static readonly NO_MEASURE = "—";

  /** Dentro da escala — e `null` continua `null`. */
  static clamp(value: number | null): number | null {
    if (value === null) return null;
    return Math.min(LevelScale.MAX, Math.max(LevelScale.MIN, value));
  }

  /**
   * Quanto o eixo INFORMA, para escolher os que cabem no radar: a distância
   * entre o que se tem e o que se espera. Eixo com uma medida só é ordenado
   * pela medida que tem — nunca por uma distância inventada contra o centro.
   */
  static distance(point: RadarPoint): number {
    if (point.atual === null) return point.alvo ?? 0;
    if (point.alvo === null) return point.atual;
    return Math.abs(point.alvo - point.atual);
  }

  /** A célula da tabela de dados: o número, ou o traço de "não há medida". */
  static cell(value: number | null): string | number {
    return value ?? LevelScale.NO_MEASURE;
  }
}

export function CapabilityRadar({ data, height = 320 }: { data: RadarPoint[]; height?: number }) {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const visibleData = showAll ? data : topByRelevance(data, LevelScale.distance, MAX_RADAR_AXES);
  const plotData = visibleData.map((point) => ({
    ...point,
    atual: LevelScale.clamp(point.atual),
    alvo: LevelScale.clamp(point.alvo),
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
        emptyMessage={EmptySubject.LEVEL.titleIn(t, "empty.context.recorded")}
        emptyHint={t("chart.empty.radar.hint")}
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
                ? [
                    d.capability,
                    LevelScale.cell(d.atual),
                    LevelScale.cell(d.alvo),
                    `${d.covered ?? 0}/${d.total ?? 0}`,
                  ]
                : [d.capability, LevelScale.cell(d.atual), LevelScale.cell(d.alvo)],
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
  data: Record<string, string | number | null>[];
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
        emptyMessage={EmptySubject.PROFESSIONAL.titleIn(t, "empty.context.selected")}
        emptyHint={t("chart.empty.comparison")}
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
  data: Record<string, string | number | null>[];
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
      emptyMessage={EmptySubject.CYCLE.titleIn(t, "empty.context.completedToCompare")}
      emptyHint={t("chart.empty.evolution")}
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
      emptyMessage={EmptySubject.CYCLE.titleIn(t, "empty.context.completedToCompare")}
      emptyHint={t("chart.empty.evolution")}
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
      emptyMessage={EmptySubject.SCORE.titleIn(t, "empty.context.inThisCycle")}
      emptyHint={t("chart.empty.distribution.hint")}
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

export interface CoverageSlice {
  status: string;
  count: number;
  color: string;
}

/**
 * A cobertura da avaliação do ciclo como rosca — o painel do admin dizia
 * "3 de 5 concluídas · 1 em revisão" numa frase; a rosca diz o mesmo de
 * relance, com a cor de cada situação.
 */
export function AssessmentCoverageChart({
  data,
  height = 220,
}: {
  data: CoverageSlice[];
  height?: number;
}) {
  const { t } = useI18n();
  const label = t("chart.coverage.label");
  return (
    <ChartFrame
      label={label}
      height={height}
      isEmpty={data.every((slice) => slice.count === 0)}
      emptyMessage={t("chart.empty.coverage.title")}
      emptyHint={t("chart.empty.coverage")}
      dataTable={
        <DataTable
          caption={label}
          columns={[t("chart.axis.status"), t("chart.axis.count")]}
          rows={data.map((slice) => [slice.status, slice.count])}
        />
      }
    >
      <AssessmentCoverageFigure data={data} />
    </ChartFrame>
  );
}

export interface SeverityBar {
  severity: string;
  count: number;
  color: string;
}

/** As distâncias do time por severidade, na cor da severidade. */
export function GapSeverityChart({ data, height = 220 }: { data: SeverityBar[]; height?: number }) {
  const { t } = useI18n();
  const label = t("chart.severity.label");
  return (
    <ChartFrame
      label={label}
      height={height}
      isEmpty={data.every((bar) => bar.count === 0)}
      emptyMessage={t("chart.empty.severity")}
      emptyHint={t("chart.empty.severity.hint")}
      dataTable={
        <DataTable
          caption={label}
          columns={[t("chart.axis.severity"), t("chart.axis.count")]}
          rows={data.map((bar) => [bar.severity, bar.count])}
        />
      }
    >
      <GapSeverityFigure data={data} label={t("chart.axis.count")} />
    </ChartFrame>
  );
}
