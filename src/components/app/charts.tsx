import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

export function DomainRadar({
  data,
  height = 320,
}: {
  data: { domain: string; atual: number; alvo: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis
            dataKey="domain"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          />
          <PolarRadiusAxis
            domain={[0, 5]}
            tickCount={6}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          />
          <Radar
            name="Alvo"
            dataKey="alvo"
            stroke="var(--chart-4)"
            fill="var(--chart-4)"
            fillOpacity={0.12}
          />
          <Radar
            name="Atual"
            dataKey="atual"
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.35}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid var(--color-border)",
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EvolutionLine({
  data,
  series,
  height = 280,
}: {
  data: Record<string, string | number>[];
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="cycle" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
          <YAxis domain={[0, 5]} tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid var(--color-border)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
