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

import { PhilosophyCard } from "@/components/app/PhilosophyCard";
import {
  LevelCell,
  PageHeader,
  SectionCard,
  StatCard,
  GapBadge,
  Bar,
} from "@/components/app/ui-bits";
import { levelName } from "@/lib/domain";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel — Architect OS" },
      {
        name: "description",
        content:
          "Visão executiva das capacidades técnicas do time de Arquitetos de Soluções: gaps, PDIs, metas e evolução.",
      },
      { property: "og:title", content: "Painel — Architect OS" },
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
  const cycle = store.cycles.find((c) => c.id === store.activeCycleId);

  const allGaps = store.architects.flatMap((a) =>
    sel.gapsFor(a.id).map((g) => ({ ...g, architect: a })),
  );
  const criticalGaps = allGaps.filter((g) => g.gap >= 3).length;
  const planItems = store.plans
    .filter((p) => p.cycleId === store.activeCycleId)
    .flatMap((p) => p.items);
  const goalsInProgress = planItems.filter((i) => i.status === "In Progress").length;
  const goalsDone = planItems.filter((i) => i.status === "Completed").length;
  const pathsInProgress = store.learningPaths.filter((p) =>
    p.items.some((i) => i.status === "In Progress"),
  ).length;

  const topGaps = [...allGaps].sort((a, b) => b.gap - a.gap).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Painel de Capacidades de Arquitetura"
        description={`Ciclo ${cycle?.name ?? "—"} · Quais capacidades o time possui hoje, o que precisamos desenvolver e como cada arquiteto está evoluindo.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Arquitetos"
          value={store.architects.length}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="PDIs ativos"
          value={store.plans.filter((p) => p.cycleId === store.activeCycleId).length}
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label="Competências avaliadas"
          value={store.competencies.length}
          icon={<Layers className="h-4 w-4" />}
        />
        <StatCard
          label="Lacunas críticas"
          value={criticalGaps}
          hint="Lacuna 3 ou superior"
          icon={<TriangleAlert className="h-4 w-4" />}
        />
        <StatCard
          label="Metas em andamento"
          value={goalsInProgress}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Metas concluídas"
          value={goalsDone}
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label="Mentorias realizadas"
          value={store.mentoringSessions.length}
          icon={<GraduationCap className="h-4 w-4" />}
        />
        <StatCard
          label="Trilhas em andamento"
          value={pathsInProgress}
          icon={<BookOpen className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <SectionCard
          title="Mapa de Calor de Competências do Time"
          description="Média por domínio de competência (escala 1 Consciência → 5 Especialista)."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th className="w-44 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Architect
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
                {store.architects.map((a) => (
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
                        <LevelCell level={Math.round(d.avg)} />
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
            title="Principais Prioridades de Desenvolvimento"
            description="Maiores lacunas do time no ciclo atual."
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

          <SectionCard
            title="Evolução do Desenvolvimento"
            description="Indicador de evolução, não de avaliação punitiva."
          >
            <ul className="space-y-3">
              {store.architects.map((a) => {
                const score = sel.developmentScore(a.id);
                return (
                  <li key={a.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{a.name}</span>
                      <span className="tabular-nums text-muted-foreground">{score}%</span>
                    </div>
                    <Bar value={score} />
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </div>
      </div>

      <PhilosophyCard />
    </>
  );
}
