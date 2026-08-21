import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ArchitectFilter, applyArchitectFilter } from "@/components/app/ArchitectFilter";
import { FieldLabel, Initials, PageHeader, SectionCard } from "@/components/app/ui-bits";
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
import { authErrorMessage, useCurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import type { MentoringSession } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { canActFor } from "@/lib/scope";
import { useSelectors, useStore } from "@/lib/store";
import { formatDate, todayIso } from "@/lib/text";

export const Route = createFileRoute("/mentoring")({
  head: () => ({
    meta: [
      { title: "Mentoria — Synapse" },
      {
        name: "description",
        content: "Registro e timeline das sessões de mentoria técnica entre arquitetos.",
      },
      { property: "og:title", content: "Mentoria — Synapse" },
      {
        property: "og:description",
        content: "Temas, decisões, ações e próximos passos de cada sessão de mentoria.",
      },
    ],
  }),
  component: MentoringPage,
});

/** Campos que o usuário preenche e que não podem ficar vazios. */
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

function MentoringPage() {
  const store = useStore();
  const { t, locale } = useI18n();
  // O mentor é quem está registrando a sessão, não um nome fixo no código.
  const user = useCurrentUser();
  const sel = useSelectors();
  /**
   * MENT-001 (AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md) — o
   * backend (`canActFor`, `POST /api/mentoring-sessions`) só aceita a
   * própria pessoa mentorada, o Tech Lead dela, ou admin como autor da
   * sessão; a lista de mentorados nasce restrita ao mesmo escopo, em vez de
   * oferecer qualquer pessoa do roster e devolver 403 só depois de
   * preencher o formulário inteiro.
   */
  const menteeOptions = sel.activeArchitects.filter((a) => canActFor(user, a));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    menteeId: menteeOptions[0]?.id ?? "",
    date: todayIso(),
    durationMin: "",
    topic: "",
    notes: "",
    decisions: "",
    actions: "",
    nextSession: "",
  });
  const [competencyIds, setCompetencyIds] = useState<string[]>([]);
  /** Sessão cujo "Enviar ao PDI" está em voo — evita duplo clique e mostra o estado de carregamento certo. */
  const [sendingSessionId, setSendingSessionId] = useState<string | null>(null);
  const toggleCompetency = (id: string) =>
    setCompetencyIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  /** Campos vazios apontados no último Salvar; some assim que o campo é preenchido. */
  const [missing, setMissing] = useState<RequiredField[]>([]);
  const [showToast, setShowToast] = useState(false);

  /** Escrever num campo destacado limpa o destaque na hora. */
  const setField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMissing((prev) => prev.filter((f) => f !== field));
  };

  const isMissing = (field: RequiredField) => missing.includes(field);

  /** Borda vermelha nos campos que o usuário precisa revisar. */
  const invalid = (field: RequiredField) =>
    isMissing(field) ? "border-destructive ring-1 ring-destructive" : "";

  /** Duração precisa ser um número real de minutos — nunca um padrão escondendo entrada inválida. */
  const durationValue = Number(form.durationMin);
  const durationInvalid =
    form.durationMin.trim().length > 0 && (!Number.isInteger(durationValue) || durationValue <= 0);
  const [saving, setSaving] = useState(false);

  /**
   * Sem id local nem sucesso otimista: o servidor gera o id de verdade e é
   * quem decide se o registro vale — só fecha o diálogo depois da resposta.
   * Ver AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, IDOR-002/EVD-001.
   */
  const submit = async () => {
    const vazios = REQUIRED_FIELDS.filter((f) => !form[f].trim());
    if (vazios.length > 0 || durationInvalid) {
      setMissing(
        durationInvalid && !vazios.includes("durationMin") ? [...vazios, "durationMin"] : vazios,
      );
      setShowToast(true);
      return;
    }

    setSaving(true);
    try {
      await store.addMentoringSession({
        id: "",
        mentor: user.name,
        menteeId: form.menteeId,
        date: form.date,
        durationMin: durationValue,
        topic: form.topic,
        competencyIds,
        notes: form.notes,
        decisions: form.decisions,
        actions: form.actions,
        ...(form.nextSession ? { nextSession: form.nextSession } : {}),
      });
      toast.success(
        t("mentor.create.toast", { nome: sel.architectById(form.menteeId)?.name ?? "" }),
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
      setMissing([]);
      setShowToast(false);
      setOpen(false);
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  // `ArchitectFilter` trata `selected` como sempre explícito — nasce com todo mundo marcado.
  const [filter, setFilter] = useState<string[]>(() => store.architects.map((a) => a.id));

  const filteredIds = new Set(applyArchitectFilter(store.architects, filter).map((a) => a.id));
  const sessions = [...store.mentoringSessions]
    .filter((s) => filteredIds.has(s.menteeId))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <PageHeader
        title={t("mentor.title")}
        description={t("mentor.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <ArchitectFilter architects={store.architects} selected={filter} onChange={setFilter} />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>{t("mentor.new")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("mentor.form.title")}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="mentee">{t("mentor.form.mentee")}</Label>
                      <select
                        id="mentee"
                        aria-invalid={isMissing("menteeId")}
                        className={`mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ${invalid("menteeId")}`}
                        value={form.menteeId}
                        onChange={(e) => setField("menteeId", e.target.value)}
                      >
                        {menteeOptions.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="date">{t("mentor.form.date")}</Label>
                      <Input
                        id="date"
                        type="date"
                        aria-invalid={isMissing("date")}
                        className={invalid("date")}
                        value={form.date}
                        onChange={(e) => setField("date", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submit()}
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
                        aria-invalid={isMissing("durationMin") || durationInvalid}
                        className={
                          invalid("durationMin") ||
                          (durationInvalid ? "border-destructive ring-1 ring-destructive" : "")
                        }
                        value={form.durationMin}
                        onChange={(e) => setField("durationMin", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submit()}
                      />
                    </div>
                    <div>
                      <Label htmlFor="next-session">{t("mentor.form.nextSession")}</Label>
                      <Input
                        id="next-session"
                        type="date"
                        value={form.nextSession}
                        onChange={(e) => setField("nextSession", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel htmlFor="topic" hint={t("mentor.form.topicHint")}>
                      {t("mentor.form.topic")}
                    </FieldLabel>
                    <Input
                      id="topic"
                      aria-invalid={isMissing("topic")}
                      className={invalid("topic")}
                      value={form.topic}
                      onChange={(e) => setField("topic", e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submit()}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="notes" hint={t("mentor.form.notesHint")}>
                      {t("mentor.form.notes")}
                    </FieldLabel>
                    <Textarea
                      id="notes"
                      aria-invalid={isMissing("notes")}
                      className={invalid("notes")}
                      value={form.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="decisions" hint={t("mentor.form.decisionsHint")}>
                      {t("mentor.form.decisions")}
                    </FieldLabel>
                    <Textarea
                      id="decisions"
                      aria-invalid={isMissing("decisions")}
                      className={invalid("decisions")}
                      value={form.decisions}
                      onChange={(e) => setField("decisions", e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="actions" hint={t("mentor.form.actionsHint")}>
                      {t("mentor.form.actions")}
                    </FieldLabel>
                    <Textarea
                      id="actions"
                      aria-invalid={isMissing("actions")}
                      className={invalid("actions")}
                      value={form.actions}
                      onChange={(e) => setField("actions", e.target.value)}
                    />
                  </div>
                  <div>
                    <FieldLabel
                      htmlFor="mentor-competencies"
                      hint={t("mentor.form.competenciesHint")}
                    >
                      {t("mentor.form.competencies")}
                    </FieldLabel>
                    <div
                      id="mentor-competencies"
                      className="mt-1 max-h-40 overflow-y-auto surface-inset p-2"
                    >
                      {store.competencies.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm">
                          <input
                            type="checkbox"
                            checked={competencyIds.includes(c.id)}
                            onChange={() => toggleCompetency(c.id)}
                          />
                          <span className="truncate">{c.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                {showToast && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <p className="flex-1 text-sm">{t("mentor.required")}</p>
                    <button
                      type="button"
                      onClick={() => setShowToast(false)}
                      aria-label={t("mentor.closeWarning")}
                      className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <DialogFooter>
                  <Button disabled={saving} onClick={() => void submit()}>
                    {saving ? t("mentor.followUp.saving") : t("mentor.form.save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <SectionCard
        title={t("mentor.timeline.title")}
        description={
          filter.length === 0
            ? t("mentor.timeline.none")
            : filter.length === store.architects.length
              ? t("mentor.timeline.all", { n: sessions.length })
              : t("mentor.timeline.filtered", { n: sessions.length, p: filter.length })
        }
      >
        {sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("mentor.timeline.empty")}</p>
        )}
        <ol className="relative space-y-6 border-l border-border pl-6">
          {sessions.map((s) => {
            /**
             * Fecha o loop da mentoria: "ações" era texto morto — ninguém
             * virava PDI de verdade. Só oferece o botão quando dá para criar
             * o item sem inventar nível: precisa de uma competência da
             * sessão com gap já avaliado, e de a pessoa ainda não ter
             * aquele item no plano. Ver AUDITORIA-TERCEIRA-RODADA-
             * RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC J.
             *
             * ORIENTACAO-NONA-RODADA, Seção 12/17.1 (ENT-09-006) —
             * `progressionGapsFor`, nunca `gapsFor` bruta: um gap de
             * Maestria (Nível III) não tem assessment oficial do qual
             * `/from-gap` possa derivar nível/prioridade — o servidor
             * rejeitaria mesmo assim, mas o botão nem deve aparecer.
             */
            const plan = sel.planFor(s.menteeId);
            const gaps = sel.progressionGapsFor(s.menteeId);
            const eligible = s.competencyIds
              .map((cid) => gaps.find((g) => g.item.competencyId === cid))
              .find((g) => g && !plan?.items.some((i) => i.competencyId === g.item.competencyId));

            return (
              <li key={s.id} className="relative">
                <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="flex flex-wrap items-center gap-2">
                  <Initials name={sel.architectById(s.menteeId)?.name ?? "?"} />
                  <div>
                    <p className="text-sm font-medium">{s.topic}</p>
                    <p className="text-xs text-muted-foreground">
                      {sel.architectById(s.menteeId)?.name} · mentor {s.mentor} ·{" "}
                      {formatDate(s.date, locale)} · {s.durationMin} min
                    </p>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                  <Block title={t("mentor.block.notes")} text={s.notes} />
                  <Block title={t("mentor.block.decisions")} text={s.decisions} />
                  <Block title={t("mentor.block.actions")} text={s.actions} />
                </div>
                {s.actions.trim() && eligible?.competency && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    disabled={sendingSessionId === s.id}
                    onClick={async () => {
                      const mentee = sel.architectById(s.menteeId);
                      if (!mentee || !eligible.competency) return;
                      setSendingSessionId(s.id);
                      try {
                        /**
                         * ORIENTACAO-NONA-RODADA, Seção 4/12 (ENT-09-001/006)
                         * — único caminho para criar item de PDI a partir de
                         * um GAP oficial: currentLevel/targetLevel/priority
                         * nunca são calculados aqui, o servidor deriva os
                         * três a partir do assessment referenciado por
                         * `eligible.assessmentId`.
                         */
                        await store.createPlanItemFromGap(s.menteeId, {
                          id: `pdi-${s.menteeId}-${eligible.competency.id}-${Date.now()}`,
                          assessmentId: eligible.assessmentId,
                          competencyId: eligible.competency.id,
                          objective: s.topic,
                          actionType: "Mentor",
                          actionPlan: s.actions,
                          startDate: todayIso(),
                          targetDate: s.nextSession ?? todayIso(),
                          owner: mentee.name,
                        });
                        toast.success(
                          t("mentor.toPdi.toast", { competencia: eligible.competency.name }),
                        );
                      } catch (error) {
                        toast.error(
                          error instanceof ApiError ? error.message : t("mentor.toPdi.error"),
                        );
                      } finally {
                        setSendingSessionId(null);
                      }
                    }}
                  >
                    {sendingSessionId === s.id
                      ? t("mentor.toPdi.sending")
                      : t("mentor.toPdi.action", { competencia: eligible.competency.name })}
                  </Button>
                )}
                {s.competencyIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {s.competencyIds.map((c) => (
                      <span key={c} className="rounded-md bg-secondary px-2 py-0.5">
                        {sel.competencyById(c)?.name ?? c}
                      </span>
                    ))}
                  </div>
                )}
                {(s.mentorUserId === user.id || user.role === "admin") && (
                  <FollowUpScheduler session={s} />
                )}
                {s.nextSession && s.mentorUserId !== user.id && user.role !== "admin" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("mentor.followUp.scheduled", {
                      data: formatDate(s.nextSession, locale) ?? "",
                    })}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </SectionCard>
    </>
  );
}

/**
 * Agendar follow-up depois que a sessão já aconteceu — antes só dava para
 * definir `nextSession` no instante da criação, sem como voltar numa sessão
 * antiga. Só quem registrou a sessão (ou admin) vê a ação. Ver AUDITORIA-
 * QUARTA-REVISAO-ESTADO-ATUAL-SYNAPSE.md, EPIC 5.
 */
function FollowUpScheduler({ session }: { session: MentoringSession }) {
  const { t, locale } = useI18n();
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(session.nextSession ?? "");
  const [saving, setSaving] = useState(false);

  const save = () => {
    setSaving(true);
    store
      .scheduleMentoringFollowUp(session.id, value || null)
      .then(() => {
        toast.success(t("mentor.followUp.toast"));
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
                data: formatDate(session.nextSession, locale) ?? "",
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
