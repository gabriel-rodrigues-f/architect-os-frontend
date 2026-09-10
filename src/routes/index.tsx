import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  AssessmentCoverageChart,
  CapabilityRadar,
  DashboardCardHelp,
  EmptyStateCallToAction,
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
import { CoverageRuler, CriticalConcentrationRuler } from "@/lib/scoring-bands";
import { defaultDateFormatter } from "@/lib/text";
import { EmptySubject } from "@/lib/empty-subject";
import { useI18n } from "@/lib/i18n";
import { Registration } from "@/lib/registration";
import type { DevelopmentPlan, Professional } from "@/lib/domain";
import { useLabels } from "@/lib/labels";
import { usePageHelp } from "@/lib/page-help";
import { useGapSeverityRuler, useSelectors, useStore } from "@/lib/store";
import { RadarRows } from "@/lib/view-models";

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
  "professionals",
  "assessments",
  "capabilities",
  "competencies",
  "cycles",
  "activeCycle",
  "plans",
  "learningPaths",
  "mentoringSessions",
];

/**
 * PR 5 (adendo do dono, 2026-09-08) — o Painel de operação é de quem opera o
 * sistema: o suporte (o antigo admin) e o administrador. A leitura de
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
  /*
   * A régua do vazio pegou o Painel junto (dono, 2026-09-08, item 3): aqui a
   * frase era escrita à mão ("Não há ciclos cadastrados") e o botão tinha
   * palavra própria ("Cadastrar ciclo"). Agora é o MESMO bloco das doze
   * telas — linha 1 do assunto, linha 2 desta tela, botão do `Registration`.
   */
  return (
    <>
      <PageHeader title={title} help={help} />
      <EmptyStateCallToAction
        subject={EmptySubject.CYCLE}
        hint={t("dash.noCycle.body")}
        registrations={[Registration.CYCLE]}
      />
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
  const professionalId = user.professionalId;
  const professional = professionalId ? sel.professionalById(professionalId) : undefined;

  if (!professionalId || !professional) {
    return (
      <>
        <PageHeader title={t("dash.member.title")} help={help} />
        <SectionCard title={t("dash.member.unlinked.title")}>
          <p className="text-sm text-muted-foreground">{t("dash.member.unlinked.body")}</p>
        </SectionCard>
      </>
    );
  }

  const assessment = sel.assessmentFor(professionalId);
  const plan = sel.planFor(professionalId);
  const itemsByStatus = personal.planItemCounts(professionalId);
  const paths = personal.assignedPaths(professionalId);
  // D2 (dono, 2026-09-05): a pessoa vê os PRÓPRIOS números — radar, distâncias, aderência.
  /*
   * A MESMA RÉGUA DO RADAR COMPARATIVO E DA FICHA (`RadarRows`): sem medida é
   * ausência, nunca zero. Zero é o CENTRO do radar — com o `?? 0` de antes, a
   * capacidade que ninguém tinha medido virava um ponto no meio, a aresta
   * atravessava o polígono, e o Painel afirmava "você tem zero aqui" para
   * quem só não foi avaliado nessa capacidade.
   */
  const ownRadar = RadarRows.currentAgainstTarget(sel.capabilityAverages(professionalId));
  const ownGaps = personal.openGaps(professionalId).slice(0, 6);

  return (
    <>
      <PageHeader
        title={t("dash.member.title")}
        description={t("dash.member.subtitle", { nome: professional.name })}
        help={help}
      />

      {/*
       * Esta faixa era um par — situação da avaliação e evidências pendentes —
       * num `sm:grid-cols-2`. Com a evidência fora do produto (dono,
       * 2026-09-08, regra 17) sobrou um cartão só, e meia largura com um vão
       * ao lado não é layout: a situação da avaliação passa a ocupar a faixa
       * inteira, como o único número que abre o Painel da pessoa.
       */}
      <StatCard
        label={t("dash.member.assessmentStatus")}
        help={<DashboardCardHelp card="memberAssessment" />}
        value={
          assessment ? labels.assessmentStatus[assessment.status] : t("dash.member.noAssessment")
        }
        icon={<ClipboardCheck className="h-4 w-4" />}
        tone={assessment?.status === "Completed" ? "good" : "attention"}
      />

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
            to="/professionals/$professionalId/roadmap"
            params={{ professionalId }}
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
            search={{ professionalId }}
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
  const { t, locale } = useI18n();
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
  /*
   * O numerador do PDI vinha de `activePlans()` — TODO o recorte que a API
   * entregou, com pessoas desativadas e o próprio líder dentro —, enquanto o
   * denominador contava só as pessoas ativas sob liderança. Bastava uma
   * pessoa desativada com PDI aprovado para o cartão passar de 100%
   * (`painel-executivo-analise-2026-09-09.md`, A.3-4).
   */
  const approvedPlans = presenter.approvedPlansOf(people);
  /*
   * A cobertura é o único KPI percentual da tela e saía SEM TOM: o padrão
   * `neutral` tem estilo vazio, então 20% e 95% apareciam na mesma cor. Os
   * cortes da régua vêm da leitura escrita na análise (D.2, KPI 1).
   */
  const coverageRatio = KeyFigureFormatter.ratio(coverage.completed, people.length);
  const coverageBand = CoverageRuler.read(coverageRatio);
  const concentration = CriticalConcentrationRuler.read(criticalGaps, openGaps);
  const criticalByPerson = presenter.criticalGapsByProfessional(people);

  return (
    <>
      {header}

      {/*
       * Dono (2026-09-08, item 8): o "bloco vazio com moldura" à direita era
       * o cartão parando na altura do próprio conteúdo dentro de uma célula
       * de grade já esticada. `h-full` vai no CARTÃO (e no bloco de revelação
       * que o embrulha), nunca no conteúdo.
       */}
      <div className="grid gap-6 xl:grid-cols-2">
        <RevealBlock order={0} className="h-full">
          <KeyFigureCard
            className="h-full"
            label={t("dash.cycleAssessment.title")}
            /*
             * A FRAÇÃO é o número grande, o percentual é a legenda: com
             * denominador 10, o indicador só assume múltiplos de 10 p.p., e
             * "80%" esconde que o passo mínimo é uma pessoa inteira.
             */
            value={t("dash.coverage.figureValue", {
              completed: coverage.completed,
              total: people.length,
            })}
            tone={StatTones.ofBand(coverageBand.tone)}
            caption={t("dash.coverage.figureCaption", {
              percent: new KeyFigureFormatter(locale).format(coverageRatio, "percent"),
              band: t(coverageBand.labelKey),
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

        <RevealBlock order={1} className="h-full">
          <KeyFigureCard
            className="h-full"
            label={t("dash.severity.title")}
            value={criticalGaps}
            tone={StatTones.ofBand(concentration.tone)}
            caption={t("dash.severity.caption", {
              critical: criticalGaps,
              open: openGaps,
              band: t(concentration.labelKey),
            })}
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
            {/*
             * O agregado apaga a única informação que muda decisão: no banco
             * do dono, 100% das 21 distâncias críticas estavam em DUAS
             * pessoas. Nesta escala, "onde agir" resolve em nomes.
             */}
            <PeopleSignalList
              className="mt-6"
              title={t("dash.severity.people.title")}
              emptyLabel={t("dash.severity.people.none")}
              entries={criticalByPerson.map(({ professional, count }) => ({
                professional,
                detail: t("dash.severity.people.detail", { n: count }),
              }))}
            />
            <Link to="/gap-analysis" className="mt-3 inline-block text-sm text-primary underline">
              {t("dash.severity.whereItLives")}
            </Link>
          </KeyFigureCard>
        </RevealBlock>

        <RevealBlock order={2} className="h-full">
          <KeyFigureCard
            className="h-full"
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

        <RevealBlock order={3} className="h-full">
          <KeyFigureCard
            className="h-full"
            label={t("dash.lead.title")}
            value={queues.totalPending}
            tone={StatTones.byPending(queues.totalPending)}
            caption={t("dash.lead.caption", { n: people.length })}
            help={<DashboardCardHelp card="leadActions" />}
          >
            {queues.totalPending === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dash.lead.allClear.body")}</p>
            ) : (
              <LeadQueues queues={queues} />
            )}
          </KeyFigureCard>
        </RevealBlock>
      </div>

      <RevealBlock order={4} className="mt-6">
        <FollowUpSection people={people} presenter={presenter} />
      </RevealBlock>
    </>
  );
}

/**
 * ACOMPANHAMENTO DO TIME — os três sinais que o Painel já recebia de graça e
 * não usava: `mentoringSessions` e `learningPaths` estão entre os nove
 * conjuntos que a tela carrega desde sempre.
 *
 * Os três terminam em NOME, não em média: dias desde a última 1:1, 1:1 de
 * retorno vencida e trilha atribuída que não andou. Nenhum deles tem faixa de
 * cor — não há régua assinada para eles, e cor sem régua é a mesma falha que
 * esta onda está fechando no cartão de cobertura.
 */
function FollowUpSection({
  people,
  presenter,
}: {
  people: readonly Professional[];
  presenter: DashboardPresenter;
}) {
  const { t, locale } = useI18n();

  const recency = [...presenter.oneOnOneRecency(people)].sort(
    (esquerda, direita) =>
      (direita.days ?? Number.POSITIVE_INFINITY) - (esquerda.days ?? Number.POSITIVE_INFINITY),
  );
  const overdue = presenter.overdueFollowUps(people);
  const stalled = presenter.stalledPaths(people);

  return (
    <SectionCard title={t("dash.followUp.title")} description={t("dash.followUp.subtitle")}>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <PeopleSignalList
          title={t("dash.followUp.recency.title")}
          emptyLabel={t("dash.followUp.recency.none")}
          entries={recency.map(({ professional, days }) => ({
            professional,
            detail:
              days === null
                ? t("dash.followUp.recency.never")
                : t("dash.followUp.recency.detail", { n: days }),
          }))}
        />
        <PeopleSignalList
          title={t("dash.followUp.overdue.title")}
          emptyLabel={t("dash.followUp.overdue.none")}
          entries={overdue.map(({ professional, dueOn }) => ({
            professional,
            detail: t("dash.followUp.overdue.detail", {
              data: defaultDateFormatter.formatDate(dueOn, locale) ?? dueOn,
            }),
          }))}
        />
        <PeopleSignalList
          title={t("dash.followUp.stalled.title")}
          emptyLabel={t("dash.followUp.stalled.none")}
          entries={stalled.map(({ professional, path }) => ({
            professional,
            detail: t("dash.followUp.stalled.detail", { trilha: path.name }),
          }))}
        />
      </div>
    </SectionCard>
  );
}

/**
 * O NOME DE UMA PESSOA, levando ao lugar onde se age sobre ela.
 *
 * Cinco listas do Painel escrevem o mesmo link — as duas filas da liderança,
 * a lista de distância crítica e os três sinais de acompanhamento —, então é
 * um componente só (regra de reuso). Sem `to`, o destino é a FICHA: é o que
 * a lista de distância crítica precisa, porque o nome sem caminho para a
 * ficha continua sendo agregado.
 */
const PERSON_LINK_CLASS = "truncate text-body hover:underline";

function PersonLink({
  professional,
  to,
}: {
  professional: { id: string; name: string };
  to?: "/assessments" | "/development-plans";
}) {
  if (to) {
    return (
      <Link to={to} search={{ professionalId: professional.id }} className={PERSON_LINK_CLASS}>
        {professional.name}
      </Link>
    );
  }
  return (
    <Link
      to="/professionals/$professionalId"
      params={{ professionalId: professional.id }}
      className={PERSON_LINK_CLASS}
    >
      {professional.name}
    </Link>
  );
}

/**
 * UMA LISTA NOMINAL: o título, as pessoas, o motivo de cada uma e o caminho
 * para a ficha. Quatro blocos do Painel têm exatamente esta forma (distância
 * crítica e os três sinais de acompanhamento), então é um componente só —
 * regra de reuso: o que serve a dois lugares vira componente.
 */
function PeopleSignalList({
  title,
  entries,
  emptyLabel,
  className,
}: {
  title: string;
  entries: readonly { professional: Professional; detail: string }[];
  emptyLabel: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <SectionHeading as="p" muted>
        {title}
      </SectionHeading>
      {entries.length === 0 ? (
        <p className="mt-2 text-body text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {entries.map(({ professional, detail }) => (
            <li
              key={professional.id}
              className="surface-interactive -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1"
            >
              <PersonLink professional={professional} />
              <span className="shrink-0 text-meta text-muted-foreground">{detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
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

/**
 * As DUAS filas que dependem de uma decisão da liderança — o detalhe do bloco
 * "Ações da Liderança". Eram três: a fila do meio era a de evidências a
 * revisar, que saiu com a evidência (dono, 2026-09-08, regra 17). O grid
 * acompanhou de três para duas colunas, senão a faixa ficaria com um vão à
 * direita.
 */
function LeadQueues({ queues }: { queues: LeadPendingQueues }) {
  const { t } = useI18n();
  const { awaitingCalibration, awaitingApproval } = queues;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <LeadQueueColumn
        title={t("dash.lead.awaitingCalibration")}
        people={awaitingCalibration}
        to="/assessments"
      />
      <LeadQueueColumn
        title={t("dash.lead.awaitingApproval")}
        people={awaitingApproval}
        to="/development-plans"
      />
    </div>
  );
}

/**
 * Uma fila: o título, as pessoas que esperam a decisão — cada nome levando à
 * tela onde a decisão se toma — e o vazio quando não espera ninguém. As duas
 * filas têm a mesma forma, então são o mesmo componente.
 */
function LeadQueueColumn({
  title,
  people,
  to,
}: {
  title: string;
  people: readonly { professional: { id: string; name: string } }[];
  to: "/assessments" | "/development-plans";
}) {
  const { t } = useI18n();
  return (
    <div>
      <SectionHeading as="p" muted>
        {title}
      </SectionHeading>
      <ul className="mt-2 space-y-2">
        {people.map(({ professional }) => (
          <li key={professional.id} className="surface-interactive -mx-2 rounded-md px-2 py-1">
            <PersonLink professional={professional} to={to} />
          </li>
        ))}
        {people.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("dash.lead.queueEmpty")}</p>
        )}
      </ul>
    </div>
  );
}
