import { createFileRoute } from "@tanstack/react-router";

import { ArchitectFilter } from "@/components/app/ArchitectFilter";
import { ComparisonRadar, type EvolutionSeries } from "@/components/app/charts";
import { EmptyState, LevelCell, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
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
  component: ComparePage,
});

function ComparePage() {
  const { t } = useI18n();
  const help = usePageHelp("compare");
  const store = useStore();
  const sel = useSelectors();

  const [selected, setSelected] = useSearchParamList("selected", () => []);

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
          />
        }
      />

      {architects.length < 2 ? (
        <EmptyState title={t("compare.empty")} />
      ) : (
        <>
          <SectionCard title={t("compare.radar.title")} description={t("compare.radar.subtitle")}>
            <ComparisonRadar data={radarData} series={series} />
          </SectionCard>

          <SectionCard
            className="mt-6"
            title={t("compare.table.title")}
            description={t("compare.table.subtitle")}
          >
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
                        className="px-1 text-center text-[11px] font-medium text-muted-foreground"
                      >
                        {a.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {store.capabilities.map((capability) => (
                    <tr key={capability.id}>
                      <td className="py-1 text-sm font-medium" title={capability.name}>
                        {sel.capabilityShortLabel(capability)}
                      </td>
                      {architects.map((a) => {
                        const avg = averagesByArchitect.get(a.id)?.get(capability.id);
                        return (
                          <td key={a.id} className="min-w-[52px]">
                            <LevelCell level={avg === undefined ? undefined : Math.round(avg)} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </>
  );
}
