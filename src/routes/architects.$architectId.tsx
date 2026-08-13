import { createFileRoute, Link } from "@tanstack/react-router";

import { DomainRadar } from "@/components/app/charts";
import {
  Bar,
  GapBadge,
  Initials,
  LevelBadge,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/app/ui-bits";
import {
  actionTypeLabel,
  complexityLabel,
  evidenceTypeLabel,
  planItemStatusLabel,
} from "@/lib/labels";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/architects/$architectId")({
  head: () => ({
    meta: [
      { title: "Architect Profile — Architect OS" },
      {
        name: "description",
        content:
          "Perfil completo do arquiteto: competências, gaps, PDI, metas, mentorias e evidências.",
      },
      { property: "og:title", content: "Architect Profile — Architect OS" },
      {
        property: "og:description",
        content: "Visão 360 do desenvolvimento técnico individual do Arquiteto de Soluções.",
      },
    ],
  }),
  component: ArchitectProfile,
  notFoundComponent: () => (
    <p className="text-sm text-muted-foreground">Arquiteto não encontrado.</p>
  ),
});

function ArchitectProfile() {
  const { architectId } = Route.useParams();
  const store = useStore();
  const sel = useSelectors();
  const architect = sel.architectById(architectId);

  if (!architect) {
    return (
      <div className="surface-card p-6 text-sm">
        Arquiteto não encontrado.{" "}
        <Link to="/team" className="text-primary underline">
          Voltar ao time
        </Link>
      </div>
    );
  }

  const gaps = sel.gapsFor(architect.id).filter((g) => g.gap > 0);
  const domains = sel.domainAverages(architect.id);
  const plan = sel.planFor(architect.id);
  const swot = sel.swotFor(architect.id);
  const okr = store.okrs.find((o) => o.architectId === architect.id);
  const sessions = store.mentoringSessions.filter((m) => m.menteeId === architect.id);
  const evidences = store.evidences.filter((e) => e.architectId === architect.id);
  const paths = store.learningPaths.filter((p) => p.assignedTo.includes(architect.id));
  const score = sel.developmentScore(architect.id);
  const avg = domains.length ? domains.reduce((s, d) => s + d.avg, 0) / domains.length : 0;

  return (
    <>
      <PageHeader
        title={architect.name}
        description={`${architect.role} · ${architect.specialization} · ${architect.yearsAsArchitect} anos como arquiteto`}
        actions={
          <Link
            to="/team"
            className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
          >
            Voltar
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Índice de Desenvolvimento"
          value={`${score}`}
          hint="PDI, OKRs, trilhas, evidências e evolução"
        />
        <StatCard
          label="Nível médio"
          value={avg.toFixed(2)}
          hint="Média das competências avaliadas"
        />
        <StatCard
          label="Lacunas abertas"
          value={`${gaps.length}`}
          hint="Competências abaixo do nível esperado"
        />
        <StatCard
          label="9 Box"
          value={`${architect.performance}/${architect.potential}`}
          hint="Desempenho / Potencial"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Perfil por domínio" description="Nível atual versus nível esperado.">
          <DomainRadar
            data={domains.map((d) => ({ domain: d.category.short, atual: d.avg, alvo: d.target }))}
          />
        </SectionCard>

        <SectionCard
          title="Principais lacunas"
          description="Prioridades de desenvolvimento neste ciclo."
        >
          <ul className="space-y-2">
            {gaps.slice(0, 8).map((g) => (
              <li
                key={g.item.competencyId}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5"
              >
                <span className="truncate text-sm">{g.competency?.name}</span>
                <span className="flex items-center gap-2">
                  <LevelBadge level={g.item.final} />
                  <span className="text-xs text-muted-foreground">→ {g.item.target}</span>
                  <GapBadge gap={g.gap} />
                </span>
              </li>
            ))}
            {!gaps.length && (
              <p className="text-sm text-muted-foreground">Sem lacunas neste ciclo.</p>
            )}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard title="PDI" description="Plano de desenvolvimento individual do ciclo ativo.">
          <ul className="space-y-3">
            {(plan?.items ?? []).map((i) => (
              <li key={i.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{sel.competencyById(i.competencyId)?.name}</p>
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                    {planItemStatusLabel[i.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {actionTypeLabel[i.actionType]} · {i.actionPlan} · prazo {i.targetDate}
                </p>
                <Bar value={i.progress} className="mt-2" />
              </li>
            ))}
            {!plan?.items.length && (
              <p className="text-sm text-muted-foreground">Nenhum item de PDI.</p>
            )}
          </ul>
        </SectionCard>

        <SectionCard title="SWOT" description="Autoanálise do arquiteto no ciclo.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Swot title="Forças" items={swot?.strengths ?? []} />
            <Swot title="Fraquezas" items={swot?.weaknesses ?? []} />
            <Swot title="Oportunidades" items={swot?.opportunities ?? []} />
            <Swot title="Ameaças" items={swot?.threats ?? []} />
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <SectionCard title="OKRs" description="Objetivos e resultados-chave do ciclo.">
          {okr ? (
            <div>
              <p className="text-sm font-medium">{okr.objective}</p>
              <ul className="mt-2 space-y-2">
                {okr.keyResults.map((k) => (
                  <li key={k.id}>
                    <p className="text-xs text-muted-foreground">{k.title}</p>
                    <Bar value={k.progress} className="mt-1" />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem OKRs definidos.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Trilhas de aprendizagem"
          description="Treinamentos e práticas atribuídas."
        >
          <ul className="space-y-2">
            {paths.map((p) => (
              <li key={p.id} className="rounded-lg border border-border p-2.5">
                <p className="text-sm font-medium">{p.name}</p>
                <Bar
                  className="mt-1.5"
                  value={
                    p.items.length
                      ? Math.round(p.items.reduce((s, i) => s + i.progress, 0) / p.items.length)
                      : 0
                  }
                />
              </li>
            ))}
            {!paths.length && (
              <p className="text-sm text-muted-foreground">Nenhuma trilha atribuída.</p>
            )}
          </ul>
        </SectionCard>

        <SectionCard title="Evidências" description="Provas concretas de aplicação prática.">
          <ul className="space-y-2">
            {evidences.map((e) => (
              <li key={e.id} className="rounded-lg border border-border p-2.5">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {evidenceTypeLabel[e.type]} · {e.date} · complexidade{" "}
                  {complexityLabel[e.complexity]}
                </p>
              </li>
            ))}
            {!evidences.length && (
              <p className="text-sm text-muted-foreground">Nenhuma evidência registrada.</p>
            )}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        className="mt-6"
        title="Mentorias"
        description={`${sessions.length} sessões registradas`}
      >
        <ol className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Initials name={s.mentor} />
              <div>
                <p className="text-sm font-medium">{s.topic}</p>
                <p className="text-xs text-muted-foreground">
                  {s.date} · {s.durationMin} min · mentor {s.mentor}
                </p>
                <p className="mt-1 text-sm">{s.actions}</p>
              </div>
            </li>
          ))}
          {!sessions.length && (
            <p className="text-sm text-muted-foreground">Nenhuma sessão registrada.</p>
          )}
        </ol>
      </SectionCard>
    </>
  );
}

function Swot({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
        {!items.length && <li className="list-none text-muted-foreground">—</li>}
      </ul>
    </div>
  );
}
