import type { ReactElement, ReactNode } from "react";
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

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { axisTick, CHART_INK, ChartPalette, tooltipStyle } from "@/lib/design/chart";
import { useI18n } from "@/lib/i18n";

/**
 * Gráficos do Synapse.
 *
 * ## Acessibilidade
 *
 * Um `<svg>` de gráfico é opaco para leitor de tela — o dado existe como
 * coordenada, não como texto. Por isso cada gráfico aqui sai em `<figure>` com
 * legenda e acompanhado da **mesma informação em tabela**, escondida
 * visualmente mas presente na árvore de acessibilidade. É o caminho
 * recomendado pelo WCAG para conteúdo gráfico (1.1.1) e o único que também
 * serve a quem lê por teclado ou copia o valor.
 *
 * ## Movimento
 *
 * A animação de entrada é desligada quando o sistema pede menos movimento.
 * Crescimento de linha e expansão de polígono são exatamente o tipo de
 * movimento amplo que causa desconforto vestibular.
 */

/* ------------------------------------------------------------------ */
/* Moldura comum                                                       */
/* ------------------------------------------------------------------ */

interface ChartFrameProps {
  /** Nome acessível do gráfico. */
  label: string;
  /** Altura da área de plotagem, em px. */
  height: number;
  /** Não há o que plotar — mostra o vazio no lugar de uma grade sozinha. */
  isEmpty: boolean;
  emptyMessage: string;
  /** Mesma informação em tabela, para leitor de tela. */
  dataTable: ReactNode;
  children: ReactElement;
}

/**
 * Moldura única dos gráficos: vazio, rótulo acessível, tabela equivalente e
 * altura. Cada gráfico só descreve o que desenha.
 *
 * O vazio importa mais do que parece — sem ele, uma tela sem avaliações
 * mostrava eixos e grade sem nenhuma linha, o que se lê como "quebrou", e não
 * como "ainda não há dado".
 */
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

/** Tabela equivalente ao gráfico — invisível, mas lida e navegável. */
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

/* ------------------------------------------------------------------ */
/* Radar por capacidade                                                   */
/* ------------------------------------------------------------------ */

export interface RadarPoint {
  capability: string;
  atual: number;
  alvo: number;
  /** Quantas pessoas do recorte contribuíram para `atual`, de quantas no recorte total. */
  covered?: number;
  total?: number;
}

export function CapabilityRadar({ data, height = 320 }: { data: RadarPoint[]; height?: number }) {
  const { t } = useI18n();
  const semMovimento = useReducedMotion();

  const atual = t("chart.series.current");
  const alvo = t("chart.series.target");
  /** Só entra a coluna quando quem chamou de fato manda cobertura — os outros dois usos do componente não mandam. */
  const withCoverage = data.some((d) => d.covered !== undefined);

  return (
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
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={CHART_INK.grid} />
        <PolarAngleAxis dataKey="capability" tick={axisTick} />
        {/*
          Os rótulos do eixo radial saem: numeravam 0..5 por cima do polígono,
          competindo com o dado. A escala continua legível pelos anéis da grade
          e pelo tooltip, e a tabela equivalente traz o número exato.
        */}
        <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
        {/*
          O esperado vem primeiro, para o atual desenhar por cima: é o valor
          real que se quer ler, a referência é o fundo. Tracejado e quase
          acromático pela mesma razão — e para que a distinção sobreviva à
          impressão em preto e branco.
        */}
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
  );
}

/* ------------------------------------------------------------------ */
/* Evolução por ciclo                                                  */
/* ------------------------------------------------------------------ */

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
  /** Campo do eixo horizontal. Era fixo em `cycle`, o que travava o reuso. */
  xKey?: string;
  height?: number;
}) {
  const { t } = useI18n();
  const semMovimento = useReducedMotion();

  /*
    A paleta é criada aqui, e não recebida por prop: a cor de uma série é
    decisão do sistema de design, não de quem chama. Antes cada tela montava o
    próprio array de `var(--chart-N)` e o mesmo capacidade saía de cores
    diferentes em telas diferentes.
  */
  const palette = new ChartPalette();
  const estilos = palette.forKeys(series.map((s) => s.key));

  /* Um ponto só não forma linha — sem marcador, o gráfico sai vazio. */
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

/* ------------------------------------------------------------------ */
/* Linha temporal de nível observado/oficial (Rodada 10)               */
/* ------------------------------------------------------------------ */

export interface ProficiencyPoint {
  /** ISO 8601 (yyyy-mm-dd) — o eixo X é categórico, não temporal contínuo. */
  date: string;
  level: number;
}

/**
 * ORIENTACAO-DECIMA-RODADA, Seção 24 — nível é discreto (L1-L5): uma linha
 * `monotone` entre dois pontos sugere uma transição gradual que nunca foi
 * observada (ex.: "L2,5" em fevereiro, quando só sabemos L2 em janeiro e L3
 * em março). `stepAfter` mantém o nível anterior constante até o instante
 * exato da próxima observação — a única leitura fiel ao dado.
 */
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
