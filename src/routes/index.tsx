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

import { useMemo } from "react";

import {
  CapabilityHeatmap,
  CapabilityRadar,
  GapBadge,
  LevelBadge,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/app";
import { useCurrentUser } from "@/lib/auth";
import { DashboardPresenter, PersonalDashboardPresenter } from "@/lib/presenters";
import { useI18n } from "@/lib/i18n";
import type { DevelopmentPlan } from "@/lib/domain";
import { useLabels } from "@/lib/labels";
import { usePageHelp } from "@/lib/page-help";
import { useGapSeverityRuler, useSelectors, useStore } from "@/lib/store";

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
  const user = useCurrentUser();
  if (user.role === "lead") return <LeadHome />;
  if (user.role === "member") return <MemberHome />;
  return <AdminHome />;
}

function useDashboardPresenter() {
  const store = useStore();
  const sel = useSelectors();
  const { criticalThreshold } = useGapSeverityRuler();
  return useMemo(
    () => new DashboardPresenter(store, sel, criticalThreshold),
    [store, sel, criticalThreshold],
  );
}

function usePersonalDashboardPresenter() {
  const store = useStore();
  const sel = useSelectors();
  return useMemo(() => new PersonalDashboardPresenter(store, sel), [store, sel]);
}

function AdminHome() {
  const store = useStore();
  const sel = useSelectors();
  const { t } = useI18n();
  const labels = useLabels();
  const help = usePageHelp("dash");
  const cycle = store.cycles.find((c) => c.id === store.activeCycleId);

  const architects = sel.activeArchitects;

  const presenter = useDashboardPresenter();
  const criticalGaps = presenter.criticalGapCount(architects);
  const topGaps = presenter.topGaps(architects);
  const assessmentCoverage = presenter.assessmentCoverage(architects);

  return (
    <>
      <PageHeader
        title={t("dash.title")}
        description={t("dash.subtitle", { ciclo: cycle?.name ?? "—" })}
        help={help}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dash.stat.architects")}
          value={architects.length}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.stat.activePlans")}
          value={presenter.activePlans().length}
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
          value={presenter.goalsInProgress}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.stat.goalsDone")}
          value={presenter.goalsDone}
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.stat.mentoring")}
          value={store.mentoringSessions.length}
          icon={<GraduationCap className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.stat.paths")}
          value={presenter.pathsInProgress}
          icon={<BookOpen className="h-4 w-4" />}
        />
      </div>

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
          <CapabilityHeatmap
            architects={architects}
            capabilities={store.capabilities}
            capabilityAveragesFor={sel.capabilityAverages}
            linkToProfile
          />
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {[1, 2, 3, 4, 5].map((l) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="h-3 w-6 rounded" style={{ background: `var(--level-${l})` }} />
                {l} · {labels.levelName[l as keyof typeof labels.levelName]}
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

function PlanStatusChip({ status }: { status: DevelopmentPlan["status"] }) {
  const labels = useLabels();
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
        {labels.planStatus[status]}
      </span>
    </div>
  );
}

function MemberHome() {
  const sel = useSelectors();
  const user = useCurrentUser();
  const labels = useLabels();
  const { t } = useI18n();
  const help = usePageHelp("dash");
  const personal = usePersonalDashboardPresenter();

  const architectId = user.architectId;
  const architect = architectId ? sel.architectById(architectId) : undefined;

  if (!architectId || !architect) {
    return (
      <>
        <PageHeader title={t("dash.member.title")} help={help} />
        <SectionCard title={t("dash.member.unlinked.title")}>
          <p className="text-sm text-muted-foreground">{t("dash.member.unlinked.body")}</p>
        </SectionCard>
      </>
    );
  }

  const capabilityAvgs = sel.capabilityAverages(architectId);

  const gaps = personal.openGaps(architectId);
  const { avg, covered, total } = sel.coverageFor(architectId);
  const assessment = sel.assessmentFor(architectId);
  const plan = sel.planFor(architectId);
  const itemsByStatus = personal.planItemCounts(architectId);
  const paths = personal.assignedPaths(architectId);
  const evidencePending = personal.pendingEvidenceCount(architectId);

  return (
    <>
      <PageHeader
        title={t("dash.member.title")}
        description={t("dash.member.subtitle", { nome: architect.name })}
        help={help}
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title={t("arch.radar.title")} description={t("arch.radar.subtitle")}>
          <CapabilityRadar
            data={capabilityAvgs.map((d) => ({
              capability: sel.capabilityShortLabel(d.capability),
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
              <PlanStatusChip status={plan.status} />
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

function LeadHome() {
  const store = useStore();
  const sel = useSelectors();
  const user = useCurrentUser();
  const labels = useLabels();
  const { t } = useI18n();
  const help = usePageHelp("dashLead");

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
      <PageHeader title={t("dash.lead.title")} description={t("dash.lead.subtitle")} help={help} />

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
