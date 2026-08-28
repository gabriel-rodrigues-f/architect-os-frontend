import { createFileRoute, Link } from "@tanstack/react-router";

import {
  ArchitectFilter,
  CapabilityRadar,
  EmptyState,
  GapBadge,
  NameList,
  PageHeader,
  SectionCard,
  useGapAnalysisData,
} from "@/components/app";
import type { ConsolidatedGapRow } from "@/lib/selectors";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";

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
                <GapPriorityList rows={blocking} emptyLabel={t("gap.priorities.blocking.none")} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("gap.priorities.opportunity.title")}
                </h3>
                <GapPriorityList
                  rows={opportunity}
                  emptyLabel={t("gap.priorities.opportunity.none")}
                />
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </>
  );
}

function GapPriorityList({ rows, emptyLabel }: { rows: ConsolidatedGapRow[]; emptyLabel: string }) {
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
            <Link
              to="/development-plans"
              className="whitespace-nowrap text-xs text-primary hover:underline"
            >
              {t("gap.priorities.action")}
            </Link>
          </div>
        </li>
      ))}
    </ol>
  );
}
