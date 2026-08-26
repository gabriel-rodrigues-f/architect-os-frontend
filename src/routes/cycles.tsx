import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { ArchitectSelectCombobox } from "@/components/app/ArchitectSelectCombobox";
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
import { CycleCadenceScheme } from "@/lib/cycle-cadence";
import { useLabels } from "@/lib/labels";
import { useI18n, type MessageKey } from "@/lib/i18n";
import type { CycleCadence } from "@/lib/operational-settings";
import { usePageHelp } from "@/lib/page-help";
import { useOperationalSettings, useSelectors, useStore } from "@/lib/store";
import { defaultDateFormatter } from "@/lib/text";

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

  const isAdmin = useCurrentUser().role === "admin";
  const [architectId, setArchitectId] = useState(store.architects[0]?.id ?? "");
  const { t, locale } = useI18n();
  const help = usePageHelp("cycles");
  const [editing, setEditing] = useState<DevelopmentCycle | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DevelopmentCycle | null>(null);
  const [blockedDelete, setBlockedDelete] = useState<DevelopmentCycle | null>(null);

  const scheme = CycleCadenceScheme.of(useOperationalSettings().cycleCadence);

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

    for (const d of sel.capabilityAverages(architectId, c.id)) {
      if (d.avg !== undefined) row[d.capability.id] = d.avg;
    }
    return row;
  });

  const series = store.capabilities.map((c) => ({ key: c.id, label: c.name }));

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
        description={t("cycle.subtitle")}
        help={help}
        actions={
          <div className="flex flex-wrap gap-2">
            <ArchitectSelectCombobox
              architects={sel.activeArchitects}
              inactiveArchitects={store.architects.filter((a) => !a.active)}
              selectedId={architectId}
              onChange={setArchitectId}
              label={t("cycle.architect")}
              className="w-48"
            />
            {isAdmin && (
              <Button onClick={() => setEditing(emptyCycle(store.cycles, scheme))}>
                {t("cycle.new")}
              </Button>
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
                      aria-label={`${t("common.edit")} ${c.name}`}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => askDeleteCycle(c)}
                      aria-label={`${t("common.delete")} ${c.name}`}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {defaultDateFormatter.formatDate(c.start, locale)} →{" "}
              {defaultDateFormatter.formatDate(c.end, locale)}
            </p>
          </div>
        ))}
        {store.cycles.length === 0 && (
          <div className="surface-card p-6 text-center sm:col-span-3">
            <p className="text-sm font-medium">{t("cycle.empty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("cycle.empty.hint")}</p>
            {isAdmin && (
              <Button className="mt-4" onClick={() => setEditing(emptyCycle(store.cycles, scheme))}>
                {t("cycle.new")}
              </Button>
            )}
          </div>
        )}
      </div>

      {editing && <CycleDialog cycle={editing} scheme={scheme} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("cycle.delete.confirmTitle", { nome: confirmDelete?.name ?? "" })}
        description={t("cycle.delete.confirmDescription")}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) store.removeCycle(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />

      <Dialog open={blockedDelete !== null} onOpenChange={(v) => !v && setBlockedDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("cycle.delete.blockedTitle", { nome: blockedDelete?.name ?? "" })}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("cycle.delete.blockedDescription")}</p>
          <DialogFooter>
            <Button onClick={() => setBlockedDelete(null)}>{t("common.understood")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SectionCard title={t("cycle.evolution.title")} description={t("cycle.evolution.subtitle")}>
        <EvolutionLine data={chartData} series={series} />
      </SectionCard>

      <SectionCard
        className="mt-6"
        title={t("cycle.compare.title")}
        description={
          store.competencies.length > compare.length
            ? t("cycle.compare.subtitleShowingN", {
                shown: compare.length,
                total: store.competencies.length,
              })
            : t("cycle.compare.subtitle")
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2">
                  {t("col.competency")}
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
        {store.competencies.length > compare.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("cycle.compare.seeMore")}{" "}
            <Link to="/competency-matrix" className="text-primary hover:underline">
              {t("matrix.title")}
            </Link>
            .
          </p>
        )}
      </SectionCard>
    </>
  );
}

const emptyCycle = (existing: DevelopmentCycle[], scheme: CycleCadenceScheme): DevelopmentCycle => {
  const { year, period } = scheme.nextAvailable(existing);
  return {
    id: "",
    name: scheme.cycleName(year, period),
    ...scheme.datesFor(year, period),
    status: "Planned",
  };
};

const PERIOD_ARIA_KEY: Record<CycleCadence, MessageKey> = {
  SEMIANNUAL: "cycle.dialog.semesterAriaLabel",
  QUARTERLY: "cycle.dialog.quarterAriaLabel",
  ANNUAL: "cycle.dialog.quarterAriaLabel",
};

function CycleDialog({
  cycle,
  scheme,
  onClose,
}: {
  cycle: DevelopmentCycle;
  scheme: CycleCadenceScheme;
  onClose: () => void;
}) {
  const store = useStore();
  const { t } = useI18n();
  const isNew = cycle.id === "";
  const parsed = scheme.parseCycleName(cycle.name);
  const [year, setYear] = useState(parsed.year);
  const [period, setPeriod] = useState(parsed.period);
  const [start, setStart] = useState(cycle.start);
  const [end, setEnd] = useState(cycle.end);

  const duplicate = isNew && store.cycles.some((c) => c.id === scheme.cycleId(year, period));

  const changePeriod = (nextYear: number, nextPeriod: string) => {
    setYear(nextYear);
    setPeriod(nextPeriod);
    setStart(scheme.datesFor(nextYear, nextPeriod).start);
    setEnd(scheme.datesFor(nextYear, nextPeriod).end);
  };

  const save = () => {
    if (duplicate) return;
    if (isNew) {
      store.addCycle({
        id: scheme.cycleId(year, period),
        name: scheme.cycleName(year, period),
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
          <DialogTitle>
            {isNew ? t("cycle.new") : t("cycle.dialog.titleEdit", { nome: cycle.name })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cycle-year">{t("cycle.dialog.cycleLabel")}</Label>
            {isNew ? (
              <div className="mt-1 flex gap-2">
                <Input
                  id="cycle-year"
                  type="number"
                  className="w-28"
                  value={year}
                  onChange={(e) => changePeriod(Number(e.target.value) || year, period)}
                />
                {!scheme.singlePeriod && (
                  <select
                    aria-label={t(PERIOD_ARIA_KEY[scheme.cadence])}
                    className="rounded-md border border-input bg-card px-3 py-2 text-sm"
                    value={period}
                    onChange={(e) => changePeriod(year, e.target.value)}
                  >
                    {scheme.periods.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <p id="cycle-year" className="mt-1 text-sm font-medium">
                {cycle.name}
              </p>
            )}
            {duplicate && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {t("cycle.dialog.duplicate", { nome: scheme.cycleName(year, period) })}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cycle-start">{t("cycle.dialog.start")}</Label>
              <Input
                id="cycle-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="cycle-end">{t("cycle.dialog.end")}</Label>
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
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={duplicate}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
