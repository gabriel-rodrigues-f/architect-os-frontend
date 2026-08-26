import { useMemo } from "react";

import { GapBadge } from "@/components/app/ui-bits";
import { TruncationNotice } from "@/components/app/TruncationNotice";
import { Badge } from "@/components/ui/badge";
import { Selection } from "@/lib/selection";
import { topByRelevance } from "@/lib/collections";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { type ConsolidatedGapRow } from "@/lib/selectors";
import { useSelectors, useStore } from "@/lib/store";
import { useSearchParamList } from "@/hooks/use-search-param";

export function useGapAnalysisData() {
  const store = useStore();
  const sel = useSelectors();
  const user = useCurrentUser();

  const defaultSelected = useMemo(() => sel.visibleArchitects(user).map((a) => a.id), [sel, user]);
  const [selected, setSelected] = useSearchParamList("selected", () => defaultSelected);

  const architects = Selection.explicit(selected).apply(store.architects);

  const radar = useMemo(() => {
    return store.capabilities.map((cat) => {
      const { atual, alvo } = sel.teamAverageFor(cat.id, architects);
      return {
        capability: sel.capabilityShortLabel(cat),
        atual: Number((atual.avg ?? 0).toFixed(2)),
        alvo: Number((alvo.avg ?? 0).toFixed(2)),
        covered: atual.covered,
        total: atual.total,
      };
    });
  }, [architects, store.capabilities, sel]);

  const radarCoverage = radar.reduce(
    (min, r) => (r.covered < min.covered ? r : min),
    radar[0] ?? { covered: 0, total: 0 },
  );

  const progression = useMemo(() => sel.consolidateProgressionGaps(architects), [architects, sel]);
  const blocking = useMemo(
    () => progression.filter((r) => r.requirementType === "RESTRICTIVE"),
    [progression],
  );
  const opportunity = useMemo(
    () => progression.filter((r) => r.requirementType === "NON_RESTRICTIVE"),
    [progression],
  );

  const mastery = useMemo(() => sel.consolidateMasteryGaps(architects), [architects, sel]);

  const { t } = useI18n();

  const scopeLabel =
    selected.length === 0
      ? t("gap.scope.none")
      : architects.length === store.architects.length
        ? t("gap.scope.wholeTeam")
        : architects.length > 3
          ? t("gap.scope.count", { n: architects.length })
          : architects.map((a) => a.name.split(" ")[0]).join(", ") || t("gap.scope.empty");

  return {
    store,
    selected,
    setSelected,
    architects,
    radar,
    radarCoverage,
    blocking,
    opportunity,
    mastery,
    scopeLabel,
  };
}

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
    <div className="max-h-[480px] overflow-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="sticky top-0 z-10 bg-card py-2">
              {t("col.competency")}
            </th>
            <th scope="col" className="sticky top-0 z-10 bg-card py-2">
              {t("col.capability")}
            </th>
            {!mastery && (
              <th scope="col" className="sticky top-0 z-10 bg-card py-2">
                {t("col.type")}
              </th>
            )}
            <th scope="col" className="sticky top-0 z-10 bg-card py-2 text-center">
              {t("col.people")}
            </th>
            <th scope="col" className="sticky top-0 z-10 bg-card py-2 text-center">
              {t("col.currentAvg")}
            </th>
            <th scope="col" className="sticky top-0 z-10 bg-card py-2 text-center">
              {t("col.targetAvg")}
            </th>
            <th scope="col" className="sticky top-0 z-10 bg-card py-2 text-center">
              {t("col.avgGap")}
            </th>
            <th scope="col" className="sticky top-0 z-10 bg-card py-2">
              {t("col.classification")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.competencyId} className="border-b border-border/60 last:border-0">
              <td className="py-2 font-medium">{row.name}</td>
              <td className="py-2 text-muted-foreground">
                {capabilities.find((c) => c.id === row.capabilityId)?.name}
              </td>
              {!mastery && (
                <td className="py-2">
                  <Badge variant={row.requirementType === "RESTRICTIVE" ? "outline" : "secondary"}>
                    {row.requirementType === "RESTRICTIVE"
                      ? t("gap.type.blocking")
                      : t("gap.type.opportunity")}
                  </Badge>
                </td>
              )}
              <td className="py-2 text-center tabular-nums" title={row.architectNames.join(", ")}>
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
              <td colSpan={mastery ? 7 : 8} className="py-3 text-sm text-muted-foreground">
                {t("gap.table.empty")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const MAX_HEATMAP_COLUMNS = 12;

export function capHeatmapColumns<C extends { id: string }>(
  capabilities: readonly C[],
  architects: readonly { id: string }[],
  capabilityAveragesFor: (architectId: string) => readonly {
    capability: { id: string };
    avg: number | undefined;
    target: number | undefined;
  }[],
  max = MAX_HEATMAP_COLUMNS,
): C[] {
  const worstGapByCapability = new Map<string, number>();
  if (capabilities.length > max) {
    for (const architect of architects) {
      for (const row of capabilityAveragesFor(architect.id)) {
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
