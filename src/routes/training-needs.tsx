import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { GapBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useSelectors, useStore } from "@/lib/store";
import { slug } from "@/lib/text";

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
  const needs = sel.teamTrainingNeeds();
  const top = needs.slice(0, 15);
  const collective = needs.filter((n) => n.people >= 3).slice(0, 6);

  /**
   * "Intervenção coletiva" não é uma entidade nova — é a mesma Trilha de
   * Aprendizagem que já existe, atribuída de uma vez a todo mundo com a
   * mesma lacuna. Isso evita inventar um conceito/tabela nova só para
   * reembalar o que a Trilha já faz, e mantém a lista de pessoas real (os
   * mesmos ids que `teamTrainingNeeds` já contou, não um número solto). Ver
   * AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC K.
   */
  const createIntervention = (need: (typeof needs)[number]) => {
    if (!need.competency) return;
    store.addLearningPath({
      id: `lp-${slug(need.competency.name)}-${Date.now()}`,
      name: t("needs.intervention.pathName", { competencia: need.competency.name }),
      description: t("needs.intervention.pathDescription", { n: need.people }),
      competencyIds: [need.competency.id],
      assignedTo: need.architectIds,
      items: [],
      progress: [],
      createdBy: user.email,
      createdAt: new Date().toISOString(),
    });
    toast.success(t("needs.intervention.toast", { competencia: need.competency.name }));
  };

  const interventionExists = (competencyId: string) =>
    store.learningPaths.some((p) => p.competencyIds.includes(competencyId));

  return (
    <>
      <PageHeader title={t("needs.title")} description={t("needs.subtitle")} />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard
          title={t("needs.aggregated.title")}
          description={t("needs.aggregated.subtitle")}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">Competência</th>
                  <th className="py-2">Domínio</th>
                  <th className="py-2 text-center">{t("needs.col.peopleWithGap")}</th>
                  <th className="py-2 text-center">{t("needs.col.avgGap")}</th>
                </tr>
              </thead>
              <tbody>
                {top.map((n) => (
                  <tr key={n.competency!.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 font-medium">{n.competency!.name}</td>
                    <td className="py-2 text-muted-foreground">
                      {store.categories.find((c) => c.id === n.competency!.categoryId)?.short}
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
          description={t("needs.recommended.subtitle")}
        >
          <ul className="space-y-3">
            {collective.map((n) => (
              <li key={n.competency!.id} className="surface-inset p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{n.competency!.name}</p>
                  <GapBadge gap={Math.round(n.avgGap)} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.people} arquitetos · formato sugerido: workshop prático + architecture review
                </p>
                <div className="mt-2">
                  {interventionExists(n.competency!.id) ? (
                    <Link to="/learning-paths" className="text-xs text-primary hover:underline">
                      {t("needs.intervention.view")}
                    </Link>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => createIntervention(n)}>
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
