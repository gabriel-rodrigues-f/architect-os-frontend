import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { CapabilityRadar } from "@/components/app/charts";
import {
  Bar,
  GapBadge,
  Initials,
  LevelBadge,
  PageHeader,
  ProfileTabs,
  SectionCard,
  SectionGroup,
  semanticTone,
  StatCard,
} from "@/components/app/ui-bits";
import { useLabels } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { type DevelopmentPlan, type Evidence, type EvidenceType } from "@/lib/domain";
import { useSuccessToast, useToastSubmit } from "@/hooks";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { PersonalDashboardPresenter } from "@/lib/presenters";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useSelectors, useStore, useVocabulary } from "@/lib/store";
import { defaultDateFormatter } from "@/lib/text";
import { ArchitectProfileViewModel, LearningPathsViewModel } from "@/lib/view-models";

function useArchitectProfileViewModel(): ArchitectProfileViewModel {
  const store = useStore();
  return useMemo(() => new ArchitectProfileViewModel(store), [store]);
}

export const Route = createFileRoute("/architects/$architectId/")({
  head: () => ({
    meta: [
      { title: "Architect Profile — Synapse" },
      {
        name: "description",
        content:
          "Perfil completo do arquiteto: competências, gaps, PDI, metas, mentorias e evidências.",
      },
      { property: "og:title", content: "Architect Profile — Synapse" },
      {
        property: "og:description",
        content: "Visão 360 do desenvolvimento técnico individual do Arquiteto de Soluções.",
      },
    ],
  }),
  component: ArchitectProfile,
  notFoundComponent: ArchitectNotFound,
});

function ArchitectNotFound() {
  const { t } = useI18n();
  return <p className="text-sm text-muted-foreground">{t("arch.notFound")}</p>;
}

type NextStep =
  | { kind: "itemsNotStarted"; count: number }
  | { kind: "gapsNotInPlan"; count: number }
  | { kind: "evidencesPending"; count: number }
  | { kind: "assessmentAwaiting" };

export function computeNextSteps(input: {
  canEditOwn: boolean;
  canReviewEvidence: boolean;
  itemsNotStartedCount: number;
  gapsNotInPlanCount: number;
  evidencesPendingCount: number;
  assessmentAwaitingCalibration: boolean;
}): NextStep[] {
  const steps: NextStep[] = [];
  if (input.canEditOwn) {
    if (input.itemsNotStartedCount > 0) {
      steps.push({ kind: "itemsNotStarted", count: input.itemsNotStartedCount });
    }
    if (input.gapsNotInPlanCount > 0) {
      steps.push({ kind: "gapsNotInPlan", count: input.gapsNotInPlanCount });
    }
  }
  if (input.canReviewEvidence) {
    if (input.evidencesPendingCount > 0) {
      steps.push({ kind: "evidencesPending", count: input.evidencesPendingCount });
    }
    if (input.assessmentAwaitingCalibration) {
      steps.push({ kind: "assessmentAwaiting" });
    }
  }
  return steps;
}

function ArchitectProfile() {
  const { architectId } = Route.useParams();
  const store = useStore();
  const sel = useSelectors();

  const learningPathsViewModel = useMemo(() => new LearningPathsViewModel(store), [store]);

  const personal = useMemo(() => new PersonalDashboardPresenter(store, sel), [store, sel]);
  const labels = useLabels();

  const actionTypes = useVocabulary("ACTION_TYPE");
  const evidenceTypes = useVocabulary("EVIDENCE_TYPE");
  const { t, locale } = useI18n();
  const help = usePageHelp("architectProfile");
  const user = useCurrentUser();
  const architect = sel.architectById(architectId);

  const canEditOwn = defaultUiAuthorizationPolicy.canActFor(user, architect);
  const canReviewEvidence = defaultUiAuthorizationPolicy.isLeadOf(user, architect);

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

  const gaps = personal.openGaps(architect.id);
  const capabilityAvgs = sel.capabilityAverages(architect.id);
  const plan = sel.planFor(architect.id);
  const sessions = store.mentoringSessions.filter((m) => m.menteeId === architect.id);
  const evidences = store.evidences.filter((e) => e.architectId === architect.id);
  const assessment = sel.assessmentFor(architect.id);

  const nextSteps = computeNextSteps({
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
        description={`${architect.role} · ${sel.specializationLabel(architect)} · ${architect.yearsAsArchitect} anos como arquiteto`}
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

      <SectionGroup title={t("arch.group.diagnosis")}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SectionCard title={t("arch.radar.title")} description={t("arch.radar.subtitle")}>
            <CapabilityRadar
              data={capabilityAvgs.map((d) => ({
                capability: sel.capabilityShortLabel(d.capability),
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
                      {canEditOwn && !inPlan && (
                        <Link
                          to="/development-plans"
                          search={{ architectId: architect.id }}
                          className="whitespace-nowrap text-xs text-primary hover:underline"
                        >
                          {t("arch.gaps.addToPlan")}
                        </Link>
                      )}
                    </span>
                  </li>
                );
              })}
              {!gaps.length && (
                <p className="text-sm text-muted-foreground">{t("arch.gaps.none")}</p>
              )}
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
                            <EvidenceStatusBadge status={e.status} labels={labels} />
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
                    <EvidenceStatusBadge status={e.status} labels={labels} />
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
                  {canReviewEvidence && <EvidenceReviewDialog evidence={e} />}
                  {canEditOwn && e.status === "Needs Improvement" && (
                    <ResubmitEvidenceDialog evidence={e} />
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

const EVIDENCE_STATUS_TONE: Record<Evidence["status"], string> = {
  Pending: "bg-secondary text-muted-foreground",
  Accepted: semanticTone.success,
  "Needs Improvement": semanticTone.warning,
  Rejected: "bg-destructive/15 text-destructive",
};

function EvidenceStatusBadge({
  status,
  labels,
}: {
  status: Evidence["status"];
  labels: ReturnType<typeof useLabels>;
}) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${EVIDENCE_STATUS_TONE[status]}`}
    >
      {labels.evidenceStatus[status]}
    </span>
  );
}

function EvidenceDialog({
  architectId,
  plan,
}: {
  architectId: string;
  plan: DevelopmentPlan | undefined;
}) {
  const planItems = plan?.items ?? [];
  const { t } = useI18n();
  const labels = useLabels();
  const viewModel = useArchitectProfileViewModel();

  const evidenceTypes = useVocabulary("EVIDENCE_TYPE");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState(() => evidenceTypes.options[0]?.code ?? "");
  const [date, setDate] = useState(defaultDateFormatter.todayIso());
  const [complexity, setComplexity] = useState<"Low" | "Medium" | "High">("Medium");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [url, setUrl] = useState("");
  const [issuer, setIssuer] = useState("");
  const [pdiItemId, setPdiItemId] = useState("");

  const { submitting: saving, run } = useToastSubmit();
  const notifySuccess = useSuccessToast();
  const isCertification = type === "Certification";

  const salvar = async () => {
    const nome = title.trim();
    if (!nome || !type) return;
    const result = await run(() =>
      viewModel.registerEvidence(architectId, {
        title,
        description,
        type: type as EvidenceType,
        date,
        complexity,
        project,
        url,
        issuer,
        pdiItemId,
      }),
    );
    if (!result.ok) return;
    notifySuccess("msg.evidence.create.success", { titulo: nome }, result.value);
    setTitle("");
    setDescription("");
    setProject("");
    setUrl("");
    setIssuer("");
    setPdiItemId("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          {t("arch.register")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ev.dialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="ev-title">{t("ev.field.title")}</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ev-type">{t("ev.field.type")}</Label>
              <select
                id="ev-type"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {evidenceTypes.options.map((option) => (
                  <option key={option.code} value={option.code}>
                    {evidenceTypes.label(option.code)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="ev-date">{t("ev.field.date")}</Label>
              <Input
                id="ev-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvar()}
              />
            </div>
          </div>
          {isCertification && (
            <div>
              <Label htmlFor="ev-issuer">{t("ev.field.issuer")}</Label>
              <Input
                id="ev-issuer"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvar()}
              />
            </div>
          )}
          <div>
            <Label htmlFor="ev-complexity">{t("ev.field.complexity")}</Label>
            <select
              id="ev-complexity"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={complexity}
              onChange={(e) => setComplexity(e.target.value as "Low" | "Medium" | "High")}
            >
              <option value="Low">{labels.complexity.Low}</option>
              <option value="Medium">{labels.complexity.Medium}</option>
              <option value="High">{labels.complexity.High}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="ev-project">{t("ev.field.project")}</Label>
            <Input
              id="ev-project"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
            />
          </div>
          <div>
            <Label htmlFor="ev-url">{t("ev.field.link")}</Label>
            <Input
              id="ev-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
            />
          </div>
          <div>
            <Label htmlFor="ev-description">{t("ev.field.description")}</Label>
            <Textarea
              id="ev-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {planItems.length > 0 && (
            <div>
              <Label htmlFor="ev-pdi">{t("ev.field.pdiLink")}</Label>
              <select
                id="ev-pdi"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={pdiItemId}
                onChange={(e) => setPdiItemId(e.target.value)}
              >
                <option value="">{t("ev.field.pdiLink.none")}</option>
                {planItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.objective || i.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button disabled={!title.trim() || saving} onClick={() => void salvar()}>
            {saving ? t("ev.saving") : t("ev.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResubmitEvidenceDialog({ evidence }: { evidence: Evidence }) {
  const { t } = useI18n();
  const viewModel = useArchitectProfileViewModel();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(evidence.description);
  const [url, setUrl] = useState(evidence.url ?? "");

  const { submitting: saving, run } = useToastSubmit();
  const notifySuccess = useSuccessToast();

  const submit = async () => {
    const result = await run(() => viewModel.resubmit(evidence, { description, url }));
    if (!result.ok) return;
    notifySuccess("msg.evidence.resubmit.success", { titulo: evidence.title }, result.value);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDescription(evidence.description);
          setUrl(evidence.url ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="mt-1 h-auto px-0 text-xs">
          {t("ev.resubmit.action")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ev.resubmit.title")}</DialogTitle>
        </DialogHeader>
        {evidence.leaderComment && (
          <p className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
            "{evidence.leaderComment}"
          </p>
        )}
        <div className="grid gap-3">
          <div>
            <Label htmlFor="ev-resubmit-description">{t("ev.field.description")}</Label>
            <Textarea
              id="ev-resubmit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ev-resubmit-url">{t("ev.field.link")}</Label>
            <Input id="ev-resubmit-url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            {t("ev.resubmit.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? t("ev.resubmit.saving") : t("ev.resubmit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvidenceReviewDialog({ evidence }: { evidence: Evidence }) {
  const { t } = useI18n();
  const labels = useLabels();
  const viewModel = useArchitectProfileViewModel();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Exclude<Evidence["status"], "Pending">>(
    evidence.status === "Pending" ? "Accepted" : evidence.status,
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
          setStatus(evidence.status === "Pending" ? "Accepted" : evidence.status);
          setComment(evidence.leaderComment ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="mt-1 h-auto px-0 text-xs">
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
