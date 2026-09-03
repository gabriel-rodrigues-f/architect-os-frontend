import {
  Bar,
  BarChart,
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
  Symbols,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useDisplayPreferences, useNarrowViewport } from "@/hooks";
import {
  axisTick,
  CHART_INK,
  ChartPalette,
  RotuloDeEixo,
  tooltipStyle,
  type SeriesStyle,
} from "@/lib/design";
import type { EvolutionSeries, ProficiencyPoint, RadarPoint } from "@/components/app/charts";

const FALLBACK_STYLE: SeriesStyle = { color: "var(--chart-1)", symbol: "circle" };

/**
 * Tick do eixo do radar: o nome INTEIRO da capacidade, quebrado por palavras
 * (`RotuloDeEixo`). O tick padrão do recharts é uma linha só — nomes como
 * "Engenharia de Plataforma" saíam cortados, e era por isso que o eixo
 * mostrava o `short` de uma palavra. Cada linha é um `<tspan>`; o bloco é
 * centrado verticalmente no ponto do eixo para não invadir o polígono.
 */
function RadarAxisTick(props: {
  x?: number;
  y?: number;
  textAnchor?: "start" | "end" | "inherit" | "middle";
  payload?: { value?: unknown };
}) {
  const { x: centroX = 0, y: centroY = 0, textAnchor = "middle", payload } = props;
  const linhas = RotuloDeEixo.emLinhas(String(payload?.value ?? ""));
  const alturaDaLinha = axisTick.fontSize + 2;
  const deslocamentoInicial = -((linhas.length - 1) * alturaDaLinha) / 2;
  return (
    <text
      x={centroX}
      y={centroY}
      textAnchor={textAnchor}
      fontSize={axisTick.fontSize}
      fill={axisTick.fill}
    >
      {linhas.map((linha, indice) => (
        <tspan key={linha} x={centroX} dy={indice === 0 ? deslocamentoInicial : alturaDaLinha}>
          {linha}
        </tspan>
      ))}
    </text>
  );
}

function seriesDot(estilo: SeriesStyle) {
  return (props: { cx?: number; cy?: number; key?: string }) => {
    if (props.cx === undefined || props.cy === undefined) return <g key={props.key} />;
    return (
      <Symbols
        key={props.key}
        cx={props.cx}
        cy={props.cy}
        type={estilo.symbol}
        size={56}
        fill={estilo.color}
        stroke={CHART_INK.surface}
        strokeWidth={1}
      />
    );
  };
}

export function CapabilityRadarFigure({
  data,
  currentLabel,
  targetLabel,
}: {
  data: RadarPoint[];
  currentLabel: string;
  targetLabel: string;
}) {
  const { reducedMotion, increasedContrast } = useDisplayPreferences();
  const estreita = useNarrowViewport();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius={estreita ? "65%" : "72%"}>
        <PolarGrid stroke={CHART_INK.grid} />
        <PolarAngleAxis dataKey="capability" tick={<RadarAxisTick />} />
        <PolarRadiusAxis domain={[1, 5]} tickCount={5} tick={false} axisLine={false} />
        <Radar
          name={targetLabel}
          dataKey="alvo"
          legendType="plainline"
          stroke={CHART_INK.reference}
          strokeDasharray="4 3"
          strokeWidth={increasedContrast ? 2 : 1}
          fill={CHART_INK.reference}
          fillOpacity={0.08}
          isAnimationActive={!reducedMotion}
        />
        <Radar
          name={currentLabel}
          dataKey="atual"
          legendType="circle"
          stroke="var(--chart-1)"
          strokeWidth={increasedContrast ? 3 : 2}
          fill="var(--chart-1)"
          fillOpacity={increasedContrast ? 0.16 : 0.28}
          dot={seriesDot(FALLBACK_STYLE)}
          isAnimationActive={!reducedMotion}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.axis }} />
        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: CHART_INK.surfaceText }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function ComparisonRadarFigure({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: EvolutionSeries[];
}) {
  const { reducedMotion, increasedContrast } = useDisplayPreferences();
  const estreita = useNarrowViewport();

  const palette = new ChartPalette();
  const estilos = palette.forKeys(series.map((s) => s.key));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius={estreita ? "65%" : "72%"}>
        <PolarGrid stroke={CHART_INK.grid} />
        <PolarAngleAxis dataKey="capability" tick={<RadarAxisTick />} />
        <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
        {series.map((s, i) => {
          const estilo = estilos[i] ?? FALLBACK_STYLE;
          return (
            <Radar
              key={s.key}
              name={s.label}
              dataKey={s.key}
              legendType={estilo.symbol}
              stroke={estilo.color}
              strokeWidth={increasedContrast ? 3 : 2}
              {...(estilo.dash ? { strokeDasharray: estilo.dash } : {})}
              fill={estilo.color}
              fillOpacity={increasedContrast ? 0.06 : 0.12}
              dot={seriesDot(estilo)}
              isAnimationActive={!reducedMotion}
            />
          );
        })}
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_INK.axis }} />
        <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: CHART_INK.surfaceText }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function EvolutionLineFigure({
  data,
  series,
  xKey,
}: {
  data: Record<string, string | number>[];
  series: EvolutionSeries[];
  xKey: string;
}) {
  const { reducedMotion, increasedContrast } = useDisplayPreferences();

  const palette = new ChartPalette();
  const estilos = palette.forKeys(series.map((s) => s.key));

  const pontos = data.length <= 12;

  return (
    <ResponsiveContainer width="100%" height="100%">
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
          const estilo = estilos[i] ?? FALLBACK_STYLE;
          return (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              legendType={estilo.symbol}
              stroke={estilo.color}
              strokeWidth={increasedContrast ? 3 : 2}
              {...(estilo.dash ? { strokeDasharray: estilo.dash } : {})}
              dot={pontos ? seriesDot(estilo) : false}
              activeDot={{ r: 5 }}
              isAnimationActive={!reducedMotion}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ProficiencyTimelineFigure({
  data,
  label,
  levelNames,
}: {
  data: ProficiencyPoint[];
  label: string;
  levelNames: Record<number, string>;
}) {
  const { reducedMotion, increasedContrast } = useDisplayPreferences();

  return (
    <ResponsiveContainer width="100%" height="100%">
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
          strokeWidth={increasedContrast ? 3 : 2}
          dot={seriesDot(FALLBACK_STYLE)}
          activeDot={{ r: 6 }}
          isAnimationActive={!reducedMotion}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LevelDistributionFigure({
  data,
  label,
}: {
  data: { level: string; count: number }[];
  label: string;
}) {
  const { reducedMotion, increasedContrast } = useDisplayPreferences();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -24, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INK.grid} vertical={false} />
        <XAxis dataKey="level" tick={axisTick} stroke={CHART_INK.grid} />
        <YAxis allowDecimals={false} tick={axisTick} stroke={CHART_INK.grid} />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={{ color: CHART_INK.surfaceText }}
          cursor={{ fill: CHART_INK.grid, fillOpacity: 0.4 }}
        />
        <Bar
          dataKey="count"
          name={label}
          fill="var(--chart-1)"
          {...(increasedContrast ? { stroke: CHART_INK.surfaceText, strokeWidth: 1 } : {})}
          radius={[3, 3, 0, 0]}
          isAnimationActive={!reducedMotion}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
