import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import {
  ArchitectFilter,
  CapabilityRadar,
  EmptyState,
  GapBadge,
  GapClosureSection,
  NameList,
  PageHeader,
  SectionCard,
  TreatGapInPlanAction,
  useGapAnalysisData,
} from "@/components/app";
import type { ConsolidatedGapRow } from "@/lib/selectors";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useSelectors } from "@/lib/store";
import { FurthestFromTarget } from "@/lib/view-models";

export const Route = createFileRoute("/gap-analysis")({
  head: () => ({
    meta: [
      { title: "Prioridades de Desenvolvimento — Synapse" },
      {
        name: "description",
        content: "Radar de arquitetura e ranking de prioridades de desenvolvimento por pessoa.",
      },
      { property: "og:title", content: "Prioridades de Desenvolvimento — Synapse" },
      { property: "og:description", content: "Radar e prioridades de desenvolvimento." },
    ],
  }),
  component: GapPage,
});

function GapPage() {
  const { t } = useI18n();
  const help = usePageHelp("gapAnalysis");
  const sel = useSelectors();
  const {
    store,
    selected,
    setSelected,
    architects,
    radar,
    radarCoverage,
    blocking,
    opportunity,
    scopeLabel,
  } = useGapAnalysisData();

  const furthestFromTarget = useMemo(
    () => new FurthestFromTarget(architects, sel.progressionGapsFor),
    [architects, sel],
  );

  return (
    <>
      <PageHeader
        title={t("gap.title")}
        description={t("gap.subtitle")}
        help={help}
        actions={
          <ArchitectFilter
            architects={store.architects}
            selected={selected}
            onChange={setSelected}
          />
        }
      />

      {architects.length === 0 ? (
        <EmptyState
          title={t("gap.empty")}
          hint={
            store.architects.length === 0 ? t("gap.empty.noArchitects") : t("gap.empty.filterHint")
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SectionCard
            title={t("gap.radar.title")}
            description={t("gap.radar.subtitle", { escopo: scopeLabel })}
          >
            <CapabilityRadar data={radar} />
            {radarCoverage.total > 0 && radarCoverage.covered < radarCoverage.total && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("gap.radar.coverage", {
                  covered: radarCoverage.covered,
                  total: radarCoverage.total,
                })}
              </p>
            )}
          </SectionCard>

          <SectionCard
            className="flex flex-col"
            title={t("gap.priorities.title")}
            description={t("gap.priorities.subtitle", { n: architects.length })}
          >
            <div className="max-h-[460px] space-y-4 overflow-y-auto pr-1">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-destructive">
                  {t("gap.priorities.blocking.title")}
                </h3>
                <GapPriorityList
                  rows={blocking}
                  emptyLabel={t("gap.priorities.blocking.none")}
                  furthestFromTarget={furthestFromTarget}
                />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("gap.priorities.opportunity.title")}
                </h3>
                <GapPriorityList
                  rows={opportunity}
                  emptyLabel={t("gap.priorities.opportunity.none")}
                  furthestFromTarget={furthestFromTarget}
                />
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      <div className="mt-6">
        <GapClosureSection />
      </div>
    </>
  );
}

function GapPriorityList({
  rows,
  emptyLabel,
  furthestFromTarget,
}: {
  rows: ConsolidatedGapRow[];
  emptyLabel: string;
  furthestFromTarget: FurthestFromTarget;
}) {
  const { t } = useI18n();
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <ol className="space-y-2">
      {rows.slice(0, 8).map((row, i) => (
        <li
          key={row.competencyId}
          className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2"
        >
          <div className="min-w-0 text-sm">
            <p>
              <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
              {row.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("gap.priorities.peopleCount", { n: row.people })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("gap.priorities.avgGapLine", { avg: row.avgGap })}
            </p>
            <p className="text-xs text-muted-foreground">
              <NameList names={row.architectNames} />
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <GapBadge gap={row.maxGap} />
            <TreatGapInPlanAction
              architectId={furthestFromTarget.architectFor(row.competencyId)}
              competencyId={row.competencyId}
              label={t("gap.priorities.action")}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
