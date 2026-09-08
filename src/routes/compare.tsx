import { createFileRoute } from "@tanstack/react-router";
import { Radar, Table2 } from "lucide-react";
import { useState } from "react";

import {
  ComparisonRadar,
  EmptyState,
  EmptyStateCallToAction,
  type EvolutionSeries,
  LevelHeatCell,
  LevelScaleKey,
  OutOfReachScreen,
  PageHeader,
  PersonCombobox,
  SectionCard,
  ViewToggle,
} from "@/components/app";
import { useCurrentUser } from "@/lib/auth";
import { PersonPicker } from "@/lib/person-selection";
import { ContextScope, type ContextScopeRequest, SELECTOR_CONTEXTS } from "@/lib/context-scope";
import { EmptySubject } from "@/lib/empty-subject";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { Registration } from "@/lib/registration";
import { requireTeamAnalysisReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { Selection } from "@/lib/selection";
import { useSelectors, useStore } from "@/lib/store";
import { useSearchParamList } from "@/hooks";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Perfis lado a lado — Synapse" },
      {
        name: "description",
        content: "Comparação lado a lado do nível de capacidades entre profissionais específicos.",
      },
      { property: "og:title", content: "Perfis lado a lado — Synapse" },
      { property: "og:description", content: "Radar sobreposto e tabela lado a lado por pessoa." },
    ],
  }),
  beforeLoad: requireTeamAnalysisReach,
  component: ComparePage,
});

type ComparisonView = "radar" | "table";

const COMPARE_CONTEXTS: readonly ContextScopeRequest[] = [...SELECTOR_CONTEXTS];

function ComparePage() {
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp("compare");
  // Análise do time: quem lidera com vínculo — gerente e tech lead (dono, 2026-09-06: "o gerente vê o que o tech lead vê").
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

  return (
    <ContextScope contexts={COMPARE_CONTEXTS}>
      <ProfessionalsComparison />
    </ContextScope>
  );
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

  const professionals = Selection.explicit(selected).apply(store.professionals);
  const series: EvolutionSeries[] = professionals.map((a) => ({ key: a.id, label: a.name }));

  const averagesByProfessional = new Map(
    professionals.map((a) => [
      a.id,
      new Map(sel.capabilityAverages(a.id).map((d) => [d.capability.id, d.avg])),
    ]),
  );

  const radarData = store.capabilities.map((capability) => {
    const row: Record<string, string | number> = {
      capability: capability.name,
    };
    for (const professional of professionals) {
      row[professional.id] = averagesByProfessional.get(professional.id)?.get(capability.id) ?? 0;
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
          <PersonCombobox
            picker={PersonPicker.upTo(2, store.professionals, selected)}
            onChange={setSelected}
            label={t("compare.selector.label")}
            className="w-64"
          />
        }
      />

      {store.professionals.length === 0 ? (
        /*
         * Dono (2026-09-08): sem ninguém cadastrado o filtro fica bloqueado e
         * o cadastro aparece no CENTRO do quadro principal — "Selecione ao
         * menos 2 profissionais" não é o próximo passo de quem não tem
         * nenhum.
         */
        <EmptyStateCallToAction
          subject={EmptySubject.PROFESSIONAL}
          hint={t("compare.empty.noProfessionals")}
          registrations={[Registration.PROFESSIONAL]}
        />
      ) : professionals.length < 2 ? (
        <EmptyState
          title={EmptySubject.PROFESSIONAL.titleIn(t, "empty.context.selected")}
          hint={t("compare.empty")}
        />
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
              <div className="scroll-visible overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="w-44 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {t("col.capability")}
                      </th>
                      {professionals.map((a) => (
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
                        {professionals.map((a) => {
                          const avg = averagesByProfessional.get(a.id)?.get(capability.id);
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
