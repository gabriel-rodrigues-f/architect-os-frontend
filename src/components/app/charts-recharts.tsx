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
import type { EvolutionSeries, ProficiencyPoint, RadarPoint } from "@/components/app/charts";

export function CapabilityRadarFigure({
  data,
  currentLabel,
  targetLabel,
}: {
  data: RadarPoint[];
  currentLabel: string;
  targetLabel: string;
}) {
  const semMovimento = useReducedMotion();
  const estreita = useNarrowViewport();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius={estreita ? "65%" : "72%"}>
        <PolarGrid stroke={CHART_INK.grid} />
        <PolarAngleAxis dataKey="capability" tick={axisTick} />
        <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
        <Radar
          name={targetLabel}
          dataKey="alvo"
          stroke={CHART_INK.reference}
          strokeDasharray="4 3"
          fill={CHART_INK.reference}
          fillOpacity={0.08}
          isAnimationActive={!semMovimento}
        />
        <Radar
          name={currentLabel}
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
  const semMovimento = useReducedMotion();
  const estreita = useNarrowViewport();

  const palette = new ChartPalette();
  const estilos = palette.forKeys(series.map((s) => s.key));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius={estreita ? "65%" : "72%"}>
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
  const semMovimento = useReducedMotion();

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
  const semMovimento = useReducedMotion();

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
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
          isAnimationActive={!semMovimento}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
