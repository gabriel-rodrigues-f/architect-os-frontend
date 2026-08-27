import { AlertCircle, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ArchitectSelectCombobox } from "@/components/app/ArchitectSelectCombobox";
import { FieldLabel, Initials } from "@/components/app/ui-bits";
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
import { useSuccessToast, useToastSubmit } from "@/hooks";
import { useCurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import type { Architect, Level, MentoringSession, ProficiencyUpdate } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import type { Selectors } from "@/lib/selectors";
import { useSelectors, useStore } from "@/lib/store";
import { defaultDateFormatter, defaultNameFormatter } from "@/lib/text";
import { MentoringViewModel } from "@/lib/view-models";

const REQUIRED_FIELDS = [
  "menteeId",
  "date",
  "durationMin",
  "topic",
  "notes",
  "decisions",
  "actions",
] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];

interface ProficiencyDraft {
  competencyId: string;
  observedLevel: Level | null;
  note?: string | undefined;
}

function useMentoringSessionForm(menteeOptions: Architect[]) {
  const store = useStore();
  const user = useCurrentUser();
  const sel = useSelectors();

  const viewModel = useMemo(() => new MentoringViewModel(store), [store]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    menteeId: menteeOptions[0]?.id ?? "",
    date: defaultDateFormatter.todayIso(),
    durationMin: "",
    topic: "",
    notes: "",
    decisions: "",
    actions: "",
    nextSession: "",
  });
  const [competencyIds, setCompetencyIds] = useState<string[]>([]);
  const [proficiencyUpdates, setProficiencyUpdates] = useState<ProficiencyDraft[]>([]);
  const toggleProficiencyUpdate = (competencyId: string) =>
    setProficiencyUpdates((prev) =>
      prev.some((u) => u.competencyId === competencyId)
        ? prev.filter((u) => u.competencyId !== competencyId)
        : [...prev, { competencyId, observedLevel: null }],
    );
  const setProficiencyLevel = (competencyId: string, observedLevel: number) => {
    setProficiencyUpdates((prev) =>
      prev.map((u) =>
        u.competencyId === competencyId ? { ...u, observedLevel: observedLevel as Level } : u,
      ),
    );
    setProficiencyMissingLevel(false);
  };
  const setProficiencyNote = (competencyId: string, note: string) =>
    setProficiencyUpdates((prev) =>
      prev.map((u) => (u.competencyId === competencyId ? { ...u, note: note || undefined } : u)),
    );

  const [proficiencyMissingLevel, setProficiencyMissingLevel] = useState(false);
  const toggleCompetency = (id: string) =>
    setCompetencyIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const [missing, setMissing] = useState<RequiredField[]>([]);
  const [showToast, setShowToast] = useState(false);

  const setField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMissing((prev) => prev.filter((f) => f !== field));
  };

  const isMissing = (field: RequiredField) => missing.includes(field);

  const invalid = (field: RequiredField) =>
    isMissing(field) ? "border-destructive ring-1 ring-destructive" : "";

  const durationValue = Number(form.durationMin);
  const durationInvalid =
    form.durationMin.trim().length > 0 && (!Number.isInteger(durationValue) || durationValue <= 0);

  const { submitting: saving, run } = useToastSubmit();
  const notifySuccess = useSuccessToast();

  const submit = async () => {
    const vazios = REQUIRED_FIELDS.filter((f) => !form[f].trim());
    const proficiencyIncomplete = proficiencyUpdates.some((u) => u.observedLevel === null);
    if (vazios.length > 0 || durationInvalid || proficiencyIncomplete) {
      setMissing(
        durationInvalid && !vazios.includes("durationMin") ? [...vazios, "durationMin"] : vazios,
      );
      setProficiencyMissingLevel(proficiencyIncomplete);
      setShowToast(true);
      return;
    }

    const confirmedUpdates: ProficiencyUpdate[] = proficiencyUpdates.map((u) => ({
      competencyId: u.competencyId,
      observedLevel: u.observedLevel as Level,
      ...(u.note ? { note: u.note } : {}),
    }));

    const result = await run(() =>
      viewModel.createSession(user.name, form, durationValue, competencyIds, confirmedUpdates),
    );
    if (!result.ok) return;
    notifySuccess(
      "msg.mentoring.create.success",
      { nome: sel.architectById(form.menteeId)?.name ?? "" },
      result.value,
    );
    setForm({
      ...form,
      durationMin: "",
      topic: "",
      notes: "",
      decisions: "",
      actions: "",
      nextSession: "",
    });
    setCompetencyIds([]);
    setProficiencyUpdates([]);
    setProficiencyMissingLevel(false);
    setMissing([]);
    setShowToast(false);
    setOpen(false);
  };

  return {
    open,
    setOpen,
    form,
    setField,
    missing,
    isMissing,
    invalid,
    showToast,
    setShowToast,
    saving,
    durationInvalid,
    competencyIds,
    toggleCompetency,
    proficiencyUpdates,
    toggleProficiencyUpdate,
    setProficiencyLevel,
    setProficiencyNote,
    proficiencyMissingLevel,
    submit,
  };
}

export function useMentoringTimeline() {
  const store = useStore();
  const orderedArchitects = [...store.architects].sort(defaultNameFormatter.byName);
  const defaultMenteeId =
    orderedArchitects.find((a) => a.active)?.id ?? orderedArchitects[0]?.id ?? "";
  const [filter, setFilter] = useState<string>(defaultMenteeId);

  const sessions = [...store.mentoringSessions]
    .filter((s) => s.menteeId === filter)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return { filter, setFilter, sessions };
}

export function MenteeFilterCombobox({
  architects,
  selected,
  onChange,
}: {
  architects: readonly Architect[];
  selected: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <ArchitectSelectCombobox
      architects={architects.filter((a) => a.active)}
      inactiveArchitects={architects.filter((a) => !a.active)}
      selectedId={selected}
      onChange={onChange}
      label={t("mentor.filter.label")}
      className="w-64"
    />
  );
}

function FollowUpScheduler({ session }: { session: MentoringSession }) {
  const { t, locale } = useI18n();
  const notifySuccess = useSuccessToast();
  const store = useStore();
  const viewModel = useMemo(() => new MentoringViewModel(store), [store]);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(session.nextSession ?? "");
  const [saving, setSaving] = useState(false);

  const save = () => {
    setSaving(true);
    viewModel
      .scheduleFollowUp(session.id, value || null)
      .then((updated) => {
        notifySuccess("msg.mentoring.scheduleFollowUp.success", undefined, updated);
        setEditing(false);
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t("mentor.followUp.error"));
      })
      .finally(() => setSaving(false));
  };

  if (!editing) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">
          {session.nextSession
            ? t("mentor.followUp.scheduled", {
                data: defaultDateFormatter.formatDate(session.nextSession, locale) ?? "",
              })
            : t("mentor.followUp.none")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          onClick={() => setEditing(true)}
        >
          {t("mentor.followUp.action")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        type="date"
        className="h-8 w-40 text-xs"
        aria-label={t("mentor.followUp.action")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button size="sm" disabled={saving} onClick={save}>
        {saving ? t("mentor.followUp.saving") : t("mentor.followUp.save")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
        {t("mentor.followUp.cancel")}
      </Button>
    </div>
  );
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div className="surface-inset p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm">{text || "—"}</p>
    </div>
  );
}

function MentoringTimelineItem({
  session,
  selectors,
}: {
  session: MentoringSession;
  selectors: Selectors;
}) {
  const { t, locale } = useI18n();
  const notifySuccess = useSuccessToast();
  const store = useStore();
  const viewModel = useMemo(() => new MentoringViewModel(store), [store]);
  const user = useCurrentUser();
  const [sendingSessionId, setSendingSessionId] = useState<string | null>(null);

  const plan = selectors.planFor(session.menteeId);
  const gaps = selectors.progressionGapsFor(session.menteeId);
  const eligible = viewModel.eligibleGapForPlan(session, gaps, plan);

  return (
    <li className="relative">
      <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
      <div className="flex flex-wrap items-center gap-2">
        <Initials name={selectors.architectById(session.menteeId)?.name ?? "?"} />
        <div>
          <p className="text-sm font-medium">{session.topic}</p>
          <p className="text-xs text-muted-foreground">
            {selectors.architectById(session.menteeId)?.name} · mentor {session.mentor} ·{" "}
            {defaultDateFormatter.formatDate(session.date, locale)} · {session.durationMin} min
          </p>
        </div>
      </div>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        <Block title={t("mentor.block.notes")} text={session.notes} />
        <Block title={t("mentor.block.decisions")} text={session.decisions} />
        <Block title={t("mentor.block.actions")} text={session.actions} />
      </div>
      {session.actions.trim() && eligible?.competency && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={sendingSessionId === session.id}
          onClick={async () => {
            const mentee = selectors.architectById(session.menteeId);
            if (!mentee || !eligible.competency) return;
            setSendingSessionId(session.id);
            try {
              const plan = await viewModel.sendToPlan(session, mentee, {
                assessmentId: eligible.assessmentId,
                competencyId: eligible.competency.id,
              });
              notifySuccess(
                "msg.plan.item.addFromGap.success",
                { competencia: eligible.competency.name },
                plan,
              );
            } catch (error) {
              toast.error(error instanceof ApiError ? error.message : t("mentor.toPdi.error"));
            } finally {
              setSendingSessionId(null);
            }
          }}
        >
          {sendingSessionId === session.id
            ? t("mentor.toPdi.sending")
            : t("mentor.toPdi.action", { competencia: eligible.competency.name })}
        </Button>
      )}
      {session.competencyIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {session.competencyIds.map((c) => (
            <span key={c} className="rounded-md bg-secondary px-2 py-0.5">
              {selectors.competencyById(c)?.name ?? c}
            </span>
          ))}
        </div>
      )}
      {(session.mentorUserId === user.id || user.role === "admin") && (
        <FollowUpScheduler session={session} />
      )}
      {session.nextSession && session.mentorUserId !== user.id && user.role !== "admin" && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("mentor.followUp.scheduled", {
            data: defaultDateFormatter.formatDate(session.nextSession, locale) ?? "",
          })}
        </p>
      )}
    </li>
  );
}

export function MentoringTimeline({ sessions }: { sessions: MentoringSession[] }) {
  const { t } = useI18n();
  const selectors = useSelectors();
  return (
    <>
      {sessions.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("mentor.timeline.empty")}</p>
      )}
      <ol className="relative space-y-6 border-l border-border pl-6">
        {sessions.map((s) => (
          <MentoringTimelineItem key={s.id} session={s} selectors={selectors} />
        ))}
      </ol>
    </>
  );
}

export function NewMentoringSessionDialog({ menteeOptions }: { menteeOptions: Architect[] }) {
  const { t } = useI18n();
  const store = useStore();
  const user = useCurrentUser();
  const sel = useSelectors();
  const f = useMentoringSessionForm(menteeOptions);

  const [competencyFilter, setCompetencyFilter] = useState("");
  const [proficiencyFilter, setProficiencyFilter] = useState("");
  const activeCompetencies = store.competencies.filter((c) => c.active);
  const discussedList = activeCompetencies.filter((c) =>
    defaultNameFormatter.matchesSearch(c.name, competencyFilter.trim().toLowerCase()),
  );
  const proficiencyList = activeCompetencies.filter((c) =>
    defaultNameFormatter.matchesSearch(c.name, proficiencyFilter.trim().toLowerCase()),
  );

  return (
    <Dialog open={f.open} onOpenChange={f.setOpen}>
      <DialogTrigger asChild>
        <Button>{t("mentor.new")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("mentor.form.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="mentee">{t("mentor.form.mentee")}</Label>
              <div className="mt-1">
                <ArchitectSelectCombobox
                  id="mentee"
                  architects={menteeOptions}
                  selectedId={f.form.menteeId}
                  onChange={(id) => f.setField("menteeId", id)}
                  label={t("mentor.form.mentee")}
                  invalid={f.isMissing("menteeId")}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="date">{t("mentor.form.date")}</Label>
              <Input
                id="date"
                type="date"
                max={defaultDateFormatter.todayIso()}
                aria-invalid={f.isMissing("date")}
                className={f.invalid("date")}
                value={f.form.date}
                onChange={(e) => f.setField("date", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void f.submit()}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="duration">{t("mentor.form.duration")}</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                step={1}
                aria-invalid={f.isMissing("durationMin") || f.durationInvalid}
                className={
                  f.invalid("durationMin") ||
                  (f.durationInvalid ? "border-destructive ring-1 ring-destructive" : "")
                }
                value={f.form.durationMin}
                onChange={(e) => f.setField("durationMin", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void f.submit()}
              />
            </div>
            <div>
              <Label htmlFor="next-session">{t("mentor.form.nextSession")}</Label>
              <Input
                id="next-session"
                type="date"
                value={f.form.nextSession}
                onChange={(e) => f.setField("nextSession", e.target.value)}
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="topic" hint={t("mentor.form.topicHint")}>
              {t("mentor.form.topic")}
            </FieldLabel>
            <Input
              id="topic"
              aria-invalid={f.isMissing("topic")}
              className={f.invalid("topic")}
              value={f.form.topic}
              onChange={(e) => f.setField("topic", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void f.submit()}
            />
          </div>
          <div>
            <FieldLabel htmlFor="notes" hint={t("mentor.form.notesHint")}>
              {t("mentor.form.notes")}
            </FieldLabel>
            <Textarea
              id="notes"
              aria-invalid={f.isMissing("notes")}
              className={f.invalid("notes")}
              value={f.form.notes}
              onChange={(e) => f.setField("notes", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="decisions" hint={t("mentor.form.decisionsHint")}>
              {t("mentor.form.decisions")}
            </FieldLabel>
            <Textarea
              id="decisions"
              aria-invalid={f.isMissing("decisions")}
              className={f.invalid("decisions")}
              value={f.form.decisions}
              onChange={(e) => f.setField("decisions", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="actions" hint={t("mentor.form.actionsHint")}>
              {t("mentor.form.actions")}
            </FieldLabel>
            <Textarea
              id="actions"
              aria-invalid={f.isMissing("actions")}
              className={f.invalid("actions")}
              value={f.form.actions}
              onChange={(e) => f.setField("actions", e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <FieldLabel htmlFor="mentor-competencies" hint={t("mentor.form.competenciesHint")}>
              {t("mentor.form.competencies")}
            </FieldLabel>
            {activeCompetencies.length > 20 && (
              <Input
                aria-label={t("common.searchCompetency")}
                placeholder={t("common.searchCompetency")}
                value={competencyFilter}
                onChange={(e) => setCompetencyFilter(e.target.value)}
                className="mt-1"
              />
            )}
            <div
              id="mentor-competencies"
              className="mt-1 max-h-40 overflow-y-auto overflow-x-hidden surface-inset p-2"
            >
              {discussedList.map((c) => (
                <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm">
                  <input
                    type="checkbox"
                    checked={f.competencyIds.includes(c.id)}
                    onChange={() => f.toggleCompetency(c.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                </label>
              ))}
              {discussedList.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("common.noCompetencyFound")}</p>
              )}
            </div>
          </div>
          {defaultUiAuthorizationPolicy.isAssignedTechLeadOf(
            user,
            sel.architectById(f.form.menteeId),
          ) && (
            <div className="min-w-0">
              <FieldLabel htmlFor="mentor-proficiency" hint={t("mentor.form.proficiencyHint")}>
                {t("mentor.form.proficiency")}
              </FieldLabel>
              {activeCompetencies.length > 20 && (
                <Input
                  aria-label={t("common.searchCompetency")}
                  placeholder={t("common.searchCompetency")}
                  value={proficiencyFilter}
                  onChange={(e) => setProficiencyFilter(e.target.value)}
                  className="mt-1"
                />
              )}
              <div
                id="mentor-proficiency"
                className="mt-1 max-h-48 overflow-y-auto overflow-x-hidden surface-inset p-2"
              >
                {proficiencyList.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("common.noCompetencyFound")}</p>
                )}
                {proficiencyList.map((c) => {
                  const update = f.proficiencyUpdates.find((u) => u.competencyId === c.id);
                  return (
                    <div key={c.id} className="py-1">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!update}
                          onChange={() => f.toggleProficiencyUpdate(c.id)}
                        />
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      </label>
                      {update && (
                        <div className="ml-6 mt-1">
                          <div className="flex items-center gap-2">
                            <select
                              className={`rounded-md border bg-card px-2 py-1 text-xs ${
                                f.proficiencyMissingLevel && update.observedLevel === null
                                  ? "border-destructive ring-1 ring-destructive"
                                  : "border-input"
                              }`}
                              value={update.observedLevel ?? ""}
                              aria-invalid={
                                f.proficiencyMissingLevel && update.observedLevel === null
                              }
                              onChange={(e) => f.setProficiencyLevel(c.id, Number(e.target.value))}
                              aria-label={t("mentor.form.proficiencyLevel", { nome: c.name })}
                            >
                              <option value="" disabled>
                                {t("mentor.form.proficiencySelectLevel")}
                              </option>
                              {[1, 2, 3, 4, 5].map((level) => (
                                <option key={level} value={level}>
                                  L{level}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder={t("mentor.form.proficiencyNote")}
                              className="flex-1 rounded-md border border-input bg-card px-2 py-1 text-xs"
                              value={update.note ?? ""}
                              onChange={(e) => f.setProficiencyNote(c.id, e.target.value)}
                            />
                          </div>
                          {f.proficiencyMissingLevel && update.observedLevel === null && (
                            <p className="mt-1 text-xs text-destructive">
                              {t("mentor.form.proficiencyLevelRequired")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {f.showToast && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="flex-1 text-sm">{t("mentor.required")}</p>
            <button
              type="button"
              onClick={() => f.setShowToast(false)}
              aria-label={t("mentor.closeWarning")}
              className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <DialogFooter>
          <Button disabled={f.saving} onClick={() => void f.submit()}>
            {f.saving ? t("mentor.followUp.saving") : t("mentor.form.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
