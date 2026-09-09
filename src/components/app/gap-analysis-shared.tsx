import { useMemo } from "react";

import { GapBadge } from "@/components/app/ui-bits";
import { TruncationNotice } from "@/components/app/TruncationNotice";
import { Badge } from "@/components/ui/badge";
import { Selection } from "@/lib/selection";
import { topByRelevance } from "@/lib/collections";
import { useI18n } from "@/lib/i18n";
import { type ConsolidatedGapRow } from "@/lib/selectors";
import { useSelectors, useStore } from "@/lib/store";
import { useSearchParamList } from "@/hooks";
import { cn } from "@/lib/utils";
import { type AxisCoverage, RadarRows } from "@/lib/view-models";

export function useGapAnalysisData() {
  const store = useStore();
  const sel = useSelectors();

  const defaultSelected = useMemo(() => sel.activeProfessionals.map((a) => a.id), [sel]);
  const [selected, setSelected] = useSearchParamList("selected", () => defaultSelected);

  const professionals = useMemo(
    () => Selection.explicit(selected).apply(store.professionals),
    [selected, store.professionals],
  );

  /*
   * A MESMA RÉGUA DOS OUTROS RADARES (`RadarRows`): sem medida é ausência,
   * nunca zero. Zero é o CENTRO do radar, e aqui a afirmação era ainda maior
   * que na ficha — com o `?? 0` de antes a tela dizia "este TIME tem zero
   * nesta capacidade" onde o certo é "ninguém do recorte foi medido aqui".
   *
   * A nota de cobertura embaixo do radar é medida sobre o CATÁLOGO INTEIRO, de
   * propósito: o eixo sem ninguém medido sai do desenho, e é justamente a
   * frase "0 de N pessoas" que avisa que ele saiu.
   */
  const { radar, radarCoverage } = useMemo(() => {
    const twoDecimals = (value: number | undefined) =>
      value === undefined ? undefined : Number(value.toFixed(2));

    const measures = store.capabilities.map((capability) => {
      const { atual, alvo } = sel.teamAverageFor(capability.id, professionals);
      return {
        capability,
        avg: twoDecimals(atual.avg),
        target: twoDecimals(alvo.avg),
        coverage: { covered: atual.covered, total: atual.total },
      };
    });

    return {
      radar: RadarRows.currentAgainstTarget(measures),
      radarCoverage: measures.reduce<AxisCoverage>(
        (menor, measure) => (measure.coverage.covered < menor.covered ? measure.coverage : menor),
        measures[0]?.coverage ?? { covered: 0, total: 0 },
      ),
    };
  }, [professionals, store.capabilities, sel]);

  const priorities = useMemo(
    () => sel.consolidateProgressionGaps(professionals),
    [professionals, sel],
  );

  const mastery = useMemo(() => sel.consolidateMasteryGaps(professionals), [professionals, sel]);

  const { t } = useI18n();

  const scopeLabel =
    selected.length === 0
      ? t("gap.scope.none")
      : professionals.length === store.professionals.length
        ? t("gap.scope.wholeTeam")
        : professionals.length > 3
          ? t("gap.scope.count", { n: professionals.length })
          : professionals.map((a) => a.name.split(" ")[0]).join(", ") || t("gap.scope.empty");

  return {
    store,
    selected,
    setSelected,
    professionals,
    radar,
    radarCoverage,
    priorities,
    mastery,
    scopeLabel,
  };
}

/**
 * O cabeçalho de colunas fica fixo enquanto as linhas rolam (referência FIAP
 * 2026-09-06, §2 item 7): a tabela rola dentro do próprio contêiner, então o
 * ponto de fixação é o topo dele.
 */
const PINNED_COLUMN_HEADER = "sticky top-0 z-10 bg-card py-2";

const COLUMNS = [
  { key: "col.competency", centered: false },
  { key: "col.capability", centered: false },
  { key: "col.people", centered: true },
  { key: "col.currentAvg", centered: true },
  { key: "col.targetAvg", centered: true },
  { key: "col.avgGap", centered: true },
  { key: "col.classification", centered: false },
] as const;

export function GapTable({
  rows,
  capabilities,
  mastery = false,
}: {
  rows: ConsolidatedGapRow[];
  capabilities: { id: string; name: string }[];
  mastery?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="scroll-visible max-h-[480px] overflow-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                data-pinned
                className={cn(PINNED_COLUMN_HEADER, column.centered && "text-center")}
              >
                {t(column.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.competencyId} className="border-b border-border/60 last:border-0">
              <td className="py-2 font-medium">{row.name}</td>
              <td className="py-2 text-muted-foreground">
                {capabilities.find((c) => c.id === row.capabilityId)?.name}
              </td>
              <td
                className="py-2 text-center tabular-nums"
                title={row.professionalNames.join(", ")}
              >
                {row.people}
              </td>
              <td className="py-2 text-center tabular-nums">{row.avgFinal}</td>
              <td className="py-2 text-center tabular-nums">{row.avgTarget}</td>
              <td className="py-2 text-center tabular-nums">{row.avgGap}</td>
              <td className="py-2">
                {mastery ? (
                  <Badge variant="outline">{t("gap.mastery.badge", { n: row.maxGap })}</Badge>
                ) : (
                  <GapBadge gap={row.maxGap} />
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-3 text-sm text-muted-foreground">
                {t("gap.table.empty")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const MAX_HEATMAP_COLUMNS = 20;

export function capHeatmapColumns<C extends { id: string }>(
  capabilities: readonly C[],
  professionals: readonly { id: string }[],
  capabilityAveragesFor: (professionalId: string) => readonly {
    capability: { id: string };
    avg: number | undefined;
    target: number | undefined;
  }[],
  max = MAX_HEATMAP_COLUMNS,
): C[] {
  const worstGapByCapability = new Map<string, number>();
  if (capabilities.length > max) {
    for (const professional of professionals) {
      for (const row of capabilityAveragesFor(professional.id)) {
        if (row.avg === undefined || row.target === undefined) continue;
        const gap = row.target - row.avg;
        const prev = worstGapByCapability.get(row.capability.id) ?? -Infinity;
        if (gap > prev) worstGapByCapability.set(row.capability.id, gap);
      }
    }
  }

  return topByRelevance(capabilities, (c) => worstGapByCapability.get(c.id) ?? -Infinity, max);
}

export function HeatmapColumnsNotice(props: {
  shown: number;
  total: number;
  showAll: boolean;
  onToggle: () => void;
}) {
  return (
    <TruncationNotice
      {...props}
      threshold={MAX_HEATMAP_COLUMNS}
      messages={{
        showingAll: "heatmap.columns.showingAll",
        showingTopN: "heatmap.columns.showingTopN",
        showAll: "heatmap.columns.showAll",
        showTopOnly: "heatmap.columns.showTopOnly",
      }}
    />
  );
}
