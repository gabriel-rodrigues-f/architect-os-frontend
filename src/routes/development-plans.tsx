import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { ArchitectSelectCombobox } from "@/components/app/ArchitectSelectCombobox";
import { CommandWithReasonDialog } from "@/components/app/CommandWithReasonDialog";
import { QuerySection } from "@/components/app/QuerySection";
import { GapBadge, LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type ActionType,
  type DevelopmentPlan,
  type DevelopmentPlanItem,
  type DevelopmentPlanItemEvent,
  type PdiStatus,
  type SmartGoal,
} from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
import { useLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import type { Gap } from "@/lib/selectors";
import { useObjectiveFromGap, useSelectors, useStore, useVocabulary } from "@/lib/store";
import { defaultDateFormatter } from "@/lib/text";
import { useAsyncSubmit, useSearchParamString, useServerDraft, useSuccessToast } from "@/hooks";
import { DevelopmentPlansViewModel } from "@/lib/view-models";

function useDevelopmentPlansViewModel() {
  const store = useStore();
  const objectiveFromGap = useObjectiveFromGap();
  return useMemo(
    () => new DevelopmentPlansViewModel(store, objectiveFromGap),
    [store, objectiveFromGap],
  );
}

const developmentPlansSearchSchema = z.object({
  architectId: z.string().optional(),
});

export const Route = createFileRoute("/development-plans")({
  validateSearch: developmentPlansSearchSchema,
  head: () => ({
    meta: [
      { title: "Planos de Desenvolvimento — Synapse" },
      {
        name: "description",
        content:
          "Plano de desenvolvimento individual: maiores gaps como ponto de partida, SMART goal e plano de ação escritos pela pessoa e pelo Tech Lead.",
      },
      { property: "og:title", content: "Planos de Desenvolvimento — Synapse" },
      {
        property: "og:description",
        content:
          "Planos de desenvolvimento individual com ações Learn, Practice, Apply, Teach, Mentor e Lead.",
      },
    ],
  }),
  component: PlansPage,
});

const STATUSES: PdiStatus[] = ["Not Started", "In Progress", "Blocked", "Completed"];

function statusOfPlanOrEmptyDraft(plan: DevelopmentPlan | undefined): DevelopmentPlan["status"] {
  return plan?.status ?? "Draft";
}

function PlansPage() {
  const sel = useSelectors();

  const actionTypes = useVocabulary("ACTION_TYPE");
  const viewModel = useDevelopmentPlansViewModel();
  const [architectId, setArchitectId] = useSearchParamString(
    "architectId",
    () => sel.activeArchitects[0]?.id ?? "",
  );

  const [smartEditingId, setSmartEditingId] = useState<string | null>(null);

  const [creatingForCompetencyId, setCreatingForCompetencyId] = useState<string | null>(null);
  const { t } = useI18n();

  const creating = useAsyncSubmit(t("pdi.newItem.error"));
  const help = usePageHelp("developmentPlans");
  const user = useCurrentUser();
  const architect = sel.architectById(architectId);

  const actsForArchitect = defaultUiAuthorizationPolicy.canActFor(user, architect);
  const plan = sel.planFor(architectId);

  const gaps = sel.progressionGapsFor(architectId).filter((g) => g.gap > 0);

  const isLeadOfArchitect = defaultUiAuthorizationPolicy.isLeadOf(user, architect);
  const isAssignedTechLead = defaultUiAuthorizationPolicy.isAssignedTechLeadOf(user, architect);
  const planStatus = statusOfPlanOrEmptyDraft(plan);

  const canEditDiagnostic = actsForArchitect && planStatus === "Draft";
  const canEditExecution = actsForArchitect && planStatus !== "Completed";

  const suggestions = viewModel.suggestions(gaps, plan);

  const creatingForGap = creatingForCompetencyId
    ? gaps.find((g) => g.item.competencyId === creatingForCompetencyId)
    : undefined;

  return (
    <>
      <PageHeader
        title={t("pdi.title")}
        description={t("pdi.subtitle")}
        help={help}
        actions={
          <ArchitectSelectCombobox
            architects={sel.activeArchitects}
            selectedId={architectId}
            onChange={setArchitectId}
            label={t("pdi.architect")}
            className="w-48"
          />
        }
      />

      {plan && (
        <PlanStatusBar
          plan={plan}
          actsForArchitect={actsForArchitect}
          isLeadOfArchitect={isLeadOfArchitect}
          isAssignedTechLead={isAssignedTechLead}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {plan?.items.map((item) => (
            <PlanItemCard
              key={item.id}
              planId={plan.id}
              item={item}
              canEditDiagnostic={canEditDiagnostic}
              canEditExecution={canEditExecution}
              canReschedule={canEditExecution && planStatus === "Approved"}
              smartEditing={smartEditingId === item.id}
              onSmartEditingChange={(open) => setSmartEditingId(open ? item.id : null)}
            />
          ))}
          {!plan?.items.length && (
            <SectionCard title={t("pdi.empty.title")} description={t("pdi.empty.subtitle")}>
              <p className="text-sm text-muted-foreground">O plano deste ciclo ainda está vazio.</p>
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard
            title={t("pdi.suggestions.title")}
            description={t("pdi.suggestions.subtitle")}
          >
            <ul className="space-y-2">
              {suggestions.map((g) => (
                <li key={g.item.competencyId} className="surface-inset p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{g.competency?.name}</p>
                    <GapBadge gap={g.gap} />
                  </div>
                  {canEditDiagnostic && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 px-0"
                      onClick={() => setCreatingForCompetencyId(g.item.competencyId)}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {t("pdi.suggestions.add")}
                    </Button>
                  )}
                </li>
              ))}
              {!suggestions.length && (
                <p className="text-sm text-muted-foreground">{t("pdi.suggestions.none")}</p>
              )}
            </ul>
          </SectionCard>

          <SectionCard
            title={t("pdi.actionModel.title")}
            description={t("pdi.actionModel.subtitle")}
          >
            <div className="flex flex-wrap gap-1.5">
              {actionTypes.options.map((option, i) => (
                <span
                  key={option.code}
                  className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium"
                >
                  {i + 1}. {option.code}
                </span>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {creatingForGap && creatingForGap.competency && architect && (
        <NewPlanItemDialog
          gap={creatingForGap}
          submitting={creating.submitting}
          error={creating.error}
          onCancel={() => {
            creating.clearError();
            setCreatingForCompetencyId(null);
          }}
          onSave={async (draft) => {
            const result = await creating.run(() =>
              viewModel.createItemFromGap(architectId, creatingForGap, draft, architect.name),
            );
            if (result.ok) setCreatingForCompetencyId(null);
          }}
        />
      )}
    </>
  );
}

function PlanStatusBar({
  plan,
  actsForArchitect,
  isLeadOfArchitect,
  isAssignedTechLead,
}: {
  plan: DevelopmentPlan;
  actsForArchitect: boolean;
  isLeadOfArchitect: boolean;
  isAssignedTechLead: boolean;
}) {
  const { t, locale } = useI18n();
  const labels = useLabels();
  const viewModel = useDevelopmentPlansViewModel();
  const notifySuccess = useSuccessToast();
  const planTransition = useAsyncSubmit(t("pdi.plan.transitionError"));
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);

  const status = plan.status;
  const canApprove = status === "Draft" && isLeadOfArchitect;
  const canReturnToDraft = status === "Approved" && isLeadOfArchitect;
  const canComplete = status === "Approved" && actsForArchitect;
  const canReopen = status === "Completed" && isAssignedTechLead;
  const ownerSeesLockedMessage = status === "Completed" && actsForArchitect && !isAssignedTechLead;

  const incompleteReason =
    plan.items.length === 0
      ? t("pdi.plan.incomplete.noItems")
      : plan.items.some((i) => i.status === "Not Started")
        ? t("pdi.plan.incomplete.notStarted")
        : undefined;

  const transitioning = planTransition.submitting;
  const runTransition = (action: () => Promise<DevelopmentPlan>) => void planTransition.run(action);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 surface-inset px-3 py-2 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("pdi.plan.status")}
        </span>
        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
          {labels.planStatus[status]}
        </span>
        {status === "Completed" && (
          <span className="text-xs text-muted-foreground">{t("pdi.plan.locked")}</span>
        )}
        {status === "Approved" && (
          <span className="text-xs text-muted-foreground">{t("pdi.plan.approvedHint")}</span>
        )}
        {plan.approvedAt && (status === "Approved" || status === "Completed") && (
          <span className="text-xs text-muted-foreground">
            {t("pdi.plan.approvedAt", {
              data: defaultDateFormatter.formatDate(plan.approvedAt, locale) ?? "",
            })}
          </span>
        )}
        {plan.completedAt && status === "Completed" && (
          <span className="text-xs text-muted-foreground">
            {t("pdi.plan.completedAt", {
              data: defaultDateFormatter.formatDate(plan.completedAt, locale) ?? "",
            })}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canApprove && (
            <Button
              size="sm"
              disabled={transitioning}
              onClick={() => runTransition(() => viewModel.approve(plan.id))}
            >
              {transitioning ? t("pdi.plan.approving") : t("pdi.plan.approve")}
            </Button>
          )}
          {canComplete && (
            <Button
              size="sm"
              variant="secondary"
              disabled={transitioning || !!incompleteReason}
              title={incompleteReason}
              onClick={() => runTransition(() => viewModel.complete(plan.id))}
            >
              {transitioning ? t("pdi.plan.completing") : t("pdi.plan.complete")}
            </Button>
          )}
          {canReturnToDraft && (
            <Button
              size="sm"
              variant="outline"
              disabled={transitioning}
              onClick={() => runTransition(() => viewModel.returnToDraft(plan.id))}
            >
              {transitioning ? t("pdi.plan.returningToDraft") : t("pdi.plan.returnToDraft")}
            </Button>
          )}
          {canReopen && (
            <Button size="sm" variant="outline" onClick={() => setReopenDialogOpen(true)}>
              {t("pdi.plan.reopen")}
            </Button>
          )}
        </div>
        {canComplete && incompleteReason && (
          <p className="w-full text-xs text-muted-foreground">{incompleteReason}</p>
        )}
        {ownerSeesLockedMessage && (
          <p className="w-full text-xs text-muted-foreground">{t("pdi.plan.lockedForOwner")}</p>
        )}
        {planTransition.error && (
          <p className="w-full text-xs text-destructive">{planTransition.error}</p>
        )}
      </div>

      {reopenDialogOpen && (
        <ReopenPlanDialog
          onClose={() => setReopenDialogOpen(false)}
          onSubmit={(reason) =>
            viewModel
              .reopen(plan.id, reason)
              .then((reopened) => notifySuccess("msg.plan.reopen.success", undefined, reopened))
          }
        />
      )}
    </>
  );
}

function PlanItemCard({
  planId,
  item,
  canEditDiagnostic,
  canEditExecution,
  canReschedule,
  smartEditing,
  onSmartEditingChange,
}: {
  planId: string;
  item: DevelopmentPlanItem;
  canEditDiagnostic: boolean;
  canEditExecution: boolean;
  canReschedule: boolean;
  smartEditing: boolean;
  onSmartEditingChange: (open: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const labels = useLabels();
  const sel = useSelectors();
  const actionTypes = useVocabulary("ACTION_TYPE");
  const viewModel = useDevelopmentPlansViewModel();
  const notifySuccess = useSuccessToast();

  const competencyName = sel.competencyById(item.competencyId)?.name ?? t("pdi.unknownCompetency");

  return (
    <div className="surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">{competencyName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{item.objective}</p>
        </div>
        <div className="flex items-center gap-2">
          <LevelBadge level={item.currentLevel} />
          <span className="text-muted-foreground">→</span>
          <LevelBadge level={item.targetLevel} />
          <GapBadge gap={item.targetLevel - item.currentLevel} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        <Field label={t("pdi.field.actionType")}>
          {canEditDiagnostic ? (
            <select
              className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
              value={item.actionType}
              onChange={(e) =>
                viewModel.setItemActionType(planId, item.id, e.target.value as ActionType)
              }
            >
              {actionTypes.options.every((option) => option.code !== item.actionType) && (
                <option value={item.actionType}>{actionTypes.label(item.actionType)}</option>
              )}
              {actionTypes.options.map((option) => (
                <option key={option.code} value={option.code}>
                  {actionTypes.label(option.code)}
                </option>
              ))}
            </select>
          ) : (
            <p className="py-1.5 text-sm">{actionTypes.label(item.actionType)}</p>
          )}
        </Field>
        <Field label={t("pdi.field.status")}>
          {canEditExecution ? (
            <select
              className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
              value={item.status}
              onChange={(e) =>
                viewModel.setItemStatus(planId, item.id, e.target.value as PdiStatus)
              }
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {labels.planItemStatus[s]}
                </option>
              ))}
            </select>
          ) : (
            <p className="py-1.5 text-sm">{labels.planItemStatus[item.status]}</p>
          )}
        </Field>
        <Field label={t("pdi.field.priority")}>
          <p className="py-1.5 text-sm">{labels.priority[item.priority]}</p>
        </Field>
        <Field label={t("pdi.field.dedication")}>
          <p className="py-1.5 text-sm tabular-nums">
            {item.dedicationHoursPerWeek != null
              ? t("pdi.field.dedication.value", { horas: item.dedicationHoursPerWeek })
              : "—"}
          </p>
        </Field>
        <DeadlineField
          planId={planId}
          item={item}
          locale={locale}
          canEditDraft={canEditDiagnostic}
          canReschedule={canReschedule}
        />
      </div>

      <ActionPlanField
        key={item.version}
        value={item.actionPlan}
        disabled={!canEditExecution}
        onSave={(actionPlan) => viewModel.saveActionPlan(planId, item.id, actionPlan)}
      />

      {item.smart && (
        <div className="mt-4 rounded-lg border border-border bg-secondary/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            SMART Goal
          </p>
          <p className="mt-2 text-sm">{item.smart.statement}</p>
          <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <dt className="font-medium text-foreground">Specific</dt>
              <dd>{item.smart.specific}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Measurable</dt>
              <dd>{item.smart.measurable}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Achievable</dt>
              <dd>{item.smart.achievable}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Relevant</dt>
              <dd>{item.smart.relevant}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Time-bound</dt>
              <dd>{item.smart.timeBound}</dd>
            </div>
          </dl>
        </div>
      )}

      {!item.smart && (canEditExecution || canEditDiagnostic) && !smartEditing && (
        <div className="mt-4 flex items-center gap-2">
          {canEditExecution && (
            <Button variant="secondary" size="sm" onClick={() => onSmartEditingChange(true)}>
              {t("pdi.smart.define")}
            </Button>
          )}
          {canEditDiagnostic && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                viewModel.removeItem(planId, item.id);
                notifySuccess("pdi.gap.removed.toast", { nome: competencyName });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("pdi.gap.remove")}
            </Button>
          )}
        </div>
      )}

      {!item.smart && canEditExecution && smartEditing && (
        <SmartGoalEditor
          onCancel={() => onSmartEditingChange(false)}
          onSave={(smart) => {
            viewModel.defineSmartGoal(planId, item.id, smart);
            onSmartEditingChange(false);
          }}
        />
      )}

      <CheckinTimeline planId={planId} item={item} canCheckin={canEditExecution} />
    </div>
  );
}

function ActionPlanField({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (value: string) => void;
}) {
  const { t } = useI18n();
  const { draft, setDraft, changed } = useServerDraft(value);
  const [saved, setSaved] = useState(false);

  const commit = () => {
    if (!changed) return;
    onSave(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("pdi.field.actionPlan")}
        </p>
        {saved && <span className="text-xs text-emerald-600">{t("pdi.saved")}</span>}
      </div>
      <Textarea
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        placeholder={t("pdi.field.actionPlan.placeholder")}
      />
    </div>
  );
}

function DeadlineField({
  planId,
  item,
  locale,
  canEditDraft,
  canReschedule,
}: {
  planId: string;
  item: DevelopmentPlanItem;
  locale: string;
  canEditDraft: boolean;
  canReschedule: boolean;
}) {
  const { t } = useI18n();
  const viewModel = useDevelopmentPlansViewModel();
  const [rescheduling, setRescheduling] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (canEditDraft) {
    return (
      <Field label={t("pdi.field.deadline")}>
        <input
          type="date"
          className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
          value={item.targetDate}
          onChange={(e) => viewModel.setItemTargetDate(planId, item.id, e.target.value)}
        />
      </Field>
    );
  }

  return (
    <Field label={t("pdi.field.deadline")}>
      <div className="flex flex-wrap items-center gap-2 py-1.5">
        <p className="text-sm tabular-nums">
          {defaultDateFormatter.formatDate(item.targetDate, locale)}
        </p>
        {canReschedule && (
          <Button
            size="sm"
            variant="ghost"
            className="h-auto px-1.5 py-0.5 text-xs"
            onClick={() => setRescheduling(true)}
          >
            {t("pdi.reschedule.action")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground"
          onClick={() => setHistoryOpen((open) => !open)}
        >
          {historyOpen ? t("pdi.reschedule.history.hide") : t("pdi.reschedule.history.show")}
        </Button>
      </div>
      {historyOpen && <ItemHistory planId={planId} itemId={item.id} locale={locale} />}
      {rescheduling && (
        <RescheduleDialog planId={planId} item={item} onClose={() => setRescheduling(false)} />
      )}
    </Field>
  );
}

function ItemHistory({
  planId,
  itemId,
  locale,
}: {
  planId: string;
  itemId: string;
  locale: string;
}) {
  const { t } = useI18n();
  const store = useStore();

  const query = useQuery({
    queryKey: ["plan-item-events", planId, itemId],
    queryFn: () => store.planItemEvents(planId, itemId),
  });

  return (
    <QuerySection
      query={query}
      errorMessage={t("pdi.reschedule.history.error")}
      skeleton={
        <p className="mt-1 text-xs text-muted-foreground">{t("pdi.reschedule.history.loading")}</p>
      }
    >
      {(events: DevelopmentPlanItemEvent[]) =>
        events.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">{t("pdi.reschedule.history.empty")}</p>
        ) : (
          <ul className="mt-1 space-y-1.5 border-t border-border pt-2">
            {events.map((e) => (
              <li key={e.id} className="text-xs text-muted-foreground">
                <p>
                  {t("pdi.reschedule.history.entry", {
                    de: e.fromTargetDate
                      ? (defaultDateFormatter.formatDate(e.fromTargetDate, locale) ?? "")
                      : "—",
                    para: defaultDateFormatter.formatDate(e.toTargetDate, locale) ?? "",
                  })}
                </p>
                <p>
                  {t("pdi.reschedule.history.reason", { motivo: e.reason })} ·{" "}
                  {defaultDateFormatter.formatDate(e.occurredAt, locale)}
                </p>
              </li>
            ))}
          </ul>
        )
      }
    </QuerySection>
  );
}

function RescheduleDialog({
  planId,
  item,
  onClose,
}: {
  planId: string;
  item: DevelopmentPlanItem;

  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const viewModel = useDevelopmentPlansViewModel();
  const [targetDate, setTargetDate] = useState(item.targetDate);

  return (
    <CommandWithReasonDialog
      title={t("pdi.reschedule.title")}
      reasonInputId="reschedule-reason"
      reasonLabel={t("pdi.reschedule.reasonLabel")}
      reasonPlaceholder={t("pdi.reschedule.reasonPlaceholder")}
      confirmLabel={t("pdi.reschedule.confirm")}
      submittingLabel={t("pdi.reschedule.saving")}
      cancelLabel={t("pdi.newItem.cancel")}
      fallbackError={t("pdi.reschedule.error")}
      canSubmit={targetDate.length > 0}
      dismissibleWhileSubmitting={false}
      disableFieldsWhileSubmitting
      errorRole="alert"
      extraFields={({ submitting }) => (
        <div className="grid gap-3">
          <dl>
            <dt className="text-sm font-medium leading-none">{t("pdi.reschedule.current")}</dt>
            <dd className="mt-1 text-sm tabular-nums">
              {defaultDateFormatter.formatDate(item.targetDate, locale)}
            </dd>
          </dl>
          <div>
            <Label htmlFor="reschedule-target-date">{t("pdi.reschedule.new")}</Label>
            <input
              id="reschedule-target-date"
              type="date"
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>
      )}
      onSubmit={(reason) => viewModel.reschedule(planId, item.id, targetDate, reason)}
      onClose={onClose}
    />
  );
}

function CheckinTimeline({
  planId,
  item,
  canCheckin,
}: {
  planId: string;
  item: DevelopmentPlanItem;
  canCheckin: boolean;
}) {
  const { t, locale } = useI18n();
  const user = useCurrentUser();
  const viewModel = useDevelopmentPlansViewModel();
  const [text, setText] = useState("");

  const { submitting: saving, error, run } = useAsyncSubmit(t("pdi.checkin.error"));

  const submit = async () => {
    if (!text.trim() || saving) return;
    const result = await run(() => viewModel.addCheckin(planId, item.id, text));
    if (result.ok) setText("");
  };

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("pdi.checkin.title", { n: item.checkins.length })}
      </p>
      {item.checkins.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {item.checkins.map((c) => (
            <li key={c.id} className="text-sm">
              <span className="text-muted-foreground">
                {c.authorUserId === user.id ? t("comment.you") : t("pdi.checkin.someone")} ·{" "}
                {defaultDateFormatter.formatDate(c.createdAt, locale)}:
              </span>{" "}
              {c.text}
            </li>
          ))}
        </ul>
      )}
      {canCheckin && (
        <div className="flex items-center gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("pdi.checkin.placeholder")}
            aria-label={t("pdi.checkin.placeholder")}
            className="min-h-9 flex-1"
          />
          <Button size="sm" disabled={saving || !text.trim()} onClick={() => void submit()}>
            {saving ? t("pdi.checkin.saving") : t("pdi.checkin.save")}
          </Button>
        </div>
      )}
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function NewPlanItemDialog({
  gap,
  submitting,
  error,
  onSave,
  onCancel,
}: {
  gap: Gap;
  submitting: boolean;
  error: string | null;
  onSave: (draft: {
    actionType: ActionType;
    actionPlan: string;
    targetDate: string;
    dedicationHoursPerWeek: number | null;
  }) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();

  const actionTypes = useVocabulary("ACTION_TYPE");
  const [actionType, setActionType] = useState(() => actionTypes.options[0]?.code ?? "");
  const [actionPlan, setActionPlan] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [dedication, setDedication] = useState("");
  const canSave =
    actionType.length > 0 && actionPlan.trim().length > 0 && targetDate.length > 0 && !submitting;

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("pdi.newItem.title", { competencia: gap.competency?.name ?? "" })}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("pdi.newItem.officialGap")}
            </p>
            <p className="mt-1">
              {t("pdi.newItem.officialGapValue", { atual: gap.item.final, alvo: gap.item.target })}
            </p>
          </div>
          <div>
            <Label htmlFor="new-item-action-type">{t("pdi.field.actionType")}</Label>
            <select
              id="new-item-action-type"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={actionType}
              disabled={submitting}
              onChange={(e) => setActionType(e.target.value)}
            >
              {actionTypes.options.map((option) => (
                <option key={option.code} value={option.code}>
                  {actionTypes.label(option.code)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="new-item-action-plan">{t("pdi.field.actionPlan")}</Label>
            <Textarea
              id="new-item-action-plan"
              className="mt-1"
              value={actionPlan}
              disabled={submitting}
              onChange={(e) => setActionPlan(e.target.value)}
              placeholder={t("pdi.field.actionPlan.placeholder")}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-item-target-date">{t("pdi.field.deadline")}</Label>
              <input
                id="new-item-target-date"
                type="date"
                min={defaultDateFormatter.todayIso()}
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={targetDate}
                disabled={submitting}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-item-dedication">{t("pdi.field.dedication")}</Label>
              <input
                id="new-item-dedication"
                type="number"
                min={0}
                step="0.5"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={dedication}
                disabled={submitting}
                placeholder={t("pdi.field.dedication.placeholder")}
                onChange={(e) => setDedication(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {t("pdi.newItem.cancel")}
          </Button>
          <Button
            disabled={!canSave}
            onClick={() =>
              onSave({
                actionType: actionType as ActionType,
                actionPlan: actionPlan.trim(),
                targetDate,
                dedicationHoursPerWeek: dedication.trim() ? Number(dedication) : null,
              })
            }
          >
            {submitting ? t("pdi.newItem.saving") : t("pdi.newItem.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReopenPlanDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <CommandWithReasonDialog
      title={t("pdi.plan.reopenDialog.title")}
      body={t("pdi.plan.reopenDialog.body")}
      reasonInputId="reopen-reason"
      reasonLabel={t("pdi.plan.reopenDialog.reasonLabel")}
      reasonPlaceholder={t("pdi.plan.reopenDialog.reasonPlaceholder")}
      confirmLabel={t("pdi.plan.reopenDialog.confirm")}
      submittingLabel={t("pdi.plan.reopening")}
      cancelLabel={t("pdi.plan.reopenDialog.cancel")}
      fallbackError={t("pdi.plan.transitionError")}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
}

const SMART_FIELDS = [
  { key: "specific", label: "Specific" },
  { key: "measurable", label: "Measurable" },
  { key: "achievable", label: "Achievable" },
  { key: "relevant", label: "Relevant" },
  { key: "timeBound", label: "Time-bound" },
] as const;

const SMART_FIELD_KEYS = [...SMART_FIELDS.map((field) => field.key), "statement"] as const;

function SmartGoalEditor({
  onSave,
  onCancel,
}: {
  onSave: (smart: SmartGoal) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<SmartGoal>({
    specific: "",
    measurable: "",
    achievable: "",
    relevant: "",
    timeBound: "",
    statement: "",
  });
  const canSave = SMART_FIELD_KEYS.every((key) => draft[key].trim().length > 0);

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-border bg-secondary/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        SMART Goal
      </p>
      {SMART_FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label className="text-xs font-medium text-foreground" htmlFor={`smart-${key}`}>
            {label}
          </label>
          <Textarea
            id={`smart-${key}`}
            className="mt-1 min-h-12 text-sm"
            value={draft[key]}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          />
        </div>
      ))}
      <div>
        <label className="text-xs font-medium text-foreground" htmlFor="smart-statement">
          {t("pdi.smart.statement")}
        </label>
        <Textarea
          id="smart-statement"
          className="mt-1 min-h-16 text-sm"
          value={draft.statement}
          onChange={(e) => setDraft({ ...draft, statement: e.target.value })}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" disabled={!canSave} onClick={() => onSave(draft)}>
          {t("pdi.smart.save")}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
