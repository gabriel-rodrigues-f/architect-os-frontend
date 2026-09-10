import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Chip } from "@/components/app/Chip";
import { DashboardCardHelp } from "@/components/app/CardHelp";
import { CycleFunnelChart } from "@/components/app/charts";
import { EmptyState, SectionCard, SectionGroup } from "@/components/app/ui-bits";
import { KeyFigure, KeyFigureCard, StatTones } from "@/components/app/KeyFigure";
import { RevealBlock } from "@/components/app/RevealBlock";
import { SectionHeading } from "@/components/app/SectionHeading";
import { SentenceBlock } from "@/components/app/SentenceBlock";
import { textLinkClass } from "@/components/app/TextLink";
import type {
  ActionReason,
  CycleFunnel,
  CycleFunnelStepKind,
  ExecutiveBriefing,
  Fraction,
  MissingRulerReason,
  NamedPerson,
} from "@/lib/gateways/executive-dashboard.gateway";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { KeyFigureFormatter } from "@/lib/key-figure-format";
import { CoverageRuler } from "@/lib/scoring-bands";
import { defaultDateFormatter } from "@/lib/text";

/**
 * O PAINEL EXECUTIVO — os sete blocos que o dono nomeou, na ordem em que a
 * análise os pôs (`painel-executivo-analise-2026-09-09.md`, C):
 * leitura do ciclo · Executive Summary · Saúde do Ciclo · Geração de Valor ·
 * Tendências · Riscos · Ações recomendadas.
 *
 * TRÊS COISAS QUE ESTA TELA NÃO FAZ, e é por decisão medida:
 *
 *  1. **Nenhum KPI leva seta.** Leva os dois valores e os dois ciclos
 *     nomeados. A direção da seta INVERTE conforme a metodologia — sobre
 *     todas as avaliações concluídas a distância média piorou; sobre os pares
 *     comuns aos dois ciclos, melhorou 24% — e a causa inteira eram três
 *     pessoas. A régua ("seta só acima de 1/N da base comparável") vem do
 *     servidor e é escrita no rodapé.
 *  2. **Um gráfico só na tela inteira**, o funil, e ele responde uma
 *     pergunta: em que degrau o ciclo travou e de quem é a ação.
 *  3. **Nenhuma frase passa por IA.** As duas frases de leitura são MOLDE do
 *     catálogo de texto, preenchido pelos números que já estão na tela. Se um
 *     insumo faltar, a oração não é escrita — não é preenchida com padrão.
 */

const FUNNEL_STEP_LABEL: Record<CycleFunnelStepKind, MessageKey> = {
  NOT_STARTED: "panel.funnel.notStarted",
  DRAFT: "panel.funnel.draft",
  IN_REVIEW: "panel.funnel.inReview",
  COMPLETED: "panel.funnel.completed",
};

const FUNNEL_STEP_COLOR: Record<CycleFunnelStepKind, string> = {
  NOT_STARTED: "var(--chart-reference)",
  DRAFT: "var(--gap-low-fg)",
  IN_REVIEW: "var(--chart-2)",
  COMPLETED: "var(--gap-ok-fg)",
};

const ACTION_LABEL: Record<ActionReason, MessageKey> = {
  OVERDUE_ONE_ON_ONE: "panel.action.overdueOneOnOne",
  ASSESSMENT_NOT_COMPLETED: "panel.action.assessmentOpen",
  NO_APPROVED_PLAN: "panel.action.noPlan",
  CRITICAL_GAP_CONCENTRATION: "panel.action.criticalGap",
  STALLED_LEARNING_PATH: "panel.action.stalledPath",
};

const MISSING_RULER_LABEL: Record<MissingRulerReason, MessageKey> = {
  NO_CAREER_LEVEL: "panel.ruler.noCareerLevel",
  AT_TOP_LEVEL: "panel.ruler.atTopLevel",
  EMPTY_TEAM_RULER: "panel.ruler.emptyTeamRuler",
};

export function ExecutivePanel({ briefing }: { briefing: ExecutiveBriefing }) {
  return (
    <>
      <RevealBlock order={0}>
        <CycleReading briefing={briefing} />
      </RevealBlock>
      <RevealBlock order={0} className="mt-6">
        <ExecutiveSummary briefing={briefing} />
      </RevealBlock>
      <RevealBlock order={1} className="mt-6">
        <CycleHealthBlock briefing={briefing} />
      </RevealBlock>
      <RevealBlock order={2} className="mt-6">
        <ValueCreatedBlock briefing={briefing} />
      </RevealBlock>
      <RevealBlock order={3} className="mt-6">
        <TrendBlock briefing={briefing} />
      </RevealBlock>
      <RevealBlock order={4} className="mt-6">
        <RisksBlock briefing={briefing} />
      </RevealBlock>
      <RevealBlock order={4} className="mt-6">
        <RecommendedActionsBlock briefing={briefing} />
      </RevealBlock>
      <RevealBlock order={4} className="mt-6">
        <HowThisWasCalculated briefing={briefing} />
      </RevealBlock>
    </>
  );
}

/**
 * INSIGHT É CÁLCULO, NUNCA IA (ordem do dono). Duas frases de molde, montadas
 * dos KPIs que já estão na tela — sem número novo, sem juízo acrescentado, e
 * a oração de comparação só é escrita quando existe ciclo com que comparar.
 */
function CycleReading({ briefing }: { briefing: ExecutiveBriefing }) {
  const { t } = useI18n();
  const movement = briefing.valueCreated.movement;
  const carriers = briefing.risks.criticalGapConcentration.carriers;
  return (
    <section className="max-w-[68ch]">
      <p className="text-body text-foreground">
        <SentenceBlock
          text={t("panel.reading.where", {
            ciclo: briefing.cycle.name,
            n: briefing.coverage.completed.part,
            total: briefing.coverage.completed.whole,
          })}
        />
      </p>
      {movement && (
        <p className="mt-2 text-body text-muted-foreground">
          <SentenceBlock
            text={t("panel.reading.movement", {
              a: movement.advanced.length,
              b: movement.regressed.length,
              c: movement.steady.length,
              cicloA: movement.from.name,
              cicloB: movement.to.name,
            })}
          />
        </p>
      )}
      {carriers.length > 0 && (
        <p className="mt-2 text-body text-muted-foreground">
          {t("panel.reading.critical", { d: carriers.length })}
        </p>
      )}
    </section>
  );
}

function ExecutiveSummary({ briefing }: { briefing: ExecutiveBriefing }) {
  const { t, locale } = useI18n();
  const ratio = KeyFigureFormatter.ratio(
    briefing.coverage.completed.part,
    briefing.coverage.completed.whole,
  );
  const band = CoverageRuler.read(ratio);
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <KeyFigureCard
        className="h-full"
        label={t("panel.coverage.title")}
        value={t("dash.coverage.figureValue", {
          completed: briefing.coverage.completed.part,
          total: briefing.coverage.completed.whole,
        })}
        tone={StatTones.ofBand(band.tone)}
        caption={t("dash.coverage.figureCaption", {
          percent: new KeyFigureFormatter(locale).format(ratio, "percent"),
          band: t(band.labelKey),
        })}
        help={<DashboardCardHelp card="cycleAssessment" />}
      >
        {briefing.previousCoverage ? (
          <p className="text-meta text-muted-foreground">
            {t("panel.coverage.previous", {
              ciclo: briefing.previousCoverage.cycle.name,
              n: briefing.previousCoverage.completed.part,
              total: briefing.previousCoverage.completed.whole,
            })}
          </p>
        ) : (
          <p className="text-meta text-muted-foreground">{t("panel.coverage.noPrevious")}</p>
        )}
      </KeyFigureCard>

      <KeyFigureCard
        className="h-full"
        label={t("panel.desk.title")}
        value={briefing.decisionsOnTheDesk.total}
        tone={StatTones.byPending(briefing.decisionsOnTheDesk.total)}
        caption={t("panel.desk.caption")}
        help={<DashboardCardHelp card="leadActions" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <PersonQueue
            title={t("dash.lead.awaitingCalibration")}
            people={briefing.decisionsOnTheDesk.awaitingCalibration}
            to="/assessments"
          />
          <PersonQueue
            title={t("dash.lead.awaitingApproval")}
            people={briefing.decisionsOnTheDesk.awaitingPlanApproval}
            to="/development-plans"
          />
        </div>
      </KeyFigureCard>

      <KeyFigureCard
        className="h-full"
        label={t("panel.needYou.title")}
        value={t("dash.coverage.figureValue", {
          completed: briefing.peopleWhoNeedYou.part,
          total: briefing.peopleWhoNeedYou.whole,
        })}
        tone={StatTones.byPending(briefing.peopleWhoNeedYou.part)}
        caption={t("panel.needYou.caption")}
      />
    </div>
  );
}

function CycleHealthBlock({ briefing }: { briefing: ExecutiveBriefing }) {
  const { t } = useI18n();
  const { health } = briefing;
  return (
    <SectionGroup title={t("panel.health.title")} description={t("panel.health.subtitle")}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard title={t("panel.funnel.title")} description={t("panel.funnel.subtitle")}>
          <FunnelBars funnel={health.funnel} />
          {health.previousFunnel && (
            <p className="mt-3 text-meta text-muted-foreground">
              {t("panel.funnel.previous", {
                ciclo: health.previousFunnel.cycle.name,
                degraus: health.previousFunnel.steps.map((step) => step.people).join(" / "),
              })}
            </p>
          )}
          {health.funnel.biggestHoldUp.length > 0 && (
            <p className="mt-2 text-meta text-foreground">
              {t("panel.funnel.holdUp", {
                degrau: health.funnel.biggestHoldUp
                  .map((kind) => t(FUNNEL_STEP_LABEL[kind]))
                  .join(" · "),
              })}
            </p>
          )}
        </SectionCard>

        <SectionCard
          title={t("panel.plans.title")}
          description={t("panel.plans.subtitle")}
          help={<DashboardCardHelp card="activePlans" />}
        >
          <FractionFigure label={t("panel.plans.title")} fraction={health.planCoverage.approved} />
          <p className="mt-2 text-meta text-muted-foreground">
            {t("panel.plans.goals", {
              n: health.goalsCompleted.part,
              total: health.goalsCompleted.whole,
            })}
          </p>
          <PersonList
            className="mt-4"
            title={t("panel.plans.without")}
            people={health.peopleWithoutPlan}
            emptyLabel={t("panel.plans.everyoneHasOne")}
          />
          <PersonList
            className="mt-4"
            title={t("panel.unscored.title")}
            people={health.openAndUnscored}
            emptyLabel={t("panel.unscored.none")}
          />
        </SectionCard>
      </div>
    </SectionGroup>
  );
}

function ValueCreatedBlock({ briefing }: { briefing: ExecutiveBriefing }) {
  const { t, locale } = useI18n();
  const { movement, gapMovement, promotions } = briefing.valueCreated;
  return (
    <SectionGroup title={t("panel.value.title")} description={t("panel.value.subtitle")}>
      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard title={t("panel.movement.title")}>
          {movement ? (
            <>
              <MovementRow
                tone="success"
                label={t("panel.movement.advanced", { n: movement.advanced.length })}
                people={movement.advanced}
              />
              <MovementRow
                tone="neutral"
                label={t("panel.movement.steady", { n: movement.steady.length })}
                people={movement.steady}
              />
              <MovementRow
                tone="danger"
                label={t("panel.movement.regressed", { n: movement.regressed.length })}
                people={movement.regressed}
              />
              <p className="mt-3 text-meta text-muted-foreground">
                {t("panel.movement.base", {
                  n: movement.comparablePeople,
                  cicloA: movement.from.name,
                  cicloB: movement.to.name,
                  saiu: movement.leftMeasurement,
                  entrou: movement.joinedMeasurement,
                })}
              </p>
            </>
          ) : (
            <EmptyState title={t("panel.movement.noBase")} hint={t("panel.movement.noBase.hint")} />
          )}
        </SectionCard>

        <SectionCard title={t("panel.gaps.title")}>
          {gapMovement ? (
            <>
              <dl className="space-y-2 text-body">
                {gapMovement.moves.map((move) => (
                  <div key={move.kind} className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">
                      {t(`panel.gaps.${move.kind}` as MessageKey)}
                    </dt>
                    <dd className="font-display text-body font-semibold tabular-nums">
                      {move.pairs}
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t("panel.gaps.firstMeasurement")}</dt>
                  <dd className="font-display text-body font-semibold tabular-nums">
                    {gapMovement.firstMeasurementPairs}
                  </dd>
                </div>
              </dl>
              {gapMovement.largestContributorToClosures && (
                <p className="mt-3 text-meta text-foreground">
                  {t("panel.gaps.attribution", {
                    nome: gapMovement.largestContributorToClosures.name,
                    n: gapMovement.largestContributorToClosures.closed,
                  })}
                </p>
              )}
              <p className="mt-2 text-meta text-muted-foreground">
                {t("panel.gaps.base", { n: gapMovement.comparablePeople })}
              </p>
            </>
          ) : (
            <EmptyState title={t("panel.gaps.noBase")} hint={t("panel.gaps.noBase.hint")} />
          )}
        </SectionCard>

        <SectionCard title={t("panel.promotions.title")}>
          {promotions.length === 0 ? (
            <EmptyState title={t("panel.promotions.none")} hint={t("panel.promotions.none.hint")} />
          ) : (
            <ul className="space-y-2">
              {promotions.map((promotion) => (
                <li
                  key={`${promotion.professionalId}-${promotion.occurredAt}`}
                  className="flex items-center justify-between gap-3"
                >
                  <PersonLink person={promotion} />
                  <span className="shrink-0 text-meta text-muted-foreground">
                    {t("panel.promotions.detail", {
                      de: promotion.fromRole,
                      para: promotion.toRole,
                      data:
                        defaultDateFormatter.formatDate(promotion.occurredAt, locale) ??
                        promotion.occurredAt,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-meta text-muted-foreground">{t("panel.promotions.noRate")}</p>
        </SectionCard>
      </div>
    </SectionGroup>
  );
}

/**
 * TENDÊNCIAS NASCE VAZIO, E DIZ POR QUÊ.
 *
 * Duas leituras não são série, e desenhar uma linha de dois pontos — com o
 * mais recente em data futura — seria a mentira mais fácil desta tela. A
 * frase é a que a análise redigiu e que passou pela régua; o número de ciclos
 * lidos vem do servidor, então o bloco se abre sozinho no dia em que houver o
 * terceiro.
 */
function TrendBlock({ briefing }: { briefing: ExecutiveBriefing }) {
  const { t } = useI18n();
  const { trend } = briefing;
  return (
    <SectionGroup title={t("panel.trend.title")} description={t("panel.trend.subtitle")}>
      {trend.available ? (
        <SectionCard title={t("panel.trend.ready.title")}>
          <p className="text-body text-muted-foreground">
            {t("panel.trend.ready.body", { n: trend.cyclesWithReading })}
          </p>
        </SectionCard>
      ) : (
        <EmptyState
          title={t("panel.trend.empty.title")}
          hint={t("panel.trend.empty.body", {
            faltam: trend.cyclesRequired,
            hoje: trend.cyclesWithReading,
            ciclos: trend.cycleNamesWithReading.join(", "),
          })}
        />
      )}
    </SectionGroup>
  );
}

function RisksBlock({ briefing }: { briefing: ExecutiveBriefing }) {
  const { t, locale } = useI18n();
  const { risks } = briefing;
  const critical = risks.criticalGapConcentration;
  return (
    <SectionGroup title={t("panel.risks.title")} description={t("panel.risks.subtitle")}>
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title={t("panel.critical.title")} help={<DashboardCardHelp card="severity" />}>
          {critical.carriers.length === 0 ? (
            <EmptyState title={t("panel.critical.none")} hint={t("panel.critical.none.hint")} />
          ) : (
            <ul className="space-y-2">
              {critical.carriers.map((carrier) => (
                <li
                  key={carrier.professionalId}
                  className="flex items-center justify-between gap-3"
                >
                  <PersonLink person={carrier} />
                  <Chip
                    tone={
                      carrier.competencies >= critical.minimumCompetencies ? "danger" : "warning"
                    }
                  >
                    {t("panel.critical.detail", { n: carrier.competencies })}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-meta text-muted-foreground">
            {t("panel.critical.legend", {
              media: GapReading.format(critical.averageGap, locale),
              anterior: GapReading.format(critical.previousAverageGap, locale),
              zerados: critical.assessedWithNoCriticalGap,
            })}
          </p>
        </SectionCard>

        <SectionCard title={t("panel.followUp.title")}>
          <PersonList
            title={t("panel.followUp.overdue", { n: risks.overdueFollowUps.length })}
            people={risks.overdueFollowUps}
            emptyLabel={t("panel.followUp.overdue.none")}
            detailOf={(person) =>
              t("panel.followUp.overdue.detail", {
                data:
                  defaultDateFormatter.formatDate(
                    risks.overdueFollowUps.find(
                      (row) => row.professionalId === person.professionalId,
                    )?.dueOn ?? "",
                    locale,
                  ) ?? "",
              })
            }
          />
          <p className="mt-3 text-meta text-muted-foreground">
            {risks.longestSilenceDays === null
              ? t("panel.followUp.silence.never")
              : t("panel.followUp.silence", { n: risks.longestSilenceDays })}
          </p>
          <PersonList
            className="mt-4"
            title={t("panel.paths.title")}
            people={risks.stalledLearningPaths}
            emptyLabel={t("panel.paths.none")}
            detailOf={(person) => {
              const row = risks.stalledLearningPaths.find(
                (one) => one.professionalId === person.professionalId,
              );
              return row
                ? t("panel.paths.detail", { trilha: row.pathName, total: row.totalItems })
                : "";
            }}
          />
        </SectionCard>

        <SectionCard title={t("panel.ruler.title")}>
          <FractionFigure
            label={t("panel.ruler.title")}
            fraction={risks.withoutApplicableRuler.people}
          />
          {risks.withoutApplicableRuler.groups.length === 0 ? (
            <p className="mt-3 text-body text-muted-foreground">{t("panel.ruler.none")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {risks.withoutApplicableRuler.groups.map((group) => (
                <li key={group.reason} className="flex items-center justify-between gap-3">
                  <span className="text-body text-muted-foreground">
                    {t(MISSING_RULER_LABEL[group.reason])}
                  </span>
                  <Chip tone="warning">{group.people.length}</Chip>
                </li>
              ))}
            </ul>
          )}
          <Link to="/team-rules" className={cn("mt-3 inline-block text-body", textLinkClass)}>
            {t("panel.ruler.whereItLives")}
          </Link>
        </SectionCard>

        <SectionCard title={t("panel.dependencies.title")}>
          <p className="text-body text-muted-foreground">{t("panel.dependencies.subtitle")}</p>
          <ul className="mt-3 space-y-3">
            {briefing.documentedDependencies.map((dependency) => (
              <li key={dependency.kpi}>
                <p className="text-body text-foreground">{dependency.kpi}</p>
                <p className="text-meta text-muted-foreground">{dependency.missing}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </SectionGroup>
  );
}

function RecommendedActionsBlock({ briefing }: { briefing: ExecutiveBriefing }) {
  const { t } = useI18n();
  return (
    <SectionCard title={t("panel.actions.title")} description={t("panel.actions.subtitle")}>
      {briefing.recommendedActions.length === 0 ? (
        <EmptyState title={t("panel.actions.none")} hint={t("panel.actions.none.hint")} />
      ) : (
        <ul className="space-y-2">
          {briefing.recommendedActions.map((action) => (
            <li
              key={action.professionalId}
              className="surface-interactive -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1"
            >
              <PersonLink person={action} />
              <Chip tone="info">{t(ACTION_LABEL[action.reason])}</Chip>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-meta text-muted-foreground">
        {t("panel.actions.weights", {
          ordem: briefing.actionWeights.map((reason) => t(ACTION_LABEL[reason])).join(" > "),
        })}
      </p>
    </SectionCard>
  );
}

/**
 * COMO ESTE PAINEL FOI CALCULADO — o rodapé metodológico, e o lugar onde a
 * régua da seta fica escrita para quem lê a tela, não só para quem lê o
 * código.
 */
function HowThisWasCalculated({ briefing }: { briefing: ExecutiveBriefing }) {
  const { t } = useI18n();
  return (
    <section className="text-meta text-muted-foreground">
      <SectionHeading as="p" muted>
        {t("panel.method.title")}
      </SectionHeading>
      <ul className="mt-2 space-y-1">
        <li>
          {t("panel.method.population", {
            n: briefing.population.inScope,
            fora: briefing.population.outOfScope,
          })}
        </li>
        <li>
          {briefing.comparedCycle
            ? t("panel.method.comparison", { ciclo: briefing.comparedCycle.name })
            : t("panel.method.noComparison")}
        </li>
        <li>
          {briefing.arrowRuler.comparablePeople === 0
            ? t("panel.method.noArrowBase")
            : t("panel.method.arrow", { n: briefing.arrowRuler.comparablePeople })}
        </li>
        <li>
          <Link to="/system-view" className={textLinkClass}>
            {t("panel.method.systemView")}
          </Link>
        </li>
      </ul>
    </section>
  );
}

function FunnelBars({ funnel }: { funnel: CycleFunnel }) {
  const { t } = useI18n();
  return (
    <CycleFunnelChart
      data={funnel.steps.map((step) => ({
        step: t(FUNNEL_STEP_LABEL[step.kind]),
        people: step.people,
        color: FUNNEL_STEP_COLOR[step.kind],
      }))}
    />
  );
}

/**
 * A FRAÇÃO é o número; o percentual é legenda — nunca o contrário. E ela sai
 * pelo `KeyFigure`, como todo número-síntese da casa: escrever o valor à mão
 * é o que faz duas telas publicarem o mesmo número com pesos diferentes.
 */
function FractionFigure({ label, fraction }: { label: string; fraction: Fraction }) {
  const { t } = useI18n();
  return (
    <KeyFigure
      as="p"
      size="sm"
      label={label}
      value={t("dash.coverage.figureValue", { completed: fraction.part, total: fraction.whole })}
    />
  );
}

function MovementRow({
  tone,
  label,
  people,
}: {
  tone: "success" | "neutral" | "danger";
  label: string;
  people: readonly NamedPerson[];
}) {
  return (
    <div className="mt-3 first:mt-0">
      <Chip tone={tone}>{label}</Chip>
      {people.length > 0 && (
        <p className="mt-1 text-meta text-muted-foreground">
          {people.map((person) => person.name).join(" · ")}
        </p>
      )}
    </div>
  );
}

function PersonLink({ person }: { person: NamedPerson }) {
  return (
    <Link
      to="/professionals/$professionalId"
      params={{ professionalId: person.professionalId }}
      className={cn("truncate text-body", textLinkClass)}
    >
      {person.name}
    </Link>
  );
}

function PersonQueue({
  title,
  people,
  to,
}: {
  title: string;
  people: readonly NamedPerson[];
  to: "/assessments" | "/development-plans";
}) {
  const { t } = useI18n();
  return (
    <div>
      <SectionHeading as="p" muted>
        {title}
      </SectionHeading>
      <ul className="mt-2 space-y-2">
        {people.map((person) => (
          <li
            key={person.professionalId}
            className="surface-interactive -mx-2 rounded-md px-2 py-1"
          >
            <Link
              to={to}
              search={{ professionalId: person.professionalId }}
              className={cn("truncate text-body", textLinkClass)}
            >
              {person.name}
            </Link>
          </li>
        ))}
        {people.length === 0 && (
          <p className="text-body text-muted-foreground">{t("dash.lead.queueEmpty")}</p>
        )}
      </ul>
    </div>
  );
}

/**
 * UMA LISTA NOMINAL: quatro blocos do Painel têm exatamente esta forma, então
 * é um componente só — o que serve a dois lugares vira componente.
 */
function PersonList({
  title,
  people,
  emptyLabel,
  detailOf,
  className,
}: {
  title: string;
  people: readonly NamedPerson[];
  emptyLabel: string;
  detailOf?: (person: NamedPerson) => string;
  className?: string;
}): ReactNode {
  return (
    <div className={className}>
      <SectionHeading as="p" muted>
        {title}
      </SectionHeading>
      {people.length === 0 ? (
        <p className="mt-2 text-body text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {people.map((person) => (
            <li
              key={person.professionalId}
              className="surface-interactive -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1"
            >
              <PersonLink person={person} />
              {detailOf && (
                <span className="shrink-0 text-meta text-muted-foreground">{detailOf(person)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Sem medida é ausência, nunca zero — o travessão é o símbolo único da casa. */
class GapReading {
  static format(value: number | null, locale: string): string {
    return value === null ? "—" : new KeyFigureFormatter(locale).format(value, "decimal");
  }
}
