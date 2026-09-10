import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";

import {
  Bar,
  CapabilityRadar,
  GapBadge,
  Initials,
  LevelBadge,
  OutOfReachNote,
  ProfileBackLink,
  ProfileHeading,
  SectionCard,
  SectionGroup,
  StatCard,
  TreatGapInPlanAction,
} from "@/components/app";
import { AssessmentProgress } from "@/lib/domain";
import { useLabels } from "@/lib/labels";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { defaultCareerFileReach } from "@/lib/person-listing";
import { PersonalDashboardPresenter } from "@/lib/presenters";
import { useSeniorityReading } from "@/lib/seniority";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useSelectors, useStore, useVocabulary } from "@/lib/store";
import { defaultDateFormatter } from "@/lib/text";
import { LearningPathsViewModel, professionalProfileViewModel, RadarRows } from "@/lib/view-models";

export const Route = createFileRoute("/professionals/$professionalId/")({
  head: () => ({
    meta: [
      { title: "Professional Profile — Synapse" },
      {
        name: "description",
        content: "Perfil completo do profissional: competências, gaps, PDI, metas e mentorias.",
      },
      { property: "og:title", content: "Professional Profile — Synapse" },
      {
        property: "og:description",
        content: "Visão 360 do desenvolvimento técnico individual do profissional.",
      },
    ],
  }),
  component: ProfessionalWorkspace,
  notFoundComponent: ProfessionalNotFound,
});

function ProfessionalNotFound() {
  const { t } = useI18n();
  return <p className="text-sm text-muted-foreground">{t("arch.notFound")}</p>;
}

function ProfessionalWorkspace() {
  const { professionalId } = Route.useParams();
  const store = useStore();
  const sel = useSelectors();

  const learningPathsViewModel = useMemo(() => new LearningPathsViewModel(store), [store]);

  const personal = useMemo(() => new PersonalDashboardPresenter(store, sel), [store, sel]);
  const labels = useLabels();
  const seniority = useSeniorityReading();

  const actionTypes = useVocabulary("ACTION_TYPE");
  const { t, locale } = useI18n();
  const help = usePageHelp("professionalProfile");
  const user = useCurrentUser();
  const professional = sel.professionalById(professionalId);

  const canEditOwn = defaultUiAuthorizationPolicy.canActOnCareerFileOf(user, professional);
  const leadsProfessional = defaultUiAuthorizationPolicy.isLeadOf(user, professional);

  if (!professional) {
    return (
      <div className="surface-card p-6 text-sm">
        {t("arch.notFound")}{" "}
        <Link to="/team" className="text-primary underline">
          {t("arch.back")}
        </Link>
      </div>
    );
  }

  const gaps = personal.openGaps(professional.id);
  const capabilityAvgs = sel.capabilityAverages(professional.id);
  const plan = sel.planFor(professional.id);
  const sessions = store.mentoringSessions.filter((m) => m.menteeId === professional.id);
  const assessment = sel.assessmentFor(professional.id);

  /*
   * AS LISTAGENS POR PESSOA, COM O ALCANCE AO LADO. Elas passaram a responder
   * `200 []` (em vez de `403`) a quem não alcança a pessoa — fechando o
   * oráculo que dizia quem existe. O preço é que a lista vazia deixou de ser
   * prova: onde a tela não distingue "não tem" de "não posso ver", ela não
   * afirma nenhum dos dois.
   */
  const openGaps = defaultCareerFileReach.listingOf(user, professional, gaps);
  const mentoring = defaultCareerFileReach.listingOf(user, professional, sessions);
  const planItems = defaultCareerFileReach.listingOf(user, professional, plan?.items ?? []);

  const nextSteps = professionalProfileViewModel.nextSteps({
    canEditOwn,
    leadsProfessional,
    itemsNotStartedCount: personal.planItemCounts(professional.id).notStarted,
    gapsNotInPlanCount: gaps.filter(
      (g) => !plan?.items.some((i) => i.competencyId === g.item.competencyId),
    ).length,
    assessmentAwaitingCalibration: AssessmentProgress.of(assessment).awaitsConclusion,
  });

  const assessmentHistory = store.assessments
    .filter((a) => a.professionalId === professional.id)
    .map((a) => ({ assessment: a, cycle: store.cycles.find((c) => c.id === a.cycleId) }))
    .sort((x, y) => (y.cycle?.start ?? "").localeCompare(x.cycle?.start ?? ""));
  const paths = personal.assignedPaths(professional.id);
  const learningPaths = defaultCareerFileReach.listingOf(user, professional, paths);
  const history = defaultCareerFileReach.listingOf(user, professional, assessmentHistory);
  const {
    avg,
    covered: coveredCapabilities,
    total: totalCapabilities,
  } = sel.coverageFor(professional.id);

  return (
    <>
      <ProfileHeading
        title={professional.name}
        description={`${seniority.labelOf(professional.role)} · ${t("arch.yearsOfExperience", { n: professional.yearsAsProfessional })}`}
        help={help}
        actions={<ProfileBackLink professionalId={professional.id} to="team" />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label={t("arch.stat.avgLevel")}
          value={avg === undefined ? "—" : avg.toFixed(2)}
          hint={
            !history.isKnown
              ? t("arch.stat.avgLevelOutOfReachHint")
              : coveredCapabilities < totalCapabilities
                ? t("arch.stat.avgLevelHintPartial", {
                    covered: coveredCapabilities,
                    total: totalCapabilities,
                  })
                : t("arch.stat.avgLevelHint")
          }
        />
        <StatCard
          label={t("arch.stat.openGaps")}
          value={openGaps.count === undefined ? "—" : `${openGaps.count}`}
          hint={t(
            openGaps.count === undefined
              ? "arch.stat.openGapsOutOfReachHint"
              : "arch.stat.openGapsHint",
          )}
        />
      </div>

      {(canEditOwn || leadsProfessional) && (
        <SectionCard
          className="mb-6"
          title={t("arch.nextSteps.title")}
          description={t("arch.nextSteps.subtitle")}
        >
          {nextSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("arch.nextSteps.none")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {nextSteps.map((step) => (
                <li
                  key={step.kind}
                  className="flex items-center justify-between gap-3 surface-inset p-2.5"
                >
                  <span>
                    {step.kind === "itemsNotStarted" &&
                      t("arch.nextSteps.itemsNotStarted", { n: step.count })}
                    {step.kind === "gapsNotInPlan" &&
                      t("arch.nextSteps.gapsNotInPlan", { n: step.count })}
                    {step.kind === "assessmentAwaiting" && t("arch.nextSteps.assessmentAwaiting")}
                  </span>
                  <Link
                    to={step.kind === "assessmentAwaiting" ? "/assessments" : "/development-plans"}
                    search={{ professionalId: professional.id }}
                    className="whitespace-nowrap text-xs text-primary hover:underline"
                  >
                    {t("arch.nextSteps.cta")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      <SectionGroup title={t("arch.group.diagnosis")}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SectionCard title={t("arch.radar.title")} description={t("arch.radar.subtitle")}>
            {/*
             * A MESMA RÉGUA DO RADAR COMPARATIVO (`RadarRows`): sem medida é
             * ausência, nunca zero. Zero é o CENTRO do radar — com `?? 0` a
             * ficha desenhava o polígono colapsado no meio e afirmava "esta
             * pessoa tem zero aqui" onde o certo é "não há medida".
             */}
            <CapabilityRadar data={RadarRows.currentAgainstTarget(capabilityAvgs)} />
          </SectionCard>

          <SectionCard title={t("arch.gaps.title")} description={t("arch.gaps.subtitle")}>
            <ul className="space-y-2">
              {gaps.slice(0, 8).map((g) => {
                const inPlan = plan?.items.some((i) => i.competencyId === g.item.competencyId);
                return (
                  <li
                    key={g.item.competencyId}
                    className="flex items-center justify-between gap-3 surface-inset p-2.5"
                  >
                    <span className="truncate text-sm">{g.competency?.name}</span>
                    <span className="flex items-center gap-2">
                      <LevelBadge level={g.item.final} />
                      <span className="text-xs text-muted-foreground">→ {g.item.target}</span>
                      <GapBadge gap={g.gap} />
                      {canEditOwn && !inPlan && (
                        <TreatGapInPlanAction
                          professionalId={professional.id}
                          competencyId={g.item.competencyId}
                          label={t("arch.gaps.addToPlan")}
                        />
                      )}
                    </span>
                  </li>
                );
              })}
              {openGaps.isEmptyForSure && (
                <p className="text-sm text-muted-foreground">{t("arch.gaps.none")}</p>
              )}
              {!openGaps.isKnown && <OutOfReachNote subject="arch.outOfReach.subject.gaps" />}
            </ul>
          </SectionCard>
        </div>

        <div className="mt-6">
          <SectionCard title={t("arch.history.title")} description={t("arch.history.subtitle")}>
            <ul className="space-y-2">
              {assessmentHistory.map(({ assessment, cycle }) => (
                <li
                  key={assessment.id}
                  className="flex items-center justify-between gap-3 surface-inset p-2.5"
                >
                  <span className="text-sm font-medium">{cycle?.name ?? assessment.cycleId}</span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                      {labels.assessmentStatus[assessment.status]}
                    </span>
                    <Link
                      to="/assessments"
                      search={{ professionalId: professional.id, cycleId: assessment.cycleId }}
                      className="whitespace-nowrap text-xs text-primary hover:underline"
                    >
                      {t("arch.history.view")}
                    </Link>
                  </span>
                </li>
              ))}
              {history.isEmptyForSure && (
                <p className="text-sm text-muted-foreground">{t("arch.history.none")}</p>
              )}
              {!history.isKnown && <OutOfReachNote subject="arch.outOfReach.subject.assessments" />}
            </ul>
          </SectionCard>
        </div>
      </SectionGroup>

      <SectionGroup className="mt-8" title={t("arch.group.development")}>
        <div>
          <SectionCard title="PDI" description={t("arch.plan.subtitle")}>
            <ul className="space-y-3">
              {planItems.items.map((i) => (
                <li key={i.id} className="surface-inset p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {sel.competencyById(i.competencyId)?.name ?? t("pdi.unknownCompetency")}
                    </p>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                      {labels.planItemStatus[i.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {actionTypes.label(i.actionType)} · {i.actionPlan} · prazo{" "}
                    {defaultDateFormatter.formatDate(i.targetDate, locale)}
                  </p>
                </li>
              ))}
              {planItems.isEmptyForSure && (
                <p className="text-sm text-muted-foreground">{t("arch.plan.none")}</p>
              )}
              {!planItems.isKnown && <OutOfReachNote subject="arch.outOfReach.subject.planItems" />}
            </ul>
          </SectionCard>
        </div>

        {/*
         * As Trilhas dividiam esta faixa com o cartão de Evidências, que saiu
         * do produto (dono, 2026-09-08, regra 17). Sozinho num `xl:grid-cols-2`
         * o cartão ficaria com metade da largura e um vão à direita, então a
         * faixa volta a ser de uma coluna só, como o PDI logo acima.
         */}
        <div className="mt-6">
          <SectionCard title={t("arch.paths.title")} description={t("arch.paths.subtitle")}>
            <ul className="space-y-2">
              {paths.map((p) => {
                const value = learningPathsViewModel.progressPercentFor(p, professional.id);
                return (
                  <li key={p.id} className="surface-inset p-2.5">
                    <p className="text-sm font-medium">{p.name}</p>
                    <Bar className="mt-1.5" value={value} />
                  </li>
                );
              })}
              {learningPaths.isEmptyForSure && (
                <p className="text-sm text-muted-foreground">{t("arch.paths.none")}</p>
              )}
              {!learningPaths.isKnown && (
                <OutOfReachNote subject="arch.outOfReach.subject.learningPaths" />
              )}
            </ul>
          </SectionCard>
        </div>

        <SectionCard
          className="mt-6"
          title={t("arch.mentoring.title")}
          description={
            mentoring.count === undefined
              ? t("arch.mentoring.countOutOfReach")
              : t("arch.mentoring.count", { n: mentoring.count })
          }
        >
          <ol className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-start gap-3 surface-inset p-3">
                <Initials name={s.mentor} />
                <div>
                  <p className="text-sm font-medium">{s.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    {defaultDateFormatter.formatDate(s.date, locale)} · {s.durationMin} min · mentor{" "}
                    {s.mentor}
                  </p>
                  {/*
                   * A linha de conteúdo do cartão era `{s.actions}`, e ela saiu
                   * com o campo (dono, 2026-09-09). Sem substituição o cartão
                   * ficaria só com tema e carimbo de data — o que a 1:1 GUARDA
                   * não apareceria aqui. `notes` toma o lugar porque é o bloco
                   * único que o dono definiu para a 1:1, na mesma forma visual
                   * da linha que saiu.
                   */}
                  <p className="mt-1 text-sm">{s.notes}</p>
                </div>
              </li>
            ))}
            {mentoring.isEmptyForSure && (
              <p className="text-sm text-muted-foreground">{t("arch.mentoring.none")}</p>
            )}
            {!mentoring.isKnown && <OutOfReachNote subject="arch.outOfReach.subject.mentoring" />}
          </ol>
        </SectionCard>
      </SectionGroup>
    </>
  );
}
