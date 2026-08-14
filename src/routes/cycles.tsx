import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { EvolutionLine } from "@/components/app/charts";
import { LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DevelopmentCycle } from "@/lib/domain";
import { useLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { useSelectors, useStore } from "@/lib/store";
import { formatDate, slug } from "@/lib/text";

export const Route = createFileRoute("/cycles")({
  head: () => ({
    meta: [
      { title: "Ciclos de Desenvolvimento — Architect OS" },
      {
        name: "description",
        content:
          "Ciclos semestrais de desenvolvimento com avaliação, PDI, metas, trilhas e evidências.",
      },
      { property: "og:title", content: "Ciclos de Desenvolvimento — Architect OS" },
      {
        property: "og:description",
        content: "Compare a evolução de competências entre ciclos de desenvolvimento.",
      },
    ],
  }),
  component: CyclesPage,
});

function CyclesPage() {
  const store = useStore();
  const sel = useSelectors();
  const labels = useLabels();
  const [architectId, setArchitectId] = useState(store.architects[0]?.id ?? "");
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<DevelopmentCycle | null>(null);

  const closedCycles = store.cycles.filter((c) => c.status !== "Planned");
  const chartData = closedCycles.map((c) => {
    const row: Record<string, string | number> = { cycle: c.name };
    for (const d of sel.domainAverages(architectId, c.id)) row[d.category.short] = d.avg;
    return row;
  });
  /* A cor de cada série é decisão da paleta do sistema; aqui só se diz o que plotar. */
  const series = store.categories.map((c) => ({ key: c.short, label: c.name }));

  const compare = store.competencies.slice(0, 12).map((c) => {
    const levels = closedCycles.map((cy) => ({
      cycle: cy.name,
      level:
        sel.assessmentFor(architectId, cy.id)?.items.find((i) => i.competencyId === c.id)?.final ??
        0,
    }));
    return { competency: c, levels };
  });

  return (
    <>
      <PageHeader
        title={t("cycle.title")}
        description="Cada ciclo agrupa avaliação, SWOT, PDI, metas SMART, OKRs, trilhas, mentorias e evidências."
        actions={
          <div className="flex gap-2">
            <select
              className="rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={architectId}
              onChange={(e) => setArchitectId(e.target.value)}
              aria-label={t("cycle.architect")}
            >
              {store.architects.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <Button onClick={() => setEditing(emptyCycle())}>{t("cycle.new")}</Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {store.cycles.map((c) => (
          <div key={c.id} className="surface-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-base font-semibold">{c.name}</p>
              <div className="flex items-center gap-1">
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                  {labels.cycleStatus[c.status]}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  aria-label={`Editar ${c.name}`}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => store.removeCycle(c.id)}
                  aria-label={`Excluir ${c.name}`}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(c.start, locale)} → {formatDate(c.end, locale)}
            </p>
          </div>
        ))}
        {store.cycles.length === 0 && (
          <div className="surface-card p-6 text-center sm:col-span-3">
            <p className="text-sm font-medium">{t("cycle.empty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              O ciclo delimita o período de avaliação, PDI e metas.
            </p>
            <Button className="mt-4" onClick={() => setEditing(emptyCycle())}>
              Novo ciclo
            </Button>
          </div>
        )}
      </div>

      {editing && <CycleDialog cycle={editing} onClose={() => setEditing(null)} />}

      <SectionCard title={t("cycle.evolution.title")} description={t("cycle.evolution.subtitle")}>
        <EvolutionLine data={chartData} series={series} />
      </SectionCard>

      <SectionCard
        className="mt-6"
        title="Comparação de competências"
        description="Nível final por ciclo."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2">Competência</th>
                {closedCycles.map((c) => (
                  <th key={c.id} className="py-2 text-center">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compare.map((row) => (
                <tr key={row.competency.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 font-medium">{row.competency.name}</td>
                  {row.levels.map((l) => (
                    <td key={l.cycle} className="py-2 text-center">
                      <LevelBadge level={l.level} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

const emptyCycle = (): DevelopmentCycle => {
  const year = new Date().getFullYear();
  return {
    id: "",
    name: `${year} H1`,
    start: `${year}-01-01`,
    end: `${year}-06-30`,
    status: "Planned",
  };
};

/** Criação e edição de ciclo. `cycle.id` vazio indica criação. */
function CycleDialog({ cycle, onClose }: { cycle: DevelopmentCycle; onClose: () => void }) {
  const store = useStore();
  const [form, setForm] = useState(cycle);
  const isNew = cycle.id === "";

  const save = () => {
    if (!form.name.trim()) return;
    if (isNew) {
      store.addCycle({ ...form, id: slug(form.name) });
    } else {
      const { id: _id, ...changes } = form;
      store.updateCycle(cycle.id, changes);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo ciclo" : `Editar ${cycle.name}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cycle-name">Nome</Label>
            <Input
              id="cycle-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cycle-start">Início</Label>
              <Input
                id="cycle-start"
                type="date"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cycle-end">Fim</Label>
              <Input
                id="cycle-end"
                type="date"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="cycle-status">Situação</Label>
            <select
              id="cycle-status"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as DevelopmentCycle["status"] })
              }
            >
              <option value="Planned">Planejado</option>
              <option value="Active">Ativo</option>
              <option value="Closed">Encerrado</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
