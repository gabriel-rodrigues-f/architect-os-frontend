import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  CalendarRange,
  ClipboardCheck,
  FileCheck,
  Target,
  UserCog,
  Users,
} from "lucide-react";

import { useMemo } from "react";
import type { ReactNode } from "react";

import {
  CapabilityRadar,
  DashboardCardHelp,
  GapBadge,
  PageHeader,
  QuerySection,
  SectionCard,
  StatCard,
  StatTones,
} from "@/components/app";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { operationsApi, type UserRole } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest } from "@/lib/context-scope";
import {
  DashboardPresenter,
  type LeadPendingQueues,
  PersonalDashboardPresenter,
} from "@/lib/presenters";
import { useI18n } from "@/lib/i18n";
import type { DevelopmentPlan } from "@/lib/domain";
import { useLabels } from "@/lib/labels";
import { usePageHelp } from "@/lib/page-help";
import { useGapSeverityRuler, useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel Executivo — Synapse" },
      {
        name: "description",
        content:
          "Painel por papel: a operação do sistema, o time que você lidera ou a sua própria carreira.",
      },
      { property: "og:title", content: "Painel Executivo — Synapse" },
      {
        property: "og:description",
        content:
          "Painel por papel: a operação do sistema, o time que você lidera ou a sua própria carreira.",
      },
    ],
  }),
  component: Dashboard,
});

const PAINEL_CONTEXTS: readonly ContextScopeRequest[] = [
  "architects",
  "assessments",
  "capabilities",
  "competencies",
  "cycles",
  "activeCycle",
  "plans",
  "learningPaths",
  "mentoringSessions",
  "evidences",
];

const HOME_BY_ROLE = {
  admin: OperationsHome,
  manager: LeadHome,
  tech_lead: LeadHome,
  member: MemberHome,
} satisfies Record<UserRole, () => ReactNode>;

function Dashboard() {
  const user = useCurrentUser();
  const Home = HOME_BY_ROLE[user.role];
  return (
    <ContextScope contexts={PAINEL_CONTEXTS}>
      <Home />
    </ContextScope>
  );
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

function useLeadPendingQueues(): LeadPendingQueues {
  const store = useStore();
  const sel = useSelectors();
  const user = useCurrentUser();
  const presenter = useMemo(() => new DashboardPresenter(store, sel), [store, sel]);
  return presenter.pendingQueuesFor(user);
}

function usePersonalDashboardPresenter() {
  const store = useStore();
  const sel = useSelectors();
  return useMemo(() => new PersonalDashboardPresenter(store, sel), [store, sel]);
}

function NoCycleRegistered({
  title,
  help,
}: {
  title: string;
  help: ReturnType<typeof usePageHelp>;
}) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={title} help={help} />
      <SectionCard title={t("dash.noCycle.title")}>
        <p className="text-sm text-muted-foreground">{t("dash.noCycle.body")}</p>
        <Button asChild className="mt-4">
          <Link to="/cycles">{t("dash.noCycle.cta")}</Link>
        </Button>
      </SectionCard>
    </>
  );
}

/**
 * O Painel do ADMINISTRADOR é um painel de OPERAÇÃO (revisão de papéis,
 * 2026-09-05, D1): o sistema em números — pessoas, times, contas, ciclo,
 * avaliações e PDIs por estado — sem nome ao lado de nota. O desempenho das
 * pessoas é leitura de quem as lidera; o admin que também lidera um time
 * entra pelo vínculo, como qualquer gerente.
 */
function OperationsHome() {
  const { t } = useI18n();
  const help = usePageHelp("dash");
  const labels = useLabels();
  const overview = useQuery({
    queryKey: ["operations", "overview"],
    queryFn: operationsApi.overview,
    staleTime: 30_000,
  });

  return (
    <>
      <PageHeader title={t("dash.ops.title")} description={t("dash.ops.subtitle")} help={help} />
      <QuerySection
        query={overview}
        errorMessage={t("dash.ops.error")}
        skeleton={<div className="h-24 animate-pulse rounded-md bg-secondary" />}
      >
        {(data) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label={t("dash.ops.people")}
                value={data.people.active}
                hint={t("dash.ops.peopleHint", { n: data.people.deactivated })}
                icon={<Users className="h-4 w-4" />}
              />
              <StatCard
                label={t("dash.ops.teams")}
                value={data.teams.active}
                icon={<Building2 className="h-4 w-4" />}
              />
              <StatCard
                label={t("dash.ops.accounts")}
                value={data.accounts.active}
                hint={t("dash.ops.accountsHint", { n: data.accounts.disabled })}
                icon={<UserCog className="h-4 w-4" />}
              />
              <StatCard
                label={t("dash.ops.cycle")}
                value={data.cycle?.name ?? t("dash.ops.noCycle")}
                icon={<CalendarRange className="h-4 w-4" />}
                tone={data.cycle ? "neutral" : "attention"}
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              <SectionCard title={t("dash.ops.assessments.title")}>
                <CountList
                  entries={Object.entries(data.assessments).map(([status, count]) => [
                    labels.assessmentStatus[status as keyof typeof labels.assessmentStatus] ??
                      status,
                    count,
                  ])}
                  emptyLabel={t("dash.ops.none")}
                />
              </SectionCard>
              <SectionCard title={t("dash.ops.plans.title")}>
                <CountList
                  entries={Object.entries(data.plans).map(([status, count]) => [
                    labels.planStatus[status as keyof typeof labels.planStatus] ?? status,
                    count,
                  ])}
                  emptyLabel={t("dash.ops.none")}
                />
              </SectionCard>
              <SectionCard title={t("dash.ops.accountsByRole.title")}>
                <CountList
                  entries={Object.entries(data.accounts.byRole).map(([role, count]) => [
                    t(`users.role.${role}` as Parameters<typeof t>[0]),
                    count,
                  ])}
                  emptyLabel={t("dash.ops.none")}
                />
              </SectionCard>
            </div>

            <SectionCard className="mt-6" title={t("dash.ops.shortcuts")}>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/users">{t("nav.users")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/teams">{t("nav.teams")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/cycles">{t("nav.cycles")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/competency-matrix">{t("nav.competencyMatrix")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/settings">{t("nav.settings")}</Link>
                </Button>
              </div>
            </SectionCard>
          </>
        )}
      </QuerySection>
    </>
  );
}

function CountList({
  entries,
  emptyLabel,
}: {
  entries: Array<[string, number]>;
  emptyLabel: string;
}) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <dl className="space-y-2 text-sm">
      {entries.map(([label, count]) => (
        <div key={label} className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-display text-lg font-semibold tabular-nums">{count}</dd>
        </div>
      ))}
    </dl>
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

  const assessment = sel.assessmentFor(architectId);
  const plan = sel.planFor(architectId);
  const itemsByStatus = personal.planItemCounts(architectId);
  const paths = personal.assignedPaths(architectId);
  const evidencePending = personal.pendingEvidenceCount(architectId);
  // D2 (dono, 2026-09-05): a pessoa vê os PRÓPRIOS números — radar, distâncias, aderência.
  const ownRadar = sel.capabilityAverages(architectId).map((point) => ({
    capability: point.capability.name,
    atual: point.avg ?? 0,
    alvo: point.target ?? 0,
  }));
  const ownGaps = personal.openGaps(architectId).slice(0, 6);

  return (
    <>
      <PageHeader
        title={t("dash.member.title")}
        description={t("dash.member.subtitle", { nome: architect.name })}
        help={help}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label={t("dash.member.assessmentStatus")}
          help={<DashboardCardHelp card="memberAssessment" />}
          value={
            assessment ? labels.assessmentStatus[assessment.status] : t("dash.member.noAssessment")
          }
          icon={<ClipboardCheck className="h-4 w-4" />}
          tone={assessment?.status === "Completed" ? "good" : "attention"}
        />
        <StatCard
          label={t("dash.member.pendingEvidence")}
          help={<DashboardCardHelp card="memberEvidence" />}
          value={evidencePending}
          icon={<FileCheck className="h-4 w-4" />}
          tone={StatTones.byPending(evidencePending)}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard
          title={t("dash.member.radar.title")}
          description={t("dash.member.radar.subtitle")}
        >
          <CapabilityRadar data={ownRadar} />
        </SectionCard>
        <SectionCard
          title={t("dash.member.priorities.title")}
          description={t("dash.member.priorities.subtitle")}
        >
          {ownGaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dash.member.priorities.none")}</p>
          ) : (
            <ul className="space-y-2">
              {ownGaps.map((gap) => (
                <li
                  key={gap.item.competencyId}
                  className="flex items-center justify-between gap-3 surface-inset p-2.5"
                >
                  <span className="truncate text-sm">
                    {sel.competencyById(gap.item.competencyId)?.name ?? gap.item.competencyId}
                  </span>
                  <GapBadge gap={gap.gap} />
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/architects/$architectId/roadmap"
            params={{ architectId }}
            className="mt-3 inline-block text-sm text-primary underline"
          >
            {t("dash.member.roadmap")}
          </Link>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
  const sel = useSelectors();
  const labels = useLabels();
  const { t } = useI18n();
  const help = usePageHelp("dashLead");
  const presenter = useDashboardPresenter();

  const {
    people: myPeople,
    awaitingCalibration,
    pendingEvidence,
    awaitingApproval,
    totalPending,
  } = useLeadPendingQueues();

  if (presenter.noCycleRegistered)
    return <NoCycleRegistered title={t("dash.lead.title")} help={help} />;

  return (
    <>
      <PageHeader title={t("dash.lead.title")} description={t("dash.lead.subtitle")} help={help} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dash.lead.myPeople")}
          help={<DashboardCardHelp card="leadPeople" />}
          value={myPeople.length}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.lead.awaitingCalibration")}
          help={<DashboardCardHelp card="leadCalibration" />}
          value={awaitingCalibration.length}
          icon={<ClipboardCheck className="h-4 w-4" />}
          tone={StatTones.byPending(awaitingCalibration.length)}
        />
        <StatCard
          label={t("dash.lead.pendingEvidence")}
          help={<DashboardCardHelp card="leadEvidence" />}
          value={pendingEvidence.length}
          icon={<FileCheck className="h-4 w-4" />}
          tone={StatTones.byPending(pendingEvidence.length)}
        />
        <StatCard
          label={t("dash.lead.awaitingApproval")}
          help={<DashboardCardHelp card="leadApproval" />}
          value={awaitingApproval.length}
          icon={<Target className="h-4 w-4" />}
          tone={StatTones.byPending(awaitingApproval.length)}
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
