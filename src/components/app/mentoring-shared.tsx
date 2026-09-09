import { AlertCircle, X } from "lucide-react";
import { useMemo, useState } from "react";

import { PageAction } from "@/components/app/PageAction";
import { PersonCombobox } from "@/components/app/PersonCombobox";
import { FieldLabel, Initials, SectionHeading } from "@/components/app/ui-bits";
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
import { useSearchParamString, useSuccessToast, useToastSubmit } from "@/hooks";
import { useCurrentUser } from "@/lib/auth";

import type { Professional, MentoringSession } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { PersonPicker } from "@/lib/person-selection";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import type { Selectors } from "@/lib/selectors";
import { useSelectors, useStore } from "@/lib/store";
import { defaultDateFormatter, defaultNameFormatter } from "@/lib/text";
import { MentoringViewModel } from "@/lib/view-models";

const REQUIRED_FIELDS = ["menteeId", "date", "durationMin", "topic", "notes"] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];

/**
 * `onRegistered` recebe quem acabou de ganhar a sessão: sem isso a linha do
 * tempo fica na pessoa que o filtro escolheu por padrão (a primeira em ordem
 * alfabética) e o registro recém-criado não aparece na tela de quem o criou.
 */
function useMentoringSessionForm(
  menteeOptions: Professional[],
  onRegistered?: (menteeId: string) => void,
) {
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
  });

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

  const close = () => {
    setMissing([]);
    setShowToast(false);
    setOpen(false);
  };

  const submit = async () => {
    const vazios = REQUIRED_FIELDS.filter((f) => !form[f].trim());
    if (vazios.length > 0 || durationInvalid) {
      setMissing(
        durationInvalid && !vazios.includes("durationMin") ? [...vazios, "durationMin"] : vazios,
      );
      setShowToast(true);
      return;
    }

    const result = await run(() => viewModel.createSession(user.name, form, durationValue));
    if (!result.ok) return;
    notifySuccess(
      "msg.mentoring.create.success",
      { nome: sel.professionalById(form.menteeId)?.name ?? "" },
      result.value,
    );
    setForm({
      ...form,
      durationMin: "",
      topic: "",
      notes: "",
    });
    close();
    onRegistered?.(form.menteeId);
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
    close,
    submit,
  };
}

export function useMentoringTimeline() {
  const store = useStore();
  const user = useCurrentUser();
  const viewModel = useMemo(() => new MentoringViewModel(store), [store]);
  const orderedProfessionals = [...store.professionals].sort(defaultNameFormatter.byName);
  // O profissional não escolhe pessoa (dono, 2026-09-06): a linha do tempo é a dele.
  const defaultMenteeId = defaultUiAuthorizationPolicy.picksPeople(user)
    ? (orderedProfessionals[0]?.id ?? "")
    : (user.professionalId ?? "");
  /**
   * O aviso de "mentoria registrada" chega com a PESSOA no endereço
   * (`/mentoring?menteeId=…`, dono 2026-09-08): quem clica no aviso de Bruno
   * abre a linha do tempo de Bruno, não a da primeira pessoa da lista. Sem
   * parâmetro na URL, o padrão continua o mesmo de antes.
   */
  const [filter, setFilter] = useSearchParamString("menteeId", () => defaultMenteeId);

  const sessions = viewModel.newestFirst(
    store.mentoringSessions.filter((s) => s.menteeId === filter),
  );

  return { filter, setFilter, sessions };
}

export function MenteeFilterCombobox({
  professionals,
  selected,
  onChange,
}: {
  professionals: readonly Professional[];
  selected: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const user = useCurrentUser();
  return (
    <PersonCombobox
      picker={PersonPicker.oneFor(user, professionals, selected)}
      onChange={([id]) => onChange(id ?? "")}
      label={t("mentor.filter.label")}
      className="w-64"
    />
  );
}

/**
 * O FOLLOW-UP DA PESSOA, um só, no canto superior da caixa da Linha do Tempo
 * (dono, 2026-09-08, item 2): *"o follow-up não deve aparecer em cada linha,
 * porque a evolução é contínua"*. Ele pende da sessão mais recente — a que
 * marca a próxima conversa —, e quem não agenda apenas lê a data marcada.
 */
export function MentoringFollowUp({ sessions }: { sessions: readonly MentoringSession[] }) {
  const { t, locale } = useI18n();
  const notifySuccess = useSuccessToast();
  const store = useStore();
  const user = useCurrentUser();
  const viewModel = useMemo(() => new MentoringViewModel(store), [store]);
  const session = viewModel.followUpSessionOf(sessions);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const { submitting: saving, run } = useToastSubmit(t("mentor.followUp.error"));

  if (!session) return null;

  const scheduled = session.nextSession
    ? t("mentor.followUp.scheduled", {
        data: defaultDateFormatter.formatDate(session.nextSession, locale) ?? "",
      })
    : t("mentor.followUp.none");

  if (!defaultUiAuthorizationPolicy.schedulesMentoringFollowUpOf(user, session)) {
    return session.nextSession ? (
      <p className="text-xs text-muted-foreground">{scheduled}</p>
    ) : null;
  }

  const save = () => {
    void run(() => viewModel.scheduleFollowUp(session.id, value || null)).then((result) => {
      if (!result.ok) return;
      notifySuccess("msg.mentoring.scheduleFollowUp.success", undefined, result.value);
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">{scheduled}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          onClick={() => {
            setValue(session.nextSession ?? "");
            setEditing(true);
          }}
        >
          {t("mentor.followUp.action")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
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
      <SectionHeading as="p" muted>
        {title}
      </SectionHeading>
      <p className="mt-1 text-sm">{text}</p>
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
  const { submitting: sending, run } = useToastSubmit(t("mentor.toPdi.error"));

  const plan = selectors.planFor(session.menteeId);
  const gaps = selectors.progressionGapsFor(session.menteeId);
  const eligible = viewModel.eligibleGapForPlan(session, gaps, plan);
  const decisions = session.decisions?.trim() ?? "";
  const actions = session.actions?.trim() ?? "";

  return (
    <li className="relative">
      <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
      <div className="flex flex-wrap items-center gap-2">
        <Initials name={selectors.professionalById(session.menteeId)?.name ?? "?"} />
        <div>
          <p className="text-sm font-medium">{session.topic}</p>
          <p className="text-xs text-muted-foreground">
            {selectors.professionalById(session.menteeId)?.name} · mentor {session.mentor} ·{" "}
            {defaultDateFormatter.formatDayAndTime(session.date, locale)} · {session.durationMin}{" "}
            min
          </p>
        </div>
      </div>
      {/*
        Tema e Notas são o registro de hoje (dono, 2026-09-08, item 4); os dois
        blocos que saíram do formulário só aparecem na sessão que já os tem.

        Os chips de competência embaixo da sessão saíram em 2026-09-09, com o
        campo que os alimentava: *"ele anotou embaixo os temas que foram
        abordados. Não acho útil."*
      */}
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        <Block title={t("mentor.block.notes")} text={session.notes || "—"} />
        {decisions && <Block title={t("mentor.block.decisions")} text={decisions} />}
        {actions && <Block title={t("mentor.block.actions")} text={actions} />}
      </div>
      {actions && eligible?.competency && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={sending}
          onClick={() => {
            const mentee = selectors.professionalById(session.menteeId);
            const competency = eligible.competency;
            if (!mentee || !competency) return;
            void run(() =>
              viewModel.sendToPlan(session, mentee, {
                assessmentId: eligible.assessmentId,
                competencyId: competency.id,
              }),
            ).then((result) => {
              if (result.ok)
                notifySuccess(
                  "msg.plan.item.addFromGap.success",
                  { competencia: competency.name },
                  result.value,
                );
            });
          }}
        >
          {sending
            ? t("mentor.toPdi.sending")
            : t("mentor.toPdi.action", { competencia: eligible.competency.name })}
        </Button>
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

export function NewMentoringSessionDialog({
  menteeOptions,
  onRegistered,
}: {
  menteeOptions: Professional[];
  onRegistered?: (menteeId: string) => void;
}) {
  const { t } = useI18n();
  const sessionForm = useMentoringSessionForm(menteeOptions, onRegistered);

  return (
    <Dialog open={sessionForm.open} onOpenChange={sessionForm.setOpen}>
      <DialogTrigger asChild>
        <PageAction label={t("mentor.new")} />
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
                <PersonCombobox
                  id="mentee"
                  picker={PersonPicker.one(menteeOptions, sessionForm.form.menteeId)}
                  onChange={([id]) => sessionForm.setField("menteeId", id ?? "")}
                  label={t("mentor.form.mentee")}
                  invalid={sessionForm.isMissing("menteeId")}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="date">{t("mentor.form.date")}</Label>
              <Input
                id="date"
                type="date"
                max={defaultDateFormatter.todayIso()}
                aria-invalid={sessionForm.isMissing("date")}
                className={sessionForm.invalid("date")}
                value={sessionForm.form.date}
                onChange={(e) => sessionForm.setField("date", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void sessionForm.submit()}
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
                aria-invalid={sessionForm.isMissing("durationMin") || sessionForm.durationInvalid}
                className={
                  sessionForm.invalid("durationMin") ||
                  (sessionForm.durationInvalid ? "border-destructive ring-1 ring-destructive" : "")
                }
                value={sessionForm.form.durationMin}
                onChange={(e) => sessionForm.setField("durationMin", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void sessionForm.submit()}
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="topic" hint={t("mentor.form.topicHint")}>
              {t("mentor.form.topic")}
            </FieldLabel>
            <Input
              id="topic"
              aria-invalid={sessionForm.isMissing("topic")}
              className={sessionForm.invalid("topic")}
              value={sessionForm.form.topic}
              onChange={(e) => sessionForm.setField("topic", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void sessionForm.submit()}
            />
          </div>
          <div>
            <FieldLabel htmlFor="notes" hint={t("mentor.form.notesHint")}>
              {t("mentor.form.notes")}
            </FieldLabel>
            <Textarea
              id="notes"
              aria-invalid={sessionForm.isMissing("notes")}
              className={sessionForm.invalid("notes")}
              value={sessionForm.form.notes}
              onChange={(e) => sessionForm.setField("notes", e.target.value)}
            />
          </div>
        </div>
        {sessionForm.showToast && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="flex-1 text-sm">{t("mentor.required")}</p>
            <button
              type="button"
              onClick={() => sessionForm.setShowToast(false)}
              aria-label={t("mentor.closeWarning")}
              className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={sessionForm.close}>
            {t("common.cancel")}
          </Button>
          <Button disabled={sessionForm.saving} onClick={() => void sessionForm.submit()}>
            {sessionForm.saving ? t("mentor.followUp.saving") : t("mentor.form.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
