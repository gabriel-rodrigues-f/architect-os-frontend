import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, X } from "lucide-react";
import { useState } from "react";

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
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useSelectors, useStore } from "@/lib/store";
import { formatDate, todayIso } from "@/lib/text";

export const Route = createFileRoute("/mentoring")({
  head: () => ({
    meta: [
      { title: "Mentoria — Architect OS" },
      {
        name: "description",
        content: "Registro e timeline das sessões de mentoria técnica entre arquitetos.",
      },
      { property: "og:title", content: "Mentoria — Architect OS" },
      {
        property: "og:description",
        content: "Temas, decisões, ações e próximos passos de cada sessão de mentoria.",
      },
    ],
  }),
  component: MentoringPage,
});

/** Campos que o usuário preenche e que não podem ficar vazios. */
const REQUIRED_FIELDS = ["menteeId", "date", "topic", "notes", "decisions", "actions"] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];

function MentoringPage() {
  const store = useStore();
  const { t, locale } = useI18n();
  // O mentor é quem está registrando a sessão, não um nome fixo no código.
  const user = useCurrentUser();
  const sel = useSelectors();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    menteeId: store.architects[0]?.id ?? "",
    date: todayIso(),
    durationMin: "60",
    topic: "",
    notes: "",
    decisions: "",
    actions: "",
  });

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

  const submit = () => {
    const vazios = REQUIRED_FIELDS.filter((f) => !form[f].trim());
    if (vazios.length > 0) {
      setMissing(vazios);
      setShowToast(true);
      return;
    }

    store.addMentoringSession({
      id: `m-${Date.now()}`,
      mentor: user.name,
      menteeId: form.menteeId,
      date: form.date,
      durationMin: Number(form.durationMin) || 60,
      topic: form.topic,
      competencyIds: [],
      notes: form.notes,
      decisions: form.decisions,
      actions: form.actions,
    });
    setForm({ ...form, topic: "", notes: "", decisions: "", actions: "" });
    setMissing([]);
    setShowToast(false);
    setOpen(false);
  };

  const [filter, setFilter] = useState<string[]>([]);

  // Filtro vazio = todo o time; caso contrário, só as sessões dos selecionados.
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
                        {store.architects.map((a) => (
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
                  <Button onClick={submit}>{t("mentor.form.save")}</Button>
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
            ? t("mentor.timeline.all", { n: sessions.length })
            : t("mentor.timeline.filtered", { n: sessions.length, p: filter.length })
        }
      >
        {sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("mentor.timeline.empty")}</p>
        )}
        <ol className="relative space-y-6 border-l border-border pl-6">
          {sessions.map((s) => (
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
              {s.competencyIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {s.competencyIds.map((c) => (
                    <span key={c} className="rounded-md bg-secondary px-2 py-0.5">
                      {sel.competencyById(c)?.name ?? c}
                    </span>
                  ))}
                </div>
              )}
              {s.nextSession && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Próxima sessão: {formatDate(s.nextSession, locale)}
                </p>
              )}
            </li>
          ))}
        </ol>
      </SectionCard>
    </>
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
