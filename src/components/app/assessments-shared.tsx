import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { GapBadge, LevelBadge, SectionCard } from "@/components/app/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { QuerySection } from "@/components/app/QuerySection";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type {
  Architect,
  Assessment,
  AssessmentComment,
  AssessmentDevelopmentSummary,
  AssessmentItem,
  Capability,
  Competency,
  Level,
} from "@/lib/domain";
import { api, ApiError, type CommentInput } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { useNarrowViewport } from "@/hooks/use-narrow-viewport";
import { useI18n, type I18nApi } from "@/lib/i18n";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { STATE_QUERY_KEY, useOperationalSettings, useStore, useVocabulary } from "@/lib/store";
import { defaultDateFormatter } from "@/lib/text";
import { AssessmentViewModel } from "@/lib/view-models/assessment-view-model";

function useAssessmentViewModel(): AssessmentViewModel {
  const store = useStore();
  return useMemo(() => new AssessmentViewModel(store, api, defaultUiAuthorizationPolicy), [store]);
}

export function useAssessmentPermissions(
  architectId: string,
  selectedArchitect: Architect | undefined,
  assessment: Assessment | undefined,
) {
  const user = useCurrentUser();
  const viewModel = useAssessmentViewModel();
  return viewModel.permissionsFor(user, architectId, selectedArchitect, assessment);
}

function commentCountLabel(total: number, t: I18nApi["t"]) {
  if (total === 0) return t("comment.count.none");
  return total === 1 ? t("comment.count.one") : t("comment.count.many", { n: total });
}

function CommentSection({
  comments,
  currentUserId,
  onCreate,
  onUpdate,
  onDelete,
}: {
  comments: readonly AssessmentComment[];
  currentUserId: string;
  onCreate: (input: CommentInput) => Promise<unknown>;
  onUpdate: (commentId: string, input: CommentInput) => Promise<unknown>;
  onDelete: (commentId: string) => Promise<unknown>;
}) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AssessmentComment | null>(null);

  return (
    <div className="space-y-3">
      {comments.length > 0 && (
        <ul className="space-y-2">
          {comments.map((comment) => {
            const mine = comment.authorUserId !== null && comment.authorUserId === currentUserId;
            const authorLabel = mine
              ? t("comment.you")
              : comment.authorRole === "TECH_LEAD"
                ? t("comment.author.techLead")
                : t("comment.author.professional");
            return editing === comment.id ? (
              <li key={comment.id}>
                <CommentForm
                  initial={comment}
                  submitLabel={t("comment.saveChanges")}
                  onSubmit={(input) => onUpdate(comment.id, input).then(() => setEditing(null))}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={comment.id} className="rounded-md border border-border bg-card p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {authorLabel}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{comment.text}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">
                    {t("comment.savedAt", {
                      data: defaultDateFormatter.formatDate(comment.createdAt, locale) ?? "",
                    })}
                    {comment.updatedAt &&
                      ` · ${t("comment.editedAt", { data: defaultDateFormatter.formatDate(comment.updatedAt, locale) ?? "" })}`}
                  </p>
                  {mine && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setEditing(comment.id)}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-destructive hover:underline"
                        onClick={() => setConfirmDelete(comment)}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CommentForm submitLabel={t("common.save")} onSubmit={onCreate} />

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("comment.delete.title")}
        description={t("comment.delete.hint")}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const alvo = confirmDelete;
          setConfirmDelete(null);
          if (alvo) void onDelete(alvo.id);
        }}
      />
    </div>
  );
}

function CommentForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: AssessmentComment;
  submitLabel: string;
  onSubmit: (input: CommentInput) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState(initial?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = text.trim();

  const submit = () => {
    if (!trimmed || saving) return;
    setError(null);
    setSaving(true);
    onSubmit({ text: trimmed })
      .then(() => {
        if (!initial) setText("");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t("comment.saveError")))
      .finally(() => setSaving(false));
  };

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("comment.placeholder")}
        aria-label={t("comment.placeholder")}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" role="status">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : !trimmed ? (
            t("comment.needText")
          ) : null}
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <Button size="sm" variant="outline" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
          )}
          <Button size="sm" disabled={saving || !trimmed} onClick={submit}>
            {saving ? t("comment.saving") : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const assessmentStatusTone: Record<Assessment["status"], "neutral" | "progress" | "done"> = {
  Draft: "neutral",
  "In Review": "progress",
  Completed: "done",
};

export function CareerPortfolioSection({
  assessment,
  isOwner,
  isLead,
}: {
  assessment: Assessment;
  isOwner: boolean;
  isLead: boolean;
}) {
  const store = useStore();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const viewModel = useAssessmentViewModel();

  const globalFloor = useOperationalSettings().careerMinimumQualifiedFloor;
  const [selectedCapabilityId, setSelectedCapabilityId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; name: string } | null>(null);

  const queryKey = ["assessment-eligibility", assessment.id];
  const {
    data: eligibility,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => api.assessmentEligibility(assessment.id),
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey });

    void queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY });
  };

  const canPropose = isOwner && assessment.status === "Draft";
  const canConfirm = isLead && assessment.status === "In Review";

  const addCapability = () => {
    if (!selectedCapabilityId) return;
    setActionError(null);
    setBusy(true);
    viewModel
      .proposeCapability(assessment.id, selectedCapabilityId)
      .then(() => {
        setSelectedCapabilityId("");
        invalidateAll();
      })
      .catch((error: unknown) =>
        setActionError(error instanceof ApiError ? error.message : t("asmt.portfolio.error")),
      )
      .finally(() => setBusy(false));
  };

  const attemptRemove = (capabilityId: string, capabilityName: string, force = false) => {
    setActionError(null);
    setBusy(true);
    viewModel
      .removeCapability(assessment.id, capabilityId, force)
      .then(() => {
        invalidateAll();
        setPendingRemoval(null);
      })
      .catch((error: unknown) => {
        if (!force && error instanceof ApiError && error.code === "PORTFOLIO_HAS_ANSWERED_ITEMS") {
          setPendingRemoval({ id: capabilityId, name: capabilityName });
          return;
        }
        setActionError(error instanceof ApiError ? error.message : t("asmt.portfolio.error"));
      })
      .finally(() => setBusy(false));
  };

  const confirmCapability = (capabilityId: string) => {
    setActionError(null);
    setBusy(true);
    viewModel
      .confirmCapability(assessment.id, capabilityId)
      .then(() => invalidateAll())
      .catch((error: unknown) =>
        setActionError(error instanceof ApiError ? error.message : t("asmt.portfolio.error")),
      )
      .finally(() => setBusy(false));
  };

  return (
    <QuerySection
      query={{ data: eligibility, isPending, isError, refetch }}
      className="mb-4"
      title={t("asmt.portfolio.title")}
      description={t("asmt.portfolio.subtitle")}
      errorMessage={t("asmt.portfolio.loadError")}

      skeleton={
        <div className="space-y-2">
          <div className="h-9 animate-pulse rounded-md bg-secondary" />
          <div className="h-9 animate-pulse rounded-md bg-secondary" />
          <div className="h-9 w-2/3 animate-pulse rounded-md bg-secondary" />
        </div>
      }

      isEmpty={(data) => !data.capabilities}
    >
      {(eligibility) => {
        const availableToAdd = viewModel.availableCapabilitiesToPropose(
          store.capabilities,
          eligibility,
        );
        const portfolioSize = eligibility.capabilities.length;

        const minimumPortfolio = eligibility.policy?.minimumQualifiedCapabilities ?? globalFloor;

        return (
          <SectionCard
            className="mb-4"
            title={t("asmt.portfolio.title")}
            description={t("asmt.portfolio.subtitle")}
          >
            {}
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={portfolioSize >= minimumPortfolio ? "default" : "outline"}>
                {t("asmt.portfolio.size", { n: portfolioSize, min: minimumPortfolio })}
              </Badge>
              {}
              <Progress
                value={Math.min(100, (portfolioSize / minimumPortfolio) * 100)}
                className="h-1.5 w-24"
                aria-label={t("asmt.portfolio.size", { n: portfolioSize, min: minimumPortfolio })}
              />
              {eligibility.nextCareerLevel ? (
                <>
                  <span className="text-muted-foreground">
                    {t("asmt.portfolio.progressTo", { nivel: eligibility.nextCareerLevel.name })}
                  </span>
                  <Badge variant={eligibility.eligible ? "default" : "outline"}>
                    {t("asmt.portfolio.qualifiedCount", {
                      qualified: eligibility.qualifiedConfirmedCount,
                      required: eligibility.policy?.minimumQualifiedCapabilities ?? globalFloor,
                    })}
                  </Badge>
                </>
              ) : (
                <span className="text-muted-foreground">{t("asmt.portfolio.topLevel")}</span>
              )}
            </div>
            {canPropose && portfolioSize < minimumPortfolio && (
              <p className="mb-3 text-xs text-muted-foreground">
                {t("asmt.portfolio.minimumHint", { min: minimumPortfolio })}
              </p>
            )}

            <ul className="space-y-1.5">
              {eligibility.capabilities.map((entry) => {
                const capability = store.capabilities.find((c) => c.id === entry.capabilityId);
                const name = capability?.name ?? entry.capabilityId;
                return (
                  <li
                    key={entry.capabilityId}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>{name}</span>
                    <div className="flex items-center gap-2">
                      {entry.confirmed ? (
                        <Badge variant={entry.qualified ? "default" : "outline"}>
                          {entry.qualified
                            ? t("asmt.portfolio.qualified")
                            : t("asmt.portfolio.notQualified")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t("asmt.portfolio.pendingConfirmation")}</Badge>
                      )}
                      {canConfirm && !entry.confirmed && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => confirmCapability(entry.capabilityId)}
                        >
                          {t("asmt.portfolio.confirm")}
                        </Button>
                      )}
                      {canPropose && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => attemptRemove(entry.capabilityId, name)}
                        >
                          {t("common.remove")}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
              {eligibility.capabilities.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("asmt.portfolio.empty")}</p>
              )}
            </ul>

            {canPropose && (
              <div className="mt-3 flex gap-2">
                <select
                  aria-label={t("asmt.portfolio.addLabel")}
                  className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={selectedCapabilityId}
                  disabled={busy}
                  onChange={(e) => setSelectedCapabilityId(e.target.value)}
                >
                  <option value="">{t("asmt.portfolio.addPlaceholder")}</option>
                  {availableToAdd.map((cap) => (
                    <option key={cap.id} value={cap.id}>
                      {cap.name}
                    </option>
                  ))}
                </select>
                <Button size="sm" disabled={!selectedCapabilityId || busy} onClick={addCapability}>
                  {t("asmt.portfolio.add")}
                </Button>
              </div>
            )}
            {canPropose && availableToAdd.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">{t("asmt.portfolio.noneReady")}</p>
            )}

            {actionError && (
              <p className="mt-2 text-xs text-destructive" role="alert">
                {actionError}
              </p>
            )}

            <ConfirmDialog
              open={pendingRemoval !== null}
              title={t("asmt.portfolio.removeConfirm.title")}
              description={t("asmt.portfolio.removeConfirm.description", {
                nome: pendingRemoval?.name ?? "",
              })}
              confirmLabel={t("asmt.portfolio.removeConfirm.confirm")}
              cancelLabel={t("pdi.newItem.cancel")}
              onConfirm={() =>
                pendingRemoval && attemptRemove(pendingRemoval.id, pendingRemoval.name, true)
              }
              onCancel={() => setPendingRemoval(null)}
            />
          </SectionCard>
        );
      }}
    </QuerySection>
  );
}

export function DevelopmentSummarySection({
  assessment,
  isOwner,
  isLead,
}: {
  assessment: Assessment;
  isOwner: boolean;
  isLead: boolean;
}) {
  const { t } = useI18n();
  const status = assessment.status;
  const canEdit = status === "Draft" ? isOwner && !isLead : status === "In Review" ? isLead : false;

  const queryKey: QueryKey = ["assessment-development-summary", assessment.id];
  const { data, isPending, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => api.assessmentDevelopmentSummary(assessment.id),

    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  return (
    <QuerySection
      query={{ data, isPending, isError, refetch }}
      className="mb-4"
      title={t("asmt.devSummary.title")}
      description={t("asmt.devSummary.subtitle")}
      errorMessage={t("asmt.devSummary.loadError")}
      skeleton={
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-24 animate-pulse rounded-md bg-secondary" />
          <div className="h-24 animate-pulse rounded-md bg-secondary" />
          <div className="h-24 animate-pulse rounded-md bg-secondary" />
        </div>
      }
    >
      {(data) => (
        <DevelopmentSummaryForm
          key={data.version}
          assessmentId={assessment.id}
          data={data}
          canEdit={canEdit}
          queryKey={queryKey}
          onReload={() => void refetch()}
        />
      )}
    </QuerySection>
  );
}

function DevelopmentSummaryForm({
  assessmentId,
  data,
  canEdit,
  queryKey,
  onReload,
}: {
  assessmentId: string;
  data: AssessmentDevelopmentSummary;
  canEdit: boolean;
  queryKey: QueryKey;
  onReload: () => void;
}) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const viewModel = useAssessmentViewModel();
  const [startDoing, setStartDoing] = useState(data.startDoing);
  const [stopDoing, setStopDoing] = useState(data.stopDoing);
  const [continueDoing, setContinueDoing] = useState(data.continueDoing);
  const [saveState, setSaveState] = useState<"clean" | "dirty" | "saving" | "saved" | "error">(
    "clean",
  );
  const [conflict, setConflict] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const markDirty = () => {
    setConflict(false);
    setSaveState((prev) => (prev === "saving" ? prev : "dirty"));
  };

  const save = () => {
    setSaveState("saving");
    setErrorMessage(null);
    viewModel
      .updateDevelopmentSummary(
        assessmentId,
        { startDoing, stopDoing, continueDoing },
        data.version,
      )
      .then(() => {
        setSaveState("saved");
        void queryClient.invalidateQueries({ queryKey });
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 409) {
          setConflict(true);
          setSaveState("error");
          return;
        }
        setErrorMessage(error instanceof ApiError ? error.message : t("asmt.devSummary.saveError"));
        setSaveState("error");
      });
  };

  return (
    <SectionCard
      className="mb-4"
      title={t("asmt.devSummary.title")}
      description={t("asmt.devSummary.subtitle")}
    >
      {conflict && (
        <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p>{t("asmt.devSummary.conflict")}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => {
              setConflict(false);
              onReload();
            }}
          >
            {t("asmt.devSummary.reload")}
          </Button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="dev-summary-start">{t("asmt.devSummary.start")}</Label>
          <Textarea
            id="dev-summary-start"
            className="mt-1"
            value={startDoing}
            disabled={!canEdit}
            onChange={(e) => {
              setStartDoing(e.target.value);
              markDirty();
            }}
            placeholder={t("asmt.devSummary.start.placeholder")}
          />
        </div>
        <div>
          <Label htmlFor="dev-summary-stop">{t("asmt.devSummary.stop")}</Label>
          <Textarea
            id="dev-summary-stop"
            className="mt-1"
            value={stopDoing}
            disabled={!canEdit}
            onChange={(e) => {
              setStopDoing(e.target.value);
              markDirty();
            }}
            placeholder={t("asmt.devSummary.stop.placeholder")}
          />
        </div>
        <div>
          <Label htmlFor="dev-summary-continue">{t("asmt.devSummary.continue")}</Label>
          <Textarea
            id="dev-summary-continue"
            className="mt-1"
            value={continueDoing}
            disabled={!canEdit}
            onChange={(e) => {
              setContinueDoing(e.target.value);
              markDirty();
            }}
            placeholder={t("asmt.devSummary.continue.placeholder")}
          />
        </div>
      </div>

      {canEdit && (
        <div className="mt-3 flex items-center gap-3">
          <Button
            size="sm"
            disabled={saveState === "saving" || saveState === "clean"}
            onClick={save}
          >
            {saveState === "saving" ? t("asmt.devSummary.saving") : t("common.save")}
          </Button>
          <p className="text-xs" role="status">
            {saveState === "saved" && (
              <span className="text-emerald-600">{t("asmt.devSummary.saved")}</span>
            )}
            {saveState === "dirty" && (
              <span className="text-muted-foreground">{t("asmt.devSummary.unsaved")}</span>
            )}
            {saveState === "error" && !conflict && errorMessage && (
              <span className="text-destructive" role="alert">
                {errorMessage}
              </span>
            )}
          </p>
        </div>
      )}

      {!canEdit && data.updatedAt && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("asmt.devSummary.lastUpdated", {
            data: defaultDateFormatter.formatDate(data.updatedAt, locale) ?? "",
          })}
        </p>
      )}
    </SectionCard>
  );
}

function LevelSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: Level | null;
  onChange: (v: Level) => void;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="w-full rounded-md border border-input bg-card px-2 py-1 text-sm"
      value={value ?? ""}
      onChange={(e) => onChange(Number(e.target.value) as Level)}
    >
      <option value="" disabled>
        —
      </option>
      {[1, 2, 3, 4, 5].map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function CapabilityAssessmentCard({
  capability,
  assessment,
  status,
  canEditSelf,
  canEditLeaderFinal,
  architectId,
  openComment,
  onToggleComment,
}: {
  capability: Capability;
  assessment: Assessment;
  status: Assessment["status"] | undefined;
  canEditSelf: boolean;
  canEditLeaderFinal: boolean;
  architectId: string;
  openComment: string | null;
  onToggleComment: (competencyId: string) => void;
}) {
  const store = useStore();
  const { t, locale } = useI18n();

  const evidenceTypes = useVocabulary("EVIDENCE_TYPE");
  const user = useCurrentUser();
  const viewModel = useAssessmentViewModel();

  const narrow = useNarrowViewport(768);

  const comps = store.competencies.filter((c) => c.capabilityId === capability.id);
  const answeredCount = comps.filter((c) => {
    const item = assessment.items.find((i) => i.competencyId === c.id);
    if (!item) return false;
    return status === "Draft" ? item.self !== null : item.final !== null;
  }).length;

  return (
    <SectionCard
      title={capability.name}
      description={
        (comps.length === 1
          ? t("asmt.competencyCount.one")
          : t("asmt.competencyCount.many", { n: comps.length })) +
        (comps.length > 0
          ? ` · ${t("asmt.progressCount", { answered: answeredCount, total: comps.length })}`
          : "")
      }
    >
      {comps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("asmt.noCompetencies")}</p>
      ) : narrow ? (
        <div className="space-y-3" data-testid="competency-stacked-list">
          {comps.map((c) => {
            const item = assessment.items.find((i) => i.competencyId === c.id);
            if (!item) return null;
            return (
              <CompetencyStackedCard
                key={c.id}
                competency={c}
                item={item}
                assessmentId={assessment.id}
                architectId={architectId}
                canEditSelf={canEditSelf}
                canEditLeaderFinal={canEditLeaderFinal}
                openComment={openComment}
                onToggleComment={onToggleComment}
              />
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2">
                  {t("asmt.col.competency")}
                </th>
                <th scope="col" className="w-24 py-2 text-center">
                  {t("asmt.col.self")}
                </th>
                <th scope="col" className="w-24 py-2 text-center">
                  {t("asmt.col.techLead")}
                </th>
                <th scope="col" className="w-24 py-2 text-center">
                  {t("asmt.col.target")}
                </th>
                <th scope="col" className="w-24 py-2 text-center">
                  {t("asmt.col.final")}
                </th>
                <th scope="col" className="w-44 py-2">
                  {t("asmt.col.gap")}
                </th>
                <th scope="col" className="w-24 py-2 text-right">
                  {t("asmt.col.notes")}
                </th>
              </tr>
            </thead>
            <tbody>
              {comps.map((c) => {
                const item = assessment.items.find((i) => i.competencyId === c.id);
                if (!item) return null;

                const gap = item.final === null ? undefined : item.target - item.final;
                const diverges =
                  item.self !== null && item.leader !== null && item.self !== item.leader;

                const acceptedEvidence = store.evidences.filter(
                  (e) =>
                    e.architectId === architectId &&
                    e.status === "Accepted" &&
                    e.competencyIds.includes(c.id),
                );
                return (
                  <Fragment key={c.id}>
                    <tr className="border-b border-border/60">
                      <td className="py-2 font-medium">
                        <span className="flex items-center gap-1.5">
                          {c.name}
                          {acceptedEvidence.length > 0 && (
                            <BadgeCheck
                              className="h-3.5 w-3.5 shrink-0 text-[var(--level-5-fg)]"
                              aria-label={t("asmt.evidence.badge", {
                                n: acceptedEvidence.length,
                              })}
                            />
                          )}
                        </span>
                      </td>
                      <td className="px-1 py-2">
                        {canEditSelf ? (
                          <LevelSelect
                            value={item.self}
                            onChange={(v) => viewModel.updateSelfScore(assessment.id, c.id, v)}
                            ariaLabel={t("asmt.select.self", { competency: c.name })}
                          />
                        ) : (
                          <LevelBadge level={item.self ?? undefined} />
                        )}
                      </td>
                      <td className="px-1 py-2">
                        <div className="flex items-center gap-1">
                          {canEditLeaderFinal ? (
                            <LevelSelect
                              value={item.leader}
                              onChange={(v) => viewModel.updateLeaderScore(assessment.id, c.id, v)}
                              ariaLabel={t("asmt.select.leader", { competency: c.name })}
                            />
                          ) : (
                            <LevelBadge level={item.leader ?? undefined} />
                          )}
                          {diverges && (
                            <AlertTriangle
                              className="h-3.5 w-3.5 shrink-0 text-[var(--gap-high-fg)]"
                              aria-label={t("asmt.divergence")}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-1 py-2 text-center">
                        <LevelBadge level={item.target} />
                      </td>
                      <td className="px-1 py-2">
                        {canEditLeaderFinal ? (
                          <LevelSelect
                            value={item.final}
                            onChange={(v) => viewModel.updateFinalScore(assessment.id, c.id, v)}
                            ariaLabel={t("asmt.select.final", { competency: c.name })}
                          />
                        ) : (
                          <LevelBadge level={item.final ?? undefined} />
                        )}
                      </td>
                      <td className="py-2">
                        <GapBadge gap={gap} />
                      </td>
                      <td className="py-2 text-right">
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => onToggleComment(c.id)}
                        >
                          {commentCountLabel(item.comments.length, t)}
                        </button>
                      </td>
                    </tr>
                    {openComment === c.id && (
                      <tr className="border-b border-border/60 bg-secondary/40">
                        <td colSpan={7} className="p-3">
                          {acceptedEvidence.length > 0 && (
                            <div className="mb-3 space-y-1.5 border-b border-border pb-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t("asmt.evidence.title")}
                              </p>
                              <ul className="space-y-1">
                                {acceptedEvidence.map((e) => (
                                  <li key={e.id} className="text-sm">
                                    <span className="font-medium">{e.title}</span>{" "}
                                    <span className="text-xs text-muted-foreground">
                                      {evidenceTypes.label(e.type)} ·{" "}
                                      {defaultDateFormatter.formatDate(e.date, locale)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <CommentSection
                            comments={item.comments}
                            currentUserId={user.id}
                            onCreate={(input) => viewModel.addComment(assessment.id, c.id, input)}
                            onUpdate={(commentId, input) =>
                              viewModel.updateComment(assessment.id, c.id, commentId, input)
                            }
                            onDelete={(commentId) =>
                              viewModel.removeComment(assessment.id, c.id, commentId)
                            }
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function CompetencyStackedCard({
  competency,
  item,
  assessmentId,
  architectId,
  canEditSelf,
  canEditLeaderFinal,
  openComment,
  onToggleComment,
}: {
  competency: Competency;
  item: AssessmentItem;
  assessmentId: string;
  architectId: string;
  canEditSelf: boolean;
  canEditLeaderFinal: boolean;
  openComment: string | null;
  onToggleComment: (competencyId: string) => void;
}) {
  const store = useStore();
  const { t, locale } = useI18n();

  const evidenceTypes = useVocabulary("EVIDENCE_TYPE");
  const user = useCurrentUser();
  const viewModel = useAssessmentViewModel();

  const gap = item.final === null ? undefined : item.target - item.final;
  const diverges = item.self !== null && item.leader !== null && item.self !== item.leader;

  const acceptedEvidence = store.evidences.filter(
    (e) =>
      e.architectId === architectId &&
      e.status === "Accepted" &&
      e.competencyIds.includes(competency.id),
  );

  return (
    <div
      className="rounded-md border border-border bg-card p-3"
      data-testid="competency-stacked-card"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {competency.name}
          {acceptedEvidence.length > 0 && (
            <BadgeCheck
              className="h-3.5 w-3.5 shrink-0 text-[var(--level-5-fg)]"
              aria-label={t("asmt.evidence.badge", { n: acceptedEvidence.length })}
            />
          )}
        </span>
        <GapBadge gap={gap} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("asmt.col.self")}
          </p>
          <div className="mt-1">
            {canEditSelf ? (
              <LevelSelect
                value={item.self}
                onChange={(v) => viewModel.updateSelfScore(assessmentId, competency.id, v)}
                ariaLabel={t("asmt.select.self", { competency: competency.name })}
              />
            ) : (
              <LevelBadge level={item.self ?? undefined} />
            )}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("asmt.col.techLead")}
          </p>
          <div className="mt-1 flex items-center gap-1">
            {canEditLeaderFinal ? (
              <LevelSelect
                value={item.leader}
                onChange={(v) => viewModel.updateLeaderScore(assessmentId, competency.id, v)}
                ariaLabel={t("asmt.select.leader", { competency: competency.name })}
              />
            ) : (
              <LevelBadge level={item.leader ?? undefined} />
            )}
            {diverges && (
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0 text-[var(--gap-high-fg)]"
                aria-label={t("asmt.divergence")}
              />
            )}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("asmt.col.target")}
          </p>
          <div className="mt-1">
            <LevelBadge level={item.target} />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("asmt.col.final")}
          </p>
          <div className="mt-1">
            {canEditLeaderFinal ? (
              <LevelSelect
                value={item.final}
                onChange={(v) => viewModel.updateFinalScore(assessmentId, competency.id, v)}
                ariaLabel={t("asmt.select.final", { competency: competency.name })}
              />
            ) : (
              <LevelBadge level={item.final ?? undefined} />
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="mt-3 text-xs text-primary hover:underline"
        onClick={() => onToggleComment(competency.id)}
      >
        {commentCountLabel(item.comments.length, t)}
      </button>

      {openComment === competency.id && (
        <div className="mt-3 border-t border-border pt-3">
          {acceptedEvidence.length > 0 && (
            <div className="mb-3 space-y-1.5 border-b border-border pb-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("asmt.evidence.title")}
              </p>
              <ul className="space-y-1">
                {acceptedEvidence.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="font-medium">{e.title}</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      {evidenceTypes.label(e.type)} ·{" "}
                      {defaultDateFormatter.formatDate(e.date, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <CommentSection
            comments={item.comments}
            currentUserId={user.id}
            onCreate={(input) => viewModel.addComment(assessmentId, competency.id, input)}
            onUpdate={(commentId, input) =>
              viewModel.updateComment(assessmentId, competency.id, commentId, input)
            }
            onDelete={(commentId) =>
              viewModel.removeComment(assessmentId, competency.id, commentId)
            }
          />
        </div>
      )}
    </div>
  );
}
