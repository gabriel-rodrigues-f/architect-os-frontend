import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, FileCheck } from "lucide-react";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  AssessmentCoverageChart,
  CapabilityRadar,
  DashboardCardHelp,
  GapBadge,
  GapSeverityChart,
  KeyFigureCard,
  PageHeader,
  QuerySection,
  RevealBlock,
  RevealSequence,
  SectionCard,
  SectionHeading,
  StatCard,
  StatTones,
} from "@/components/app";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { operationsApi, type UserRole } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest } from "@/lib/context-scope";
import { DashboardEntrance } from "@/lib/dashboard-entrance";
import { KeyFigureFormatter } from "@/lib/key-figure-format";
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

/**
 * PR 5 (adendo do dono, 2026-09-08) — o Painel de operação é de quem opera o
 * sistema: o suporte (o antigo admin) e a diretoria. A leitura de
 * organização inteira sobre carreira é produto novo (D-I) e nasce depois.
 */
const HOME_BY_ROLE = {
  admin: OperationsHome,
  support: OperationsHome,
  manager: LeadHome,
  tech_lead: LeadHome,
  member: MemberHome,
} satisfies Record<UserRole, () => ReactNode>;

function Dashboard() {
  const user = useCurrentUser();
  const Home = HOME_BY_ROLE[user.role];
  // A entrada orquestrada é da PRIMEIRA abertura depois do login: a marca é
  // consumida uma vez, na montagem — recarregar ou voltar pelo menu não repete.
  const [entrance] = useState(() => DashboardEntrance.consume(user));
  return (
    <ContextScope contexts={PAINEL_CONTEXTS}>
      <RevealSequence enabled={entrance}>
        <Home />
      </RevealSequence>
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
 * O Painel do ADMINISTRADOR é uma VISÃO DO SISTEMA (revisão de papéis,
 * 2026-09-05, D1): o sistema em números — pessoas, times, contas, ciclo,
 * avaliações e PDIs por estado — sem nome ao lado de nota. O desempenho das
 * pessoas é leitura de quem as lidera; o admin que também lidera um time
 * entra pelo vínculo, como qualquer gerente.
 *
 * Referência FIAP 2026-09-06 (§2 itens 1 e 2): cada bloco é uma ideia com o
 * seu número-síntese; o detalhe (a contagem por estado) vem abaixo, mais leve.
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

  const sumOf = (counts: Record<string, number>) =>
    Object.values(counts).reduce((total, count) => total + count, 0);

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
              <RevealBlock order={0}>
                <KeyFigureCard
                  label={t("dash.ops.people")}
                  value={data.people.active}
                  caption={t("dash.ops.peopleHint", { n: data.people.deactivated })}
                />
              </RevealBlock>
              <RevealBlock order={1}>
                <KeyFigureCard label={t("dash.ops.teams")} value={data.teams.active} />
              </RevealBlock>
              <RevealBlock order={2}>
                <KeyFigureCard
                  label={t("dash.ops.accounts")}
                  value={data.accounts.active}
                  caption={t("dash.ops.accountsHint", { n: data.accounts.disabled })}
                />
              </RevealBlock>
              <RevealBlock order={3}>
                <KeyFigureCard
                  label={t("dash.ops.cycle")}
                  value={data.cycle?.name ?? t("dash.ops.noCycle")}
                  tone={data.cycle ? "neutral" : "attention"}
                />
              </RevealBlock>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              <RevealBlock order={4}>
                <KeyFigureCard
                  label={t("dash.ops.assessments.title")}
                  value={sumOf(data.assessments)}
                  caption={t("dash.ops.assessments.caption")}
                >
                  <CountList
                    entries={Object.entries(data.assessments).map(([status, count]) => [
                      labels.assessmentStatus[status as keyof typeof labels.assessmentStatus] ??
                        status,
                      count,
                    ])}
                    emptyLabel={t("dash.ops.none")}
                  />
                </KeyFigureCard>
              </RevealBlock>
              <RevealBlock order={4}>
                <KeyFigureCard
                  label={t("dash.ops.plans.title")}
                  value={sumOf(data.plans)}
                  caption={t("dash.ops.plans.caption")}
                >
                  <CountList
                    entries={Object.entries(data.plans).map(([status, count]) => [
                      labels.planStatus[status as keyof typeof labels.planStatus] ?? status,
                      count,
                    ])}
                    emptyLabel={t("dash.ops.none")}
                  />
                </KeyFigureCard>
              </RevealBlock>
              <RevealBlock order={4}>
                <KeyFigureCard
                  label={t("dash.ops.accountsByRole.title")}
                  value={sumOf(data.accounts.byRole)}
                  caption={t("dash.ops.accountsByRole.caption")}
                >
                  <CountList
                    entries={Object.entries(data.accounts.byRole).map(([role, count]) => [
                      t(`users.role.${role}` as Parameters<typeof t>[0]),
                      count,
                    ])}
                    emptyLabel={t("dash.ops.none")}
                  />
                </KeyFigureCard>
              </RevealBlock>
            </div>

            <RevealBlock order={4} className="mt-6">
              <SectionCard title={t("dash.ops.shortcuts")}>
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
            </RevealBlock>
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
                <Link to="/learning-paths" className="truncate text-sm hover:underline">
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
 * O PAINEL EXECUTIVO da liderança (gerente e tech lead): o time que a pessoa
 * lidera pelo vínculo, em quatro blocos — "uma dobra, uma ideia" (referência
 * FIAP 2026-09-06, §2 item 1). Cada bloco afirma UM número: a cobertura da
 * avaliação do ciclo, as distâncias críticas, os PDIs em curso e as ações
 * que dependem de uma decisão da liderança. O detalhe fica abaixo, mais leve.
 */
function LeadHome() {
  const { t } = useI18n();
  const help = usePageHelp("dashLead");
  const presenter = useDashboardPresenter();
  const severity = useGapSeverityRuler();
  const queues = useLeadPendingQueues();

  if (presenter.noCycleRegistered) return <NoCycleRegistered title={t("dash.title")} help={help} />;

  const header = (
    <PageHeader title={t("dash.title")} description={t("dash.lead.subtitle")} help={help} />
  );

  if (queues.people.length === 0) {
    return (
      <>
        {header}
        <SectionCard title={t("dash.lead.title")}>
          <p className="text-sm font-medium">{t("dash.lead.empty.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("dash.lead.empty.body")}</p>
        </SectionCard>
      </>
    );
  }

  const people = queues.people;
  const coverage = presenter.assessmentCoverage(people);
  const gapsBySeverity = presenter.gapsBySeverity(people, severity);
  const openGaps = gapsBySeverity.low + gapsBySeverity.high + gapsBySeverity.critical;
  const criticalGaps = presenter.criticalGapCount(people);
  const approvedPlans = presenter.activePlans().filter((plan) => plan.status === "Approved");

  return (
    <>
      {header}

      <div className="grid gap-6 xl:grid-cols-2">
        <RevealBlock order={0}>
          <KeyFigureCard
            label={t("dash.cycleAssessment.title")}
            value={KeyFigureFormatter.ratio(coverage.completed, people.length)}
            format="percent"
            caption={t("dash.coverage.figureCaption", {
              completed: coverage.completed,
              total: people.length,
            })}
            help={<DashboardCardHelp card="cycleAssessment" />}
          >
            <AssessmentCoverageChart
              data={[
                {
                  status: t("dash.coverage.completed"),
                  count: coverage.completed,
                  color: "var(--gap-ok-fg)",
                },
                {
                  status: t("dash.coverage.inReview"),
                  count: coverage.inReview,
                  color: "var(--chart-2)",
                },
                {
                  status: t("dash.coverage.draft"),
                  count: coverage.draft,
                  color: "var(--gap-low-fg)",
                },
                {
                  status: t("dash.coverage.notStarted"),
                  count: coverage.notStarted,
                  color: "var(--chart-reference)",
                },
              ]}
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {t("dash.coverage.rest", {
                inReview: coverage.inReview,
                draft: coverage.draft,
                notStarted: coverage.notStarted,
              })}
            </p>
            <Link to="/progression" className="mt-3 inline-block text-sm text-primary underline">
              {t("dash.heatmap.whereItLives")}
            </Link>
          </KeyFigureCard>
        </RevealBlock>

        <RevealBlock order={1}>
          <KeyFigureCard
            label={t("dash.severity.title")}
            value={criticalGaps}
            tone={StatTones.bySeverity(criticalGaps)}
            caption={t("dash.severity.caption", { critical: criticalGaps, open: openGaps })}
            help={<DashboardCardHelp card="severity" />}
          >
            <GapSeverityChart
              data={[
                { tone: "critical" as const, color: "var(--gap-critical-fg)" },
                { tone: "high" as const, color: "var(--gap-high-fg)" },
                { tone: "low" as const, color: "var(--gap-low-fg)" },
              ].map(({ tone, color }) => ({
                severity: t(severity.messageKey[tone]),
                count: gapsBySeverity[tone],
                color,
              }))}
            />
            <Link to="/gap-analysis" className="mt-3 inline-block text-sm text-primary underline">
              {t("dash.severity.whereItLives")}
            </Link>
          </KeyFigureCard>
        </RevealBlock>

        <RevealBlock order={2}>
          <KeyFigureCard
            label={t("dash.plans.title")}
            value={approvedPlans.length}
            caption={t("dash.plans.caption", { n: approvedPlans.length, total: people.length })}
            help={<DashboardCardHelp card="activePlans" />}
          >
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <CountItem label={t("dash.stat.goalsInProgress")} count={presenter.goalsInProgress} />
              <CountItem label={t("dash.stat.goalsDone")} count={presenter.goalsDone} />
              <CountItem
                label={t("dash.lead.awaitingApproval")}
                count={queues.awaitingApproval.length}
              />
            </dl>
            <Link
              to="/development-plans"
              className="mt-3 inline-block text-sm text-primary underline"
            >
              {t("dash.plans.whereItLives")}
            </Link>
          </KeyFigureCard>
        </RevealBlock>

        <RevealBlock order={3}>
          <KeyFigureCard
            label={t("dash.lead.title")}
            value={queues.totalPending}
            tone={StatTones.byPending(queues.totalPending)}
            caption={t("dash.lead.caption", { n: people.length })}
          >
            {queues.totalPending === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dash.lead.allClear.body")}</p>
            ) : (
              <LeadQueues queues={queues} />
            )}
          </KeyFigureCard>
        </RevealBlock>
      </div>
    </>
  );
}

function CountItem({ label, count }: { label: string; count: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-lg font-semibold tabular-nums">{count}</dd>
    </div>
  );
}

/** As três filas que dependem de uma decisão da liderança — o detalhe do bloco "Ações da Liderança". */
function LeadQueues({ queues }: { queues: LeadPendingQueues }) {
  const sel = useSelectors();
  const labels = useLabels();
  const { t } = useI18n();
  const { awaitingCalibration, pendingEvidence, awaitingApproval } = queues;
  const queueEmpty = <p className="text-sm text-muted-foreground">{t("dash.lead.queueEmpty")}</p>;

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <div>
        <SectionHeading as="p" muted>
          {t("dash.lead.awaitingCalibration")}
        </SectionHeading>
        <ul className="mt-2 space-y-2">
          {awaitingCalibration.map(({ architect }) => (
            <li key={architect.id} className="surface-interactive -mx-2 rounded-md px-2 py-1">
              <Link
                to="/assessments"
                search={{ architectId: architect.id }}
                className="text-sm hover:underline"
              >
                {architect.name}
              </Link>
            </li>
          ))}
          {awaitingCalibration.length === 0 && queueEmpty}
        </ul>
      </div>

      <div>
        <SectionHeading as="p" muted>
          {t("dash.lead.pendingEvidence")}
        </SectionHeading>
        <ul className="mt-2 space-y-2">
          {pendingEvidence.map((evidence) => (
            <li key={evidence.id} className="surface-interactive -mx-2 rounded-md px-2 py-1">
              <Link
                to="/architects/$architectId"
                params={{ architectId: evidence.architectId }}
                className="text-sm hover:underline"
              >
                {sel.architectById(evidence.architectId)?.name} — {evidence.title}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">
                {labels.evidenceStatus[evidence.status]}
              </span>
            </li>
          ))}
          {pendingEvidence.length === 0 && queueEmpty}
        </ul>
      </div>

      <div>
        <SectionHeading as="p" muted>
          {t("dash.lead.awaitingApproval")}
        </SectionHeading>
        <ul className="mt-2 space-y-2">
          {awaitingApproval.map(({ architect }) => (
            <li key={architect.id} className="surface-interactive -mx-2 rounded-md px-2 py-1">
              <Link
                to="/development-plans"
                search={{ architectId: architect.id }}
                className="text-sm hover:underline"
              >
                {architect.name}
              </Link>
            </li>
          ))}
          {awaitingApproval.length === 0 && queueEmpty}
        </ul>
      </div>
    </div>
  );
}
