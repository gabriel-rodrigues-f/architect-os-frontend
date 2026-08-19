import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  GraduationCap,
  Layers,
  Target,
  TriangleAlert,
  Users,
} from "lucide-react";

import { LevelCell, PageHeader, SectionCard, StatCard, GapBadge } from "@/components/app/ui-bits";
import { useCurrentUser } from "@/lib/auth";
import { levelName } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { canActFor } from "@/lib/scope";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel — Synapse" },
      {
        name: "description",
        content:
          "Visão executiva das capacidades técnicas do time de Arquitetos de Soluções: gaps, PDIs, metas e evolução.",
      },
      { property: "og:title", content: "Painel — Synapse" },
      {
        property: "og:description",
        content:
          "Visão executiva das capacidades técnicas do time de Arquitetos de Soluções: gaps, PDIs, metas e evolução.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const store = useStore();
  const sel = useSelectors();
  const user = useCurrentUser();
  const { t } = useI18n();
  const cycle = store.cycles.find((c) => c.id === store.activeCycleId);
  /**
   * Quem desativou (saiu do time) não conta nos agregados do Painel — ver
   * histórico dela continua em /architects/:id, só não representa mais o
   * time atual. Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 18, e
   * AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC E.
   *
   * `canActFor` recorta pra quem este viewer de fato enxerga (própria
   * pessoa, ou quem está sob a liderança dela) — sem isto, o roster inteiro
   * (que chega sem filtro por ser dado de diretório, não de carreira, ver
   * `auth/scope.ts`) virava a população do heatmap e da cobertura, e quem
   * está fora do escopo aparecia como "não iniciado" por não ter registro
   * visível, não por realmente não ter avaliação. Ver ANA-001, AUDITORIA-
   * QUINTA-RODADA-360-SYNAPSE-2026-08-19.md.
   */
  const architects = sel.activeArchitects.filter((a) => canActFor(user, a));

  const allGaps = architects.flatMap((a) => sel.gapsFor(a.id).map((g) => ({ ...g, architect: a })));
  const criticalGaps = allGaps.filter((g) => g.gap >= 3).length;
  const planItems = store.plans
    .filter((p) => p.cycleId === store.activeCycleId)
    .flatMap((p) => p.items);
  const goalsInProgress = planItems.filter((i) => i.status === "In Progress").length;
  const goalsDone = planItems.filter((i) => i.status === "Completed").length;
  const pathsInProgress = store.learningPaths.filter((p) =>
    p.progress.some((entry) => entry.status === "In Progress"),
  ).length;

  const topGaps = [...allGaps].sort((a, b) => b.gap - a.gap).slice(0, 6);

  /**
   * Cobertura das avaliações do ciclo ativo — sem isto, o heatmap e as
   * médias do painel podem parecer representar o time inteiro quando na
   * verdade só cobrem quem já tem assessment `Completed`. Ver AUDITORIA-
   * RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 42.
   */
  const assessmentCoverage = architects.reduce(
    (acc, a) => {
      const status = sel.assessmentFor(a.id)?.status;
      if (status === "Completed") acc.completed += 1;
      else if (status === "In Review") acc.inReview += 1;
      else if (status === "Draft") acc.draft += 1;
      else acc.notStarted += 1;
      return acc;
    },
    { completed: 0, inReview: 0, draft: 0, notStarted: 0 },
  );

  return (
    <>
      <PageHeader
        title={t("dash.title")}
        description={t("dash.subtitle", { ciclo: cycle?.name ?? "—" })}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dash.stat.architects")}
          value={architects.length}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.stat.activePlans")}
          value={store.plans.filter((p) => p.cycleId === store.activeCycleId).length}
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.stat.competencies")}
          value={store.competencies.length}
          icon={<Layers className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.stat.criticalGaps")}
          value={criticalGaps}
          hint={t("dash.stat.criticalGapsHint")}
          icon={<TriangleAlert className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.stat.goalsInProgress")}
          value={goalsInProgress}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.stat.goalsDone")}
          value={goalsDone}
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.stat.mentoring")}
          value={store.mentoringSessions.length}
          icon={<GraduationCap className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.stat.paths")}
          value={pathsInProgress}
          icon={<BookOpen className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <SectionCard title={t("dash.heatmap.title")} description={t("dash.heatmap.subtitle")}>
          <p className="mb-3 text-xs text-muted-foreground">
            {t("dash.coverage", {
              completed: assessmentCoverage.completed,
              total: architects.length,
              inReview: assessmentCoverage.inReview,
              draft: assessmentCoverage.draft,
              notStarted: assessmentCoverage.notStarted,
            })}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th className="w-44 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("cycle.architect")}
                  </th>
                  {store.categories.map((c) => (
                    <th
                      key={c.id}
                      className="px-1 text-center text-[11px] font-medium text-muted-foreground"
                      title={c.name}
                    >
                      {c.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {architects.map((a) => (
                  <tr key={a.id}>
                    <td className="py-1">
                      <Link
                        to="/architects/$architectId"
                        params={{ architectId: a.id }}
                        className="text-sm font-medium hover:text-primary"
                      >
                        {a.name}
                      </Link>
                    </td>
                    {sel.domainAverages(a.id).map((d) => (
                      <td key={d.category.id} className="min-w-[52px]">
                        <LevelCell level={d.avg === undefined ? undefined : Math.round(d.avg)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {[1, 2, 3, 4, 5].map((l) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="h-3 w-6 rounded" style={{ background: `var(--level-${l})` }} />
                {l} · {levelName(l)}
              </span>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title={t("dash.priorities.title")}
            description={t("dash.priorities.subtitle")}
          >
            <ul className="space-y-3">
              {topGaps.map((g, i) => (
                <li
                  key={`${g.architect.id}-${g.item.competencyId}-${i}`}
                  className="flex items-start justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium">{g.competency?.name}</p>
                    <p className="text-xs text-muted-foreground">{g.architect.name}</p>
                  </div>
                  <GapBadge gap={g.gap} />
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
