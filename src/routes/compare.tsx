import { createFileRoute } from "@tanstack/react-router";
import { Radar, Table2 } from "lucide-react";
import { useState } from "react";

import {
  ArchitectFilter,
  ComparisonRadar,
  EmptyState,
  type EvolutionSeries,
  LevelHeatCell,
  LevelScaleKey,
  OutOfReachScreen,
  PageHeader,
  SectionCard,
  ViewToggle,
} from "@/components/app";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { requireTeamAnalysisReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { Selection } from "@/lib/selection";
import { useSelectors, useStore } from "@/lib/store";
import { useSearchParamList } from "@/hooks";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Comparativo de Profissionais — Synapse" },
      {
        name: "description",
        content: "Comparação lado a lado do nível de capacidades entre profissionais específicos.",
      },
      { property: "og:title", content: "Comparativo de Profissionais — Synapse" },
      { property: "og:description", content: "Radar sobreposto e tabela lado a lado por pessoa." },
    ],
  }),
  beforeLoad: requireTeamAnalysisReach,
  component: ComparePage,
});

type ComparisonView = "radar" | "table";

function ComparePage() {
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp("compare");
  const canAnalyzeTeam = defaultUiAuthorizationPolicy.canAnalyzeTeam(user);

  if (!canAnalyzeTeam) {
    return (
      <OutOfReachScreen
        title={t("compare.title")}
        help={help}
        reason={t("cap.teamAnalysisOnly")}
        hint={t("cap.teamAnalysisOnlyHint")}
      />
    );
  }

  return <ProfessionalsComparison />;
}

function ProfessionalsComparison() {
  const { t } = useI18n();
  const help = usePageHelp("compare");
  const store = useStore();
  const sel = useSelectors();

  const [selected, setSelected] = useSearchParamList("selected", () => []);
  const [view, setView] = useState<ComparisonView>("radar");

  const views = [
    { value: "radar" as const, label: t("compare.view.radar"), icon: Radar },
    { value: "table" as const, label: t("compare.view.table"), icon: Table2 },
  ];

  const architects = Selection.explicit(selected).apply(store.architects);
  const series: EvolutionSeries[] = architects.map((a) => ({ key: a.id, label: a.name }));

  const averagesByArchitect = new Map(
    architects.map((a) => [
      a.id,
      new Map(sel.capabilityAverages(a.id).map((d) => [d.capability.id, d.avg])),
    ]),
  );

  const radarData = store.capabilities.map((capability) => {
    const row: Record<string, string | number> = {
      capability: sel.capabilityShortLabel(capability),
    };
    for (const architect of architects) {
      row[architect.id] = averagesByArchitect.get(architect.id)?.get(capability.id) ?? 0;
    }
    return row;
  });

  return (
    <>
      <PageHeader
        title={t("compare.title")}
        description={t("compare.subtitle")}
        help={help}
        actions={
          <ArchitectFilter
            architects={store.architects}
            selected={selected}
            onChange={setSelected}
            label={t("compare.selector.label")}
            max={2}
          />
        }
      />

      {architects.length < 2 ? (
        <EmptyState title={t("compare.empty")} />
      ) : (
        <SectionCard
          title={t(view === "radar" ? "compare.radar.title" : "compare.table.title")}
          description={t(view === "radar" ? "compare.radar.subtitle" : "compare.table.subtitle")}
          actions={<ViewToggle view={view} onChange={setView} options={views} />}
        >
          {view === "radar" ? (
            <ComparisonRadar data={radarData} series={series} />
          ) : (
            <>
              <LevelScaleKey />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="w-44 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {t("col.capability")}
                      </th>
                      {architects.map((a) => (
                        <th
                          key={a.id}
                          scope="col"
                          className="px-1 text-center text-meta font-medium text-muted-foreground"
                        >
                          {a.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {store.capabilities.map((capability) => (
                      <tr key={capability.id}>
                        <th
                          scope="row"
                          className="py-1 text-left text-sm font-medium"
                          title={capability.name}
                        >
                          {sel.capabilityShortLabel(capability)}
                        </th>
                        {architects.map((a) => {
                          const avg = averagesByArchitect.get(a.id)?.get(capability.id);
                          return (
                            <td key={a.id} className="min-w-[52px]">
                              <LevelHeatCell
                                level={avg === undefined ? undefined : Math.round(avg)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </SectionCard>
      )}
    </>
  );
}
