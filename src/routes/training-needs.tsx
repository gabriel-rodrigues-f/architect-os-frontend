import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { GapBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { TruncationNotice } from "@/components/app/TruncationNotice";
import { Button } from "@/components/ui/button";
import { useSuccessToast, useToastSubmit } from "@/hooks";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useOperationalSettings, useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/training-needs")({
  head: () => ({
    meta: [
      { title: "Necessidades de Treinamento — Synapse" },
      {
        name: "description",
        content:
          "Análise agregada de necessidades de treinamento do time (LNT) a partir dos gaps individuais.",
      },
      { property: "og:title", content: "Necessidades de Treinamento — Synapse" },
      {
        property: "og:description",
        content: "Treinamentos recomendados que atendem várias pessoas simultaneamente.",
      },
    ],
  }),
  component: TrainingNeedsPage,
});

function TrainingNeedsPage() {
  const store = useStore();
  const sel = useSelectors();
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp("trainingNeeds");

  const population = sel.visibleArchitects(user);
  const needs = sel.teamTrainingNeeds(population);

  const [showAllTop, setShowAllTop] = useState(false);
  const top = showAllTop ? needs : needs.slice(0, 15);

  const { trainingCollectiveInterventionThreshold } = useOperationalSettings();
  const collectiveEligible = needs.filter(
    (n) => n.people >= trainingCollectiveInterventionThreshold,
  );
  const [showAllCollective, setShowAllCollective] = useState(false);
  const collective = showAllCollective ? collectiveEligible : collectiveEligible.slice(0, 6);
  const { submitting, run } = useToastSubmit();
  const notifySuccess = useSuccessToast();

  const createIntervention = async (need: (typeof needs)[number]) => {
    const competency = need.competency;
    if (!competency) return;

    const result = await run(() =>
      store.addLearningPath({
        id: "",
        name: t("needs.intervention.pathName", { competencia: competency.name }),
        description: t("needs.intervention.pathDescription", { n: need.people }),
        competencyIds: [competency.id],
        assignedTo: need.architectIds,
        items: [],
        progress: [],
        createdBy: user.email,
        createdByUserId: user.id,
        createdAt: new Date().toISOString(),
      }),
    );
    if (result.ok) {
      notifySuccess("needs.intervention.toast", { competencia: competency.name });
    }
  };

  const interventionExists = (need: (typeof needs)[number]) =>
    store.learningPaths.some(
      (p) =>
        p.competencyIds.includes(need.competency!.id) &&
        p.assignedTo.some((id) => need.architectIds.includes(id)),
    );

  return (
    <>
      <PageHeader title={t("needs.title")} description={t("needs.subtitle")} help={help} />

      {}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SectionCard
          title={t("needs.aggregated.title")}
          description={t("needs.aggregated.subtitle")}
        >
          <TruncationNotice
            shown={top.length}
            total={needs.length}
            showAll={showAllTop}
            onToggle={() => setShowAllTop((v) => !v)}
            threshold={15}
            messages={{
              showingAll: "needs.aggregated.showingAll",
              showingTopN: "needs.aggregated.showingTopN",
              showAll: "needs.showAll",
              showTopOnly: "needs.showTopOnly",
            }}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2">
                    {t("col.competency")}
                  </th>
                  <th scope="col" className="py-2">
                    {t("col.capability")}
                  </th>
                  <th scope="col" className="py-2 text-center">
                    {t("needs.col.peopleWithGap")}
                  </th>
                  <th scope="col" className="py-2 text-center">
                    {t("needs.col.avgGap")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {top.map((n) => (
                  <tr key={n.competency!.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 font-medium">{n.competency!.name}</td>
                    <td className="py-2 text-muted-foreground">
                      {sel.capabilityShortLabels.get(n.competency!.capabilityId) ??
                        sel.capabilityById(n.competency!.capabilityId)?.short}
                    </td>
                    <td className="py-2 text-center tabular-nums">{n.people}</td>
                    <td className="py-2 text-center tabular-nums">{n.avgGap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title={t("needs.recommended.title")}
          description={t("needs.recommended.subtitle", {
            n: trainingCollectiveInterventionThreshold,
          })}
        >
          <TruncationNotice
            shown={collective.length}
            total={collectiveEligible.length}
            showAll={showAllCollective}
            onToggle={() => setShowAllCollective((v) => !v)}
            threshold={6}
            messages={{
              showingAll: "needs.recommended.showingAll",
              showingTopN: "needs.recommended.showingTopN",
              showAll: "needs.showAll",
              showTopOnly: "needs.showTopOnly",
            }}
          />
          <ul className="space-y-3">
            {collective.map((n) => (
              <li key={n.competency!.id} className="surface-inset p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{n.competency!.name}</p>
                  <GapBadge gap={Math.round(n.avgGap)} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("needs.recommended.summary", { n: n.people })}
                </p>
                <div className="mt-2">
                  {interventionExists(n) ? (
                    <Link to="/learning-paths" className="text-xs text-primary hover:underline">
                      {t("needs.intervention.view")}
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={submitting}
                      onClick={() => createIntervention(n)}
                    >
                      {t("needs.intervention.create")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
            {!collective.length && (
              <p className="text-sm text-muted-foreground">{t("needs.recommended.none")}</p>
            )}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
