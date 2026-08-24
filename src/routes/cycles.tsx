import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { EvolutionLine } from "@/components/app/charts";
import { LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
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
import { useCurrentUser } from "@/lib/auth";
import { useLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useSelectors, useStore } from "@/lib/store";
import { formatDate } from "@/lib/text";

export const Route = createFileRoute("/cycles")({
  head: () => ({
    meta: [
      { title: "Ciclos de Desenvolvimento — Synapse" },
      {
        name: "description",
        content:
          "Ciclos semestrais de desenvolvimento com avaliação, PDI, metas, trilhas e evidências.",
      },
      { property: "og:title", content: "Ciclos de Desenvolvimento — Synapse" },
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
  /** Ciclo é decisão administrativa — muda o que o time inteiro está avaliando. */
  const isAdmin = useCurrentUser().role === "admin";
  const [architectId, setArchitectId] = useState(store.architects[0]?.id ?? "");
  const { t, locale } = useI18n();
  const help = usePageHelp("cycles");
  const [editing, setEditing] = useState<DevelopmentCycle | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DevelopmentCycle | null>(null);
  const [blockedDelete, setBlockedDelete] = useState<DevelopmentCycle | null>(null);

  /**
   * Ciclo com avaliação ou PDI vinculado não é deletável — o backend já
   * recusa com 409, mas checar aqui evita abrir "tem certeza?" para uma ação
   * que nunca teria efeito, e explica o motivo na hora. Ver AUDITORIA-RIGIDA-
   * SEGUNDA-REVISAO-SYNAPSE.md, Seção 23.
   */
  const cycleInUse = (cycleId: string) =>
    store.assessments.some((a) => a.cycleId === cycleId) ||
    store.plans.some((p) => p.cycleId === cycleId);

  const askDeleteCycle = (cycle: DevelopmentCycle) => {
    if (cycleInUse(cycle.id)) setBlockedDelete(cycle);
    else setConfirmDelete(cycle);
  };

  const closedCycles = store.cycles.filter((c) => c.status !== "Planned");
  const chartData = closedCycles.map((c) => {
    const row: Record<string, string | number> = { cycle: c.name };
    // Capacidade sem assessment oficial no ciclo não entra na linha — nada de
    // plotar um 0 fictício que pareceria uma queda real de nível.
    for (const d of sel.capabilityAverages(architectId, c.id)) {
      // R2-ESC-02 — chave por `id`, nunca por `short`: nada garantia (antes
      // desta rodada) que `short` fosse único, e duas capacidades com a
      // mesma sigla sobrescreveriam o valor uma da outra na mesma linha do
      // gráfico. `id` é sempre único; `short`/`name` seguem só como rótulo.
      if (d.avg !== undefined) row[d.capability.id] = d.avg;
    }
    return row;
  });
  /* A cor de cada série é decisão da paleta do sistema; aqui só se diz o que plotar. */
  const series = store.capabilities.map((c) => ({ key: c.id, label: c.name }));

  /**
   * Mesma fonte que o gráfico acima: só assessment `Completed` conta como
   * nível oficial do ciclo. Antes, o gráfico já usava `capabilityAverages()`
   * (oficial) e esta tabela lia de `assessmentFor()` (aceita Draft/In
   * Review) — a mesma pessoa podia aparecer "sem nível oficial" no gráfico
   * e com um L4 na tabela ao lado. Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-
   * SYNAPSE.md, Seção 20.
   */
  const compare = store.competencies.slice(0, 12).map((c) => {
    const levels = closedCycles.map((cy) => ({
      cycle: cy.name,
      level:
        sel.officialAssessmentFor(architectId, cy.id)?.items.find((i) => i.competencyId === c.id)
          ?.final ?? undefined,
    }));
    return { competency: c, levels };
  });

  return (
    <>
      <PageHeader
        title={t("cycle.title")}
        description="Cada ciclo agrupa avaliação e PDI. Trilhas, mentorias e evidências não têm ciclo — valem para a pessoa em qualquer período."
        help={help}
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
            {isAdmin && (
              <Button onClick={() => setEditing(emptyCycle(store.cycles))}>{t("cycle.new")}</Button>
            )}
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
                {isAdmin && c.status === "Planned" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => store.setActiveCycle(c.id)}
                  >
                    {t("cycle.activate")}
                  </Button>
                )}
                {isAdmin && c.status === "Active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => store.updateCycle(c.id, { status: "Closed" })}
                  >
                    {t("cycle.close")}
                  </Button>
                )}
                {isAdmin && (
                  <>
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
                      onClick={() => askDeleteCycle(c)}
                      aria-label={`Excluir ${c.name}`}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
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
            {isAdmin && (
              <Button className="mt-4" onClick={() => setEditing(emptyCycle(store.cycles))}>
                Novo ciclo
              </Button>
            )}
          </div>
        )}
      </div>

      {editing && <CycleDialog cycle={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Excluir ${confirmDelete?.name}?`}
        description="O ciclo não tem avaliação nem PDI vinculado — pode ser excluído sem perder histórico. Esta ação não pode ser desfeita."
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) store.removeCycle(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />

      <Dialog open={blockedDelete !== null} onOpenChange={(v) => !v && setBlockedDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Não é possível excluir {blockedDelete?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Este ciclo tem avaliação ou PDI vinculado — excluí-lo destruiria esse histórico. Ciclos
            usados só podem ser encerrados (situação "Encerrado"), não excluídos.
          </p>
          <DialogFooter>
            <Button onClick={() => setBlockedDelete(null)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <th scope="col" className="py-2">
                  Competência
                </th>
                {closedCycles.map((c) => (
                  <th key={c.id} scope="col" className="py-2 text-center">
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

type Half = "H1" | "H2";

/** Rótulo e id nascem do par ano/semestre — nunca de texto livre. */
const cycleName = (year: number, half: Half) => `${year} ${half}`;
const cycleId = (year: number, half: Half) => `${year}-${half.toLowerCase()}`;

/** Extrai ano/semestre de um nome existente; cai no ano corrente se não casar o padrão. */
function parseCycleName(name: string): { year: number; half: Half } {
  const match = /^(\d{4}) (H[12])$/.exec(name);
  if (match) return { year: Number(match[1]), half: match[2] as Half };
  return { year: new Date().getFullYear(), half: "H1" };
}

/** Primeiro par ano/semestre ainda não usado, a partir do ciclo mais recente. */
function nextAvailableCycle(existing: DevelopmentCycle[]): { year: number; half: Half } {
  const used = new Set(existing.map((c) => c.id));
  let { year, half } = { year: new Date().getFullYear(), half: "H1" as Half };
  while (used.has(cycleId(year, half))) {
    if (half === "H1") half = "H2";
    else {
      half = "H1";
      year += 1;
    }
  }
  return { year, half };
}

const datesFor = (year: number, half: Half) =>
  half === "H1"
    ? { start: `${year}-01-01`, end: `${year}-06-30` }
    : { start: `${year}-07-01`, end: `${year}-12-31` };

const emptyCycle = (existing: DevelopmentCycle[]): DevelopmentCycle => {
  const { year, half } = nextAvailableCycle(existing);
  return { id: "", name: cycleName(year, half), ...datesFor(year, half), status: "Planned" };
};

/**
 * Criação e edição de ciclo. `cycle.id` vazio indica criação.
 *
 * Ano e semestre não são texto livre: são a identidade do ciclo (viram `id`
 * e `name` juntos), então em criação são um par de seletores com checagem de
 * duplicidade — não dá para ter dois "2026 H1". Em edição ficam fixos: mudar
 * o período de um ciclo já em uso desalinharia `id` de tudo que referencia
 * `cycle_id` (avaliações, PDI).
 *
 * Não existe mais campo de "situação" aqui — virar `Active` é uma decisão de
 * negócio (fecha o ciclo ativo anterior atomicamente), feita pelo botão
 * "Ativar" do card, nunca por este CRUD genérico de data/nome. Ver CYC-001,
 * AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md.
 */
function CycleDialog({ cycle, onClose }: { cycle: DevelopmentCycle; onClose: () => void }) {
  const store = useStore();
  const isNew = cycle.id === "";
  const parsed = parseCycleName(cycle.name);
  const [year, setYear] = useState(parsed.year);
  const [half, setHalf] = useState<Half>(parsed.half);
  const [start, setStart] = useState(cycle.start);
  const [end, setEnd] = useState(cycle.end);

  const duplicate = isNew && store.cycles.some((c) => c.id === cycleId(year, half));

  const changePeriod = (nextYear: number, nextHalf: Half) => {
    setYear(nextYear);
    setHalf(nextHalf);
    setStart(datesFor(nextYear, nextHalf).start);
    setEnd(datesFor(nextYear, nextHalf).end);
  };

  const save = () => {
    if (duplicate) return;
    if (isNew) {
      store.addCycle({
        id: cycleId(year, half),
        name: cycleName(year, half),
        start,
        end,
        status: "Planned",
      });
    } else {
      store.updateCycle(cycle.id, { start, end });
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
            <Label htmlFor="cycle-year">Ciclo</Label>
            {isNew ? (
              <div className="mt-1 flex gap-2">
                <Input
                  id="cycle-year"
                  type="number"
                  className="w-28"
                  value={year}
                  onChange={(e) => changePeriod(Number(e.target.value) || year, half)}
                />
                <select
                  aria-label="Semestre"
                  className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={half}
                  onChange={(e) => changePeriod(year, e.target.value as Half)}
                >
                  <option value="H1">H1</option>
                  <option value="H2">H2</option>
                </select>
              </div>
            ) : (
              <p id="cycle-year" className="mt-1 text-sm font-medium">
                {cycle.name}
              </p>
            )}
            {duplicate && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                Já existe um ciclo {cycleName(year, half)}.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cycle-start">Início</Label>
              <Input
                id="cycle-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cycle-end">Fim</Label>
              <Input
                id="cycle-end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={duplicate}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
