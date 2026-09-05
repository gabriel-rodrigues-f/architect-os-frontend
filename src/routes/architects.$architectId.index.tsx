import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  AiGenerateButton,
  AiRunResult,
  Bar,
  CapabilityRadar,
  DeactivatedPersonNotice,
  EvidenceDialog,
  EvidenceStatusBadge,
  GapBadge,
  GenerationProfileField,
  Initials,
  LevelBadge,
  OutOfReachScreen,
  PageHeader,
  PersonAdviceBody,
  ProfileTabs,
  ResubmitEvidenceDialog,
  SectionCard,
  SectionGroup,
  StagnationAlertSection,
  StatCard,
  TreatGapInPlanAction,
  WorkAssistanceRun,
} from "@/components/app";
import { useLabels } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { type Evidence } from "@/lib/domain";
import {
  useArchitectProfileViewModel,
  useAssistantRun,
  useSuccessToast,
  useToastSubmit,
} from "@/hooks";
import { personAssistantsApi, workAssistantsApi } from "@/lib/api";
import { GenerationProfileChoice, type GenerationProfileName } from "@/lib/assistants";
import type {
  DevelopmentPlanAdvice,
  DevelopmentPlanRecommendationRequest,
  SessionScriptAdvice,
  SessionScriptRequest,
} from "@/lib/gateways/person-assistants.gateway";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, ContextScopes } from "@/lib/context-scope";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { PersonalDashboardPresenter } from "@/lib/presenters";
import { requireCareerFileReach } from "@/lib/route-guards";
import { useSeniorityReading } from "@/lib/seniority";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useSelectors, useStore, useVocabulary } from "@/lib/store";
import { defaultDateFormatter } from "@/lib/text";
import { LearningPathsViewModel } from "@/lib/view-models";

export const Route = createFileRoute("/architects/$architectId/")({
  head: () => ({
    meta: [
      { title: "Architect Profile — Synapse" },
      {
        name: "description",
        content:
          "Perfil completo do profissional: competências, gaps, PDI, metas, mentorias e evidências.",
      },
      { property: "og:title", content: "Architect Profile — Synapse" },
      {
        property: "og:description",
        content: "Visão 360 do desenvolvimento técnico individual do profissional.",
      },
    ],
  }),
  beforeLoad: requireCareerFileReach,
  component: ArchitectProfile,
  notFoundComponent: ArchitectNotFound,
});

function ArchitectNotFound() {
  const { t } = useI18n();
  return <p className="text-sm text-muted-foreground">{t("arch.notFound")}</p>;
}

function ArchitectProfile() {
  const { architectId } = Route.useParams();
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp("architectProfile");
  const canOpenCareerFile = defaultUiAuthorizationPolicy.canOpenCareerFileOf(user, architectId);

  if (!canOpenCareerFile) {
    return (
      <OutOfReachScreen
        title={t("arch.careerFile.title")}
        help={help}
        reason={t("arch.careerFile.ownOutOfReach")}
        hint={t("arch.careerFile.ownOutOfReachHint")}
      />
    );
  }

  return (
    <ContextScope contexts={ContextScopes.careerFileOf(architectId)}>
      <ArchitectWorkspace />
    </ContextScope>
  );
}

function ArchitectWorkspace() {
  const { architectId } = Route.useParams();
  const store = useStore();
  const sel = useSelectors();

  const viewModel = useArchitectProfileViewModel();
  const learningPathsViewModel = useMemo(() => new LearningPathsViewModel(store), [store]);

  const personal = useMemo(() => new PersonalDashboardPresenter(store, sel), [store, sel]);
  const labels = useLabels();
  const seniority = useSeniorityReading();

  const actionTypes = useVocabulary("ACTION_TYPE");
  const evidenceTypes = useVocabulary("EVIDENCE_TYPE");
  const { t, locale } = useI18n();
  const help = usePageHelp("architectProfile");
  const user = useCurrentUser();
  const architect = sel.architectById(architectId);

  const canEditOwn = defaultUiAuthorizationPolicy.canActOnCareerFileOf(user, architect);
  const canReviewEvidence = defaultUiAuthorizationPolicy.isLeadOf(user, architect);

  /**
   * A recomendação de PDI é a única das oito que precisa de um SEGUNDO
   * argumento — a competência —, e a única cujo alcance no servidor inclui a
   * própria pessoa. Um `AssistantRunState` por tela e não por linha: a
   * sugestão aparece uma de cada vez, abaixo da lista, e o pedido em voo diz
   * qual competência é. N estados por linha custariam N consultas vivas para
   * mostrar uma.
   */
  const planAdvice = useAssistantRun<DevelopmentPlanRecommendationRequest, DevelopmentPlanAdvice>(
    ["assistants", "development-plan-recommendation", architectId],
    (request) => personAssistantsApi.recommendDevelopmentPlanItem(request),
  );

  if (!architect) {
    return (
      <div className="surface-card p-6 text-sm">
        {t("arch.notFound")}{" "}
        <Link to="/team" className="text-primary underline">
          {t("arch.back")}
        </Link>
      </div>
    );
  }

  const gaps = personal.openGaps(architect.id);
  const capabilityAvgs = sel.capabilityAverages(architect.id);
  const plan = sel.planFor(architect.id);
  const sessions = store.mentoringSessions.filter((m) => m.menteeId === architect.id);
  const evidences = store.evidences.filter((e) => e.architectId === architect.id);
  const assessment = sel.assessmentFor(architect.id);

  const nextSteps = viewModel.nextSteps({
    canEditOwn,
    canReviewEvidence,
    itemsNotStartedCount: personal.planItemCounts(architect.id).notStarted,
    gapsNotInPlanCount: gaps.filter(
      (g) => !plan?.items.some((i) => i.competencyId === g.item.competencyId),
    ).length,
    evidencesPendingCount: personal.pendingEvidenceCount(architect.id),
    assessmentAwaitingCalibration: assessment?.status === "In Review",
  });

  const assessmentHistory = store.assessments
    .filter((a) => a.architectId === architect.id)
    .map((a) => ({ assessment: a, cycle: store.cycles.find((c) => c.id === a.cycleId) }))
    .sort((x, y) => (y.cycle?.start ?? "").localeCompare(x.cycle?.start ?? ""));
  const paths = personal.assignedPaths(architect.id);
  const {
    avg,
    covered: coveredCapabilities,
    total: totalCapabilities,
  } = sel.coverageFor(architect.id);

  return (
    <>
      <PageHeader
        title={architect.name}
        description={`${seniority.labelOf(architect.role)} · ${t("arch.yearsOfExperience", { n: architect.yearsAsArchitect })}`}
        help={help}
        actions={
          <Link
            to="/team"
            className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
          >
            {t("arch.back")}
          </Link>
        }
      />

      <DeactivatedPersonNotice active={architect.active} />

      <ProfileTabs architectId={architect.id} active="overview" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label={t("arch.stat.avgLevel")}
          value={avg === undefined ? "—" : avg.toFixed(2)}
          hint={
            coveredCapabilities < totalCapabilities
              ? t("arch.stat.avgLevelHintPartial", {
                  covered: coveredCapabilities,
                  total: totalCapabilities,
                })
              : t("arch.stat.avgLevelHint")
          }
        />
        <StatCard
          label={t("arch.stat.openGaps")}
          value={`${gaps.length}`}
          hint={t("arch.stat.openGapsHint")}
        />
      </div>

      {(canEditOwn || canReviewEvidence) && (
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
                    {step.kind === "evidencesPending" &&
                      t("arch.nextSteps.evidencesPending", { n: step.count })}
                    {step.kind === "assessmentAwaiting" && t("arch.nextSteps.assessmentAwaiting")}
                  </span>
                  {step.kind === "evidencesPending" ? (
                    <a
                      href="#arch-evidence"
                      className="whitespace-nowrap text-xs text-primary hover:underline"
                    >
                      {t("arch.nextSteps.cta")}
                    </a>
                  ) : (
                    <Link
                      to={
                        step.kind === "assessmentAwaiting" ? "/assessments" : "/development-plans"
                      }
                      search={{ architectId: architect.id }}
                      className="whitespace-nowrap text-xs text-primary hover:underline"
                    >
                      {t("arch.nextSteps.cta")}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {canReviewEvidence && <SessionScriptAssistant architectId={architect.id} />}

      {canReviewEvidence && (
        <StagnationAlertSection
          className="mb-6"
          title={t("ai.stagnation.title")}
          description={t("ai.stagnation.subtitle")}
          actionLabel={t("ai.stagnation.action")}
          queryKey={["assistants", "stagnation-alert", architect.id]}
          ask={() => workAssistantsApi.alertAboutStagnation(architect.id)}
        />
      )}

      <SectionGroup title={t("arch.group.diagnosis")}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SectionCard title={t("arch.radar.title")} description={t("arch.radar.subtitle")}>
            <CapabilityRadar
              data={capabilityAvgs.map((d) => ({
                capability: d.capability.name,
                atual: d.avg ?? 0,
                alvo: d.target ?? 0,
              }))}
            />
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
                      {canEditOwn && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-auto px-0 text-xs"
                          aria-label={t("ai.plan.actionFor", { nome: g.competency?.name ?? "" })}
                          disabled={planAdvice.running}
                          onClick={() => {
                            planAdvice.generate({
                              architectId: architect.id,
                              competencyId: g.item.competencyId,
                            });
                          }}
                        >
                          {t("ai.plan.action")}
                        </Button>
                      )}
                      {canEditOwn && !inPlan && (
                        <TreatGapInPlanAction
                          architectId={architect.id}
                          competencyId={g.item.competencyId}
                          label={t("arch.gaps.addToPlan")}
                        />
                      )}
                    </span>
                  </li>
                );
              })}
              {!gaps.length && (
                <p className="text-sm text-muted-foreground">{t("arch.gaps.none")}</p>
              )}
            </ul>
            <AiRunResult run={planAdvice}>
              {(advice) => (
                <PersonAdviceBody
                  advice={advice}
                  transcriptHeadline={`${t("ai.plan.title")} — ${advice.distance.competencyName}`}
                  header={
                    <p className="mt-2 text-sm font-medium">{advice.distance.competencyName}</p>
                  }
                  nextStep={
                    <Link
                      to="/development-plans"
                      search={{ architectId: architect.id }}
                      className="text-xs text-primary hover:underline"
                    >
                      {t("ai.plan.next")}
                    </Link>
                  }
                />
              )}
            </AiRunResult>
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
                      search={{ architectId: architect.id, cycleId: assessment.cycleId }}
                      className="whitespace-nowrap text-xs text-primary hover:underline"
                    >
                      {t("arch.history.view")}
                    </Link>
                  </span>
                </li>
              ))}
              {!assessmentHistory.length && (
                <p className="text-sm text-muted-foreground">{t("arch.history.none")}</p>
              )}
            </ul>
          </SectionCard>
        </div>
      </SectionGroup>

      <SectionGroup className="mt-8" title={t("arch.group.development")}>
        <div>
          <SectionCard title="PDI" description={t("arch.plan.subtitle")}>
            <ul className="space-y-3">
              {(plan?.items ?? []).map((i) => {
                const itemEvidences = sel.evidencesForPlanItem(evidences, i.id);
                return (
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
                    {itemEvidences.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {itemEvidences.map((e) => (
                          <li key={e.id} className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">{e.title}</span>
                            <EvidenceStatusBadge status={e.status} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
              {!plan?.items.length && (
                <p className="text-sm text-muted-foreground">{t("arch.plan.none")}</p>
              )}
            </ul>
          </SectionCard>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <SectionCard title={t("arch.paths.title")} description={t("arch.paths.subtitle")}>
            <ul className="space-y-2">
              {paths.map((p) => {
                const value = learningPathsViewModel.progressPercentFor(p, architect.id);
                return (
                  <li key={p.id} className="surface-inset p-2.5">
                    <p className="text-sm font-medium">{p.name}</p>
                    <Bar className="mt-1.5" value={value} />
                  </li>
                );
              })}
              {!paths.length && (
                <p className="text-sm text-muted-foreground">{t("arch.paths.none")}</p>
              )}
            </ul>
          </SectionCard>

          <SectionCard
            id="arch-evidence"
            title={t("arch.evidence.title")}
            description={t("arch.evidence.subtitle")}
            actions={
              canEditOwn ? <EvidenceDialog architectId={architect.id} plan={plan} /> : undefined
            }
          >
            <ul className="space-y-2">
              {evidences.map((e) => (
                <li key={e.id} className="surface-inset p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{e.title}</p>
                    <EvidenceStatusBadge status={e.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {evidenceTypes.label(e.type)}
                    {e.issuer ? ` · ${e.issuer}` : ""} ·{" "}
                    {defaultDateFormatter.formatDate(e.date, locale)} · complexidade{" "}
                    {labels.complexity[e.complexity]}
                  </p>
                  {e.leaderComment && (
                    <p className="mt-1 text-xs text-muted-foreground">"{e.leaderComment}"</p>
                  )}
                  {(canReviewEvidence || (canEditOwn && e.status === "Needs Improvement")) && (
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      {canReviewEvidence && <EvidenceReviewDialog evidence={e} />}
                      {canEditOwn && e.status === "Needs Improvement" && (
                        <ResubmitEvidenceDialog evidence={e} />
                      )}
                    </div>
                  )}
                </li>
              ))}
              {!evidences.length && (
                <p className="text-sm text-muted-foreground">{t("arch.evidence.none")}</p>
              )}
            </ul>
          </SectionCard>
        </div>

        <SectionCard
          className="mt-6"
          title={t("arch.mentoring.title")}
          description={t("arch.mentoring.count", { n: sessions.length })}
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
                  <p className="mt-1 text-sm">{s.actions}</p>
                </div>
              </li>
            ))}
            {!sessions.length && (
              <p className="text-sm text-muted-foreground">{t("arch.mentoring.none")}</p>
            )}
          </ol>
        </SectionCard>
      </SectionGroup>
    </>
  );
}

/**
 * Item 1 do pedido do dono, LITERAL: *"No perfil do profissional: ações
 * 'Gerar roteiro de 1:1' e 'Gerar roteiro de PDI', com o seletor de perfil de
 * geração (Empírico | Moderado | Metodológico, Moderado por padrão) ANTES de
 * gerar. O resultado é SUGESTÃO, com o próximo passo claro (copiar, editar,
 * ou abrir a operação que grava)."*
 *
 * Duas pautas, dois botões, e nunca um botão com um `<select>` de "tipo": no
 * backend são duas operações de negócio com roteiros de forma diferente
 * (ADR-0087), e colapsá-las aqui esconderia isso de quem usa.
 *
 * Quem alcança é a LIDERANÇA — a mesma régua do servidor, que responde 403 a
 * qualquer outro. Esconder não protege nada (a autoridade é o backend); o que
 * ele evita é a pessoa clicar num botão que só sabe recusar.
 */
function SessionScriptAssistant({ architectId }: { architectId: string }) {
  const { t } = useI18n();
  const [profile, setProfile] = useState<GenerationProfileName>(GenerationProfileChoice.DEFAULT);
  const run = useAssistantRun<SessionScriptRequest, SessionScriptAdvice>(
    ["assistants", "session-script", architectId],
    (request) => personAssistantsApi.writeSessionScript(request),
  );
  const generating = run.running ? run.request?.agenda : undefined;

  return (
    <SectionCard
      className="mb-6"
      title={t("ai.scripts.title")}
      description={t("ai.scripts.subtitle")}
    >
      <GenerationProfileField value={profile} onChange={setProfile} disabled={run.running} />
      <div className="mt-3 flex flex-wrap gap-2">
        <AiGenerateButton
          label={t("ai.scripts.oneOnOne")}
          running={generating === "one-on-one"}
          disabled={run.running}
          onGenerate={() => {
            run.generate({ architectId, agenda: "one-on-one", profile });
          }}
        />
        <AiGenerateButton
          label={t("ai.scripts.developmentPlan")}
          running={generating === "development-plan"}
          disabled={run.running}
          onGenerate={() => {
            run.generate({ architectId, agenda: "development-plan", profile });
          }}
        />
      </div>
      <AiRunResult run={run}>
        {(advice) => (
          <PersonAdviceBody
            advice={advice}
            transcriptHeadline={t(
              advice.agenda === "one-on-one" ? "ai.scripts.oneOnOne" : "ai.scripts.developmentPlan",
            )}
            nextStep={
              advice.agenda === "one-on-one" ? (
                <Link to="/mentoring" className="text-xs text-primary hover:underline">
                  {t("ai.scripts.next.mentoring")}
                </Link>
              ) : (
                <Link
                  to="/development-plans"
                  search={{ architectId }}
                  className="text-xs text-primary hover:underline"
                >
                  {t("ai.scripts.next.plan")}
                </Link>
              )
            }
          />
        )}
      </AiRunResult>
    </SectionCard>
  );
}

function EvidenceReviewDialog({ evidence }: { evidence: Evidence }) {
  const { t } = useI18n();
  const labels = useLabels();
  const viewModel = useArchitectProfileViewModel();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Exclude<Evidence["status"], "Pending">>(
    viewModel.preselectedReviewDecisionFor(evidence),
  );
  const [comment, setComment] = useState(evidence.leaderComment ?? "");

  const { submitting: saving, run } = useToastSubmit();
  const notifySuccess = useSuccessToast();

  const salvar = async () => {
    const result = await run(() => viewModel.review(evidence.id, status, comment));
    if (!result.ok) return;
    notifySuccess(
      "msg.evidence.review.success",
      { titulo: evidence.title, status: labels.evidenceStatus[status] },
      result.value,
    );
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setStatus(viewModel.preselectedReviewDecisionFor(evidence));
          setComment(evidence.leaderComment ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-auto px-0 text-xs">
          {t("ev.review.action")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ev.review.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="ev-review-status">{t("ev.review.status")}</Label>
            <select
              id="ev-review-status"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as Exclude<Evidence["status"], "Pending">)}
            >
              <option value="Accepted">{labels.evidenceStatus.Accepted}</option>
              <option value="Needs Improvement">
                {labels.evidenceStatus["Needs Improvement"]}
              </option>
              <option value="Rejected">{labels.evidenceStatus.Rejected}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="ev-review-comment">{t("ev.review.comment")}</Label>
            <Textarea
              id="ev-review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs text-muted-foreground">{t("ai.review.subtitle")}</p>
            <WorkAssistanceRun
              actionLabel={t("ai.review.action")}
              queryKey={["assistants", "review-assistance", evidence.id]}
              ask={() => workAssistantsApi.assistEvidenceReview(evidence.id)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={saving}>
            {saving ? t("ev.review.saving") : t("ev.review.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
