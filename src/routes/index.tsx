import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  ClipboardCheck,
  FileCheck,
  GraduationCap,
  Layers,
  Target,
  TriangleAlert,
  Users,
} from "lucide-react";

import {
  GapBadge,
  LevelBadge,
  LevelCell,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/app/ui-bits";
import { CapabilityRadar } from "@/components/app/charts";
import { useCurrentUser } from "@/lib/auth";
import { levelName } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import { canActFor } from "@/lib/scope";
import { averageWithCoverage } from "@/lib/selectors";
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

/**
 * FASE 2 (quinta rodada) — "Member recebe visão executiva de 'time' em vez
 * de agenda pessoal; Lead pode receber visão incompleta do universo
 * exibido... Recomendação: homes distintas Member/Lead/Admin." O painel
 * inteiro era uma visão de time só, para todo mundo — um Member via
 * estatísticas agregadas da empresa em vez da própria agenda, e um Lead via
 * a mesma coisa em vez da fila do que precisa da decisão dele. Cada papel
 * agora tem sua própria Home: Admin mantém a visão executiva (é o único
 * papel para quem "time inteiro" é realmente a pergunta certa); Member vê
 * a própria evolução; Lead vê o que está pendente de decisão dele. Ver
 * AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, Seção 7 (Dashboard) e
 * 33 (FASE 2).
 */
function Dashboard() {
  const user = useCurrentUser();
  if (user.role === "lead") return <LeadHome />;
  if (user.role === "member") return <MemberHome />;
  return <AdminHome />;
}

function AdminHome() {
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

  const allGaps = architects.flatMap((a) =>
    sel.progressionGapsFor(a.id).map((g) => ({ ...g, architect: a })),
  );
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

      {/* R2-UX-04 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — grid-cols com fr cru é
          um min-content trap: a pista nunca encolhe abaixo do conteúdo mais
          largo (a tabela/heatmap), então a página inteira rola horizontal em
          vez do overflow-x-auto interno ativar. minmax(0,Nfr) devolve à pista
          a permissão de encolher, deixando o overflow interno fazer o trabalho. */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
                  <th
                    scope="col"
                    className="w-44 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {t("cycle.architect")}
                  </th>
                  {store.capabilities.map((c) => (
                    <th
                      key={c.id}
                      scope="col"
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
                    {sel.capabilityAverages(a.id).map((d) => (
                      <td key={d.capability.id} className="min-w-[52px]">
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

/**
 * "Minha Evolução" — a Home de um Member é a própria agenda, não uma
 * estatística de time que ela só enxerga parcialmente (a maior parte do
 * roster está fora do escopo dela por desenho, ver `auth/scope.ts`).
 */
function MemberHome() {
  const store = useStore();
  const sel = useSelectors();
  const user = useCurrentUser();
  const labels = useLabels();
  const { t } = useI18n();

  const architectId = user.architectId;
  const architect = architectId ? sel.architectById(architectId) : undefined;

  if (!architectId || !architect) {
    return (
      <>
        <PageHeader title={t("dash.member.title")} />
        <SectionCard title={t("dash.member.unlinked.title")}>
          <p className="text-sm text-muted-foreground">{t("dash.member.unlinked.body")}</p>
        </SectionCard>
      </>
    );
  }

  const capabilityAvgs = sel.capabilityAverages(architectId);
  const gaps = sel.progressionGapsFor(architectId).filter((g) => g.gap > 0);
  const { avg, covered, total } = averageWithCoverage(capabilityAvgs.map((d) => d.avg));
  const assessment = sel.assessmentFor(architectId);
  const plan = sel.planFor(architectId);
  const planStatus = plan?.status;
  const itemsByStatus = {
    notStarted: plan?.items.filter((i) => i.status === "Not Started").length ?? 0,
    inProgress: plan?.items.filter((i) => i.status === "In Progress").length ?? 0,
    blocked: plan?.items.filter((i) => i.status === "Blocked").length ?? 0,
    completed: plan?.items.filter((i) => i.status === "Completed").length ?? 0,
  };
  const paths = store.learningPaths.filter((p) => p.assignedTo.includes(architectId));
  const evidences = store.evidences.filter((e) => e.architectId === architectId);
  const evidencePending = evidences.filter((e) => e.status === "Pending").length;

  return (
    <>
      <PageHeader
        title={t("dash.member.title")}
        description={t("dash.member.subtitle", { nome: architect.name })}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("arch.stat.avgLevel")}
          value={avg === undefined ? "—" : avg.toFixed(2)}
          hint={
            covered < total
              ? t("arch.stat.avgLevelHintPartial", { covered, total })
              : t("arch.stat.avgLevelHint")
          }
          icon={<Layers className="h-4 w-4" />}
        />
        <StatCard
          label={t("arch.stat.openGaps")}
          value={gaps.length}
          icon={<TriangleAlert className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.member.assessmentStatus")}
          value={
            assessment ? labels.assessmentStatus[assessment.status] : t("dash.member.noAssessment")
          }
          icon={<ClipboardCheck className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.member.pendingEvidence")}
          value={evidencePending}
          icon={<FileCheck className="h-4 w-4" />}
        />
      </div>

      {/* R2-UX-04 — minmax(0,1fr) evita o min-content trap, ver comentário acima. */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title={t("arch.radar.title")} description={t("arch.radar.subtitle")}>
          <CapabilityRadar
            data={capabilityAvgs.map((d) => ({
              capability: d.capability.short,
              atual: d.avg ?? 0,
              alvo: d.target ?? 0,
            }))}
          />
        </SectionCard>

        <SectionCard title={t("dash.member.pdi.title")} description={t("dash.member.pdi.subtitle")}>
          {!plan ? (
            <p className="text-sm text-muted-foreground">{t("dash.member.pdi.none")}</p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                  {labels.planStatus[planStatus!]}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {labels.planItemStatus["Not Started"]}
                  </dt>
                  <dd className="font-display text-lg font-semibold tabular-nums">
                    {itemsByStatus.notStarted}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {labels.planItemStatus["In Progress"]}
                  </dt>
                  <dd className="font-display text-lg font-semibold tabular-nums">
                    {itemsByStatus.inProgress}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{labels.planItemStatus.Blocked}</dt>
                  <dd className="font-display text-lg font-semibold tabular-nums">
                    {itemsByStatus.blocked}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {labels.planItemStatus.Completed}
                  </dt>
                  <dd className="font-display text-lg font-semibold tabular-nums">
                    {itemsByStatus.completed}
                  </dd>
                </div>
              </dl>
            </>
          )}
          <Link
            to="/development-plans"
            search={{ architectId }}
            className="mt-4 inline-block text-xs text-primary hover:underline"
          >
            {t("dash.member.pdi.cta")}
          </Link>
        </SectionCard>
      </div>

      {/* R2-UX-04 — minmax(0,1fr) evita o min-content trap, ver comentário acima. */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard
          title={t("dash.priorities.title")}
          description={t("dash.member.gaps.subtitle")}
        >
          <ul className="space-y-3">
            {gaps.slice(0, 6).map((g) => (
              <li key={g.item.competencyId} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm">{g.competency?.name}</span>
                <span className="flex items-center gap-2">
                  <LevelBadge level={g.item.final} />
                  <span className="text-xs text-muted-foreground">→ {g.item.target}</span>
                  <GapBadge gap={g.gap} />
                </span>
              </li>
            ))}
            {gaps.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("arch.gaps.none")}</p>
            )}
          </ul>
        </SectionCard>

        <SectionCard
          title={t("dash.member.paths.title")}
          description={t("dash.member.paths.subtitle")}
        >
          <ul className="space-y-2">
            {paths.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <Link to="/learning-paths" className="truncate text-sm hover:text-primary">
                  {p.name}
                </Link>
              </li>
            ))}
            {paths.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("dash.member.paths.none")}</p>
            )}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}

/**
 * "Pendências do Lead" — a Home de um Lead é a fila de decisões que
 * dependem dele (avaliação para calibrar, evidência para revisar, PDI
 * aguardando aprovação), não a mesma visão de time do Admin sobre um
 * universo que ele só enxerga parcialmente.
 */
function LeadHome() {
  const store = useStore();
  const sel = useSelectors();
  const user = useCurrentUser();
  const labels = useLabels();
  const { t } = useI18n();

  const myPeople = store.architects.filter((a) => a.active && a.leadUserId === user.id);

  const awaitingCalibration = myPeople
    .map((a) => ({ architect: a, assessment: sel.assessmentFor(a.id) }))
    .filter((x) => x.assessment?.status === "In Review");

  const pendingEvidence = store.evidences.filter(
    (e) => myPeople.some((a) => a.id === e.architectId) && e.status === "Pending",
  );

  const awaitingApproval = myPeople
    .map((a) => ({ architect: a, plan: sel.planFor(a.id) }))
    .filter((x) => x.plan && x.plan.status === "Draft" && x.plan.items.length > 0);

  const totalPending =
    awaitingCalibration.length + pendingEvidence.length + awaitingApproval.length;

  return (
    <>
      <PageHeader title={t("dash.lead.title")} description={t("dash.lead.subtitle")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dash.lead.myPeople")}
          value={myPeople.length}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.lead.awaitingCalibration")}
          value={awaitingCalibration.length}
          icon={<ClipboardCheck className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.lead.pendingEvidence")}
          value={pendingEvidence.length}
          icon={<FileCheck className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.lead.awaitingApproval")}
          value={awaitingApproval.length}
          icon={<Target className="h-4 w-4" />}
        />
      </div>

      {myPeople.length === 0 ? (
        <SectionCard className="mt-6" title={t("dash.lead.empty.title")}>
          <p className="text-sm text-muted-foreground">{t("dash.lead.empty.body")}</p>
        </SectionCard>
      ) : totalPending === 0 ? (
        <SectionCard className="mt-6" title={t("dash.lead.allClear.title")}>
          <p className="text-sm text-muted-foreground">{t("dash.lead.allClear.body")}</p>
        </SectionCard>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <SectionCard title={t("dash.lead.awaitingCalibration")}>
            <ul className="space-y-2">
              {awaitingCalibration.map(({ architect }) => (
                <li key={architect.id}>
                  <Link
                    to="/assessments"
                    search={{ architectId: architect.id }}
                    className="text-sm hover:text-primary hover:underline"
                  >
                    {architect.name}
                  </Link>
                </li>
              ))}
              {awaitingCalibration.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("dash.lead.queueEmpty")}</p>
              )}
            </ul>
          </SectionCard>

          <SectionCard title={t("dash.lead.pendingEvidence")}>
            <ul className="space-y-2">
              {pendingEvidence.map((e) => (
                <li key={e.id}>
                  <Link
                    to="/architects/$architectId"
                    params={{ architectId: e.architectId }}
                    className="text-sm hover:text-primary hover:underline"
                  >
                    {sel.architectById(e.architectId)?.name} — {e.title}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {labels.evidenceStatus[e.status]}
                  </span>
                </li>
              ))}
              {pendingEvidence.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("dash.lead.queueEmpty")}</p>
              )}
            </ul>
          </SectionCard>

          <SectionCard title={t("dash.lead.awaitingApproval")}>
            <ul className="space-y-2">
              {awaitingApproval.map(({ architect }) => (
                <li key={architect.id}>
                  <Link
                    to="/development-plans"
                    search={{ architectId: architect.id }}
                    className="text-sm hover:text-primary hover:underline"
                  >
                    {architect.name}
                  </Link>
                </li>
              ))}
              {awaitingApproval.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("dash.lead.queueEmpty")}</p>
              )}
            </ul>
          </SectionCard>
        </div>
      )}
    </>
  );
}
