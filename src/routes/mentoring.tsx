import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ArchitectFilter, applyArchitectFilter } from "@/components/app/ArchitectFilter";
import { Initials, PageHeader, SectionCard } from "@/components/app/ui-bits";
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
import { useSelectors, useStore } from "@/lib/store";

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

function MentoringPage() {
  const store = useStore();
  const sel = useSelectors();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    mentor: "Gabriel Rodrigues",
    menteeId: store.architects[0]?.id ?? "",
    date: "2026-08-11",
    durationMin: "60",
    topic: "",
    notes: "",
    decisions: "",
    actions: "",
  });

  const [filter, setFilter] = useState<string[]>([]);

  // Filtro vazio = todo o time; caso contrário, só as sessões dos selecionados.
  const filteredIds = new Set(applyArchitectFilter(store.architects, filter).map((a) => a.id));
  const sessions = [...store.mentoringSessions]
    .filter((s) => filteredIds.has(s.menteeId))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <>
      <PageHeader
        title="Mentoria"
        description="Mentoria é parte central do modelo de desenvolvimento técnico do time."
        actions={
          <div className="flex items-center gap-2">
            <ArchitectFilter architects={store.architects} selected={filter} onChange={setFilter} />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Registrar sessão</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova sessão de mentoria</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="mentee">Mentorado</Label>
                      <select
                        id="mentee"
                        className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                        value={form.menteeId}
                        onChange={(e) => setForm({ ...form, menteeId: e.target.value })}
                      >
                        {store.architects.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="date">Data</Label>
                      <Input
                        id="date"
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="topic">Tema</Label>
                    <Input
                      id="topic"
                      value={form.topic}
                      onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notas</Label>
                    <Textarea
                      id="notes"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="decisions">Decisões</Label>
                    <Textarea
                      id="decisions"
                      value={form.decisions}
                      onChange={(e) => setForm({ ...form, decisions: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="actions">Ações</Label>
                    <Textarea
                      id="actions"
                      value={form.actions}
                      onChange={(e) => setForm({ ...form, actions: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      if (!form.topic.trim()) return;
                      store.addMentoringSession({
                        id: `m-${Date.now()}`,
                        mentor: form.mentor,
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
                      setOpen(false);
                    }}
                  >
                    Salvar sessão
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <SectionCard
        title="Linha do Tempo"
        description={
          filter.length === 0
            ? `${sessions.length} sessões registradas`
            : `${sessions.length} sessões de ${filter.length} arquiteto(s) filtrado(s)`
        }
      >
        {sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma sessão registrada para o filtro atual.
          </p>
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
                    {sel.architectById(s.menteeId)?.name} · mentor {s.mentor} · {s.date} ·{" "}
                    {s.durationMin} min
                  </p>
                </div>
              </div>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                <Block title="Notas" text={s.notes} />
                <Block title="Decisões" text={s.decisions} />
                <Block title="Ações" text={s.actions} />
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
                  Próxima sessão: {s.nextSession}
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
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm">{text || "—"}</p>
    </div>
  );
}
