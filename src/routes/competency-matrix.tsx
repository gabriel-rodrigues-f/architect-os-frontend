import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ConfirmDialog,
  EmptyState,
  LevelBadge,
  PageHeader,
  SectionCard,
  SingleSelectFilter,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LEVELS, type Competency, type Capability } from "@/lib/domain";
import { useAsyncSubmit, useSuccessToast, useToastSubmit } from "@/hooks";
import { useCurrentUser } from "@/lib/auth";
import type { AffectedRecords, CompetencyRemovalOutcome } from "@/lib/gateways/catalog.gateway";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import { usePageHelp } from "@/lib/page-help";
import { requireAdminReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useCurationPolicy, useStore } from "@/lib/store";
import {
  CapabilityFoundationEditor,
  CatalogImportEditor,
  CompetencyMatrixViewModel,
  CompetencySelection,
  type CurationBrief,
} from "@/lib/view-models";

function useCompetencyMatrixViewModel(): CompetencyMatrixViewModel {
  const store = useStore();

  const curationPolicy = useCurationPolicy();
  return useMemo(
    () => new CompetencyMatrixViewModel(store, defaultUiAuthorizationPolicy, curationPolicy),
    [store, curationPolicy],
  );
}

export const Route = createFileRoute("/competency-matrix")({
  beforeLoad: requireAdminReach,
  head: () => ({
    meta: [
      { title: "Matriz de Competências — Synapse" },
      {
        name: "description",
        content: "Catálogo de competências agrupadas por capacidade técnica e de negócio.",
      },
      { property: "og:title", content: "Matriz de Competências — Synapse" },
      {
        property: "og:description",
        content: "Crie, edite e organize as competências esperadas de um profissional.",
      },
    ],
  }),
  component: MatrixPage,
});

function MatrixPage() {
  const store = useStore();
  const viewModel = useCompetencyMatrixViewModel();

  const isAdmin = viewModel.isAdmin(useCurrentUser());
  const [creatingCapability, setCreatingCapability] = useState(false);

  const [importing, setImporting] = useState(false);
  const { t } = useI18n();
  const notifySuccess = useSuccessToast();
  const labels = useLabels();
  const help = usePageHelp("competencyMatrix");
  const [confirmDelete, setConfirmDelete] = useState<{
    competency: Competency;
    capability: Capability;
  } | null>(null);
  const [editing, setEditing] = useState<Competency | null>(null);
  const [creatingIn, setCreatingIn] = useState<Capability | null>(null);
  const [editingCapability, setEditingCapability] = useState<Capability | null>(null);
  const [editCapabilityName, setEditCapabilityName] = useState("");
  const [confirmDeleteCapability, setConfirmDeleteCapability] = useState<Capability | null>(null);
  const [search, setSearch] = useState("");
  const [curationFilter, setCurationFilter] = useState<"all" | "ready" | "needsCuration">("all");

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const [selecting, setSelecting] = useState(false);
  const [selection, setSelection] = useState(() => CompetencySelection.empty());
  const [confirmBulkRemoval, setConfirmBulkRemoval] = useState(false);
  const [bulkRemovalResult, setBulkRemovalResult] = useState<{
    outcomes: CompetencyRemovalOutcome[];
    names: Map<string, string>;
  } | null>(null);
  const { submitting: removing, run: runRemoval } = useToastSubmit();

  const startSelecting = () => {
    setSelection(CompetencySelection.empty());
    setSelecting(true);
    setExpandedIds(new Set(store.capabilities.map((capability) => capability.id)));
  };
  const stopSelecting = () => {
    setSelecting(false);
    setSelection(CompetencySelection.empty());
  };

  const removeSelected = async () => {
    const chosen = selection.chosenFrom(store.competencies);
    const result = await runRemoval(() =>
      viewModel.removeCompetencies(chosen.map((competency) => competency.id)),
    );
    setConfirmBulkRemoval(false);
    if (!result.ok) return;
    const outcomes = result.value.outcomes;
    setBulkRemovalResult({
      outcomes,
      names: new Map(chosen.map((competency) => [competency.id, competency.name])),
    });
    notifySuccess(
      "matrix.bulkRemoval.toast",
      {
        removidas: outcomes.filter((outcome) => outcome.outcome === "removed").length,
        arquivadas: outcomes.filter((outcome) => outcome.outcome === "archived").length,
      },
      result.value,
    );
    stopSelecting();
  };

  const removeConfirmedCompetency = async () => {
    if (!confirmDelete) return;
    const { competency } = confirmDelete;
    const result = await runRemoval(() => viewModel.removeCompetency(competency.id));
    setConfirmDelete(null);
    if (!result.ok) return;
    toast.success(
      result.value.archived
        ? t("matrix.archive.toast", { nome: competency.name })
        : t("matrix.delete.toast", { nome: competency.name }),
    );
  };

  const startEditingCapability = (capability: Capability) => {
    setEditingCapability(capability);
    setEditCapabilityName(capability.name);
  };

  const saveEditingCapability = () => {
    if (!editingCapability) return;
    const trimmedName = editCapabilityName.trim();
    if (!trimmedName) return;

    viewModel.renameCapability(editingCapability.id, editCapabilityName);
    notifySuccess("msg.catalog.capability.update.success", { nome: trimmedName });
    setEditingCapability(null);
  };

  const removeCapability = async () => {
    if (!confirmDeleteCapability) return;
    const capability = confirmDeleteCapability;
    const result = await runRemoval(() => viewModel.removeCapability(capability.id));
    setConfirmDeleteCapability(null);
    if (!result.ok) return;
    toast.success(
      result.value.archived
        ? t("cap.archive.toast", { nome: capability.name })
        : t("cap.delete.toast", { nome: capability.name }),
    );
  };

  const capabilityCompetencyCount = (capabilityId: string) =>
    store.competencies.filter((c) => c.capabilityId === capabilityId).length;

  return (
    <>
      <PageHeader
        title={t("matrix.title")}
        description={t("matrix.subtitle")}
        help={help}
        actions={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setImporting(true)}>
                {t("matrix.import.button")}
              </Button>
              <Button onClick={() => setCreatingCapability(true)}>
                {t("matrix.newCapability")}
              </Button>
            </div>
          ) : undefined
        }
      />

      <SectionCard
        title={t("matrix.levels.title")}
        description={t("matrix.levels.subtitle")}
        className="mb-6"
      >
        <div className="grid gap-3 md:grid-cols-5">
          {LEVELS.map((l) => (
            <div key={l.level} className="surface-inset p-3">
              <LevelBadge level={l.level} showName />
              <p className="mt-2 text-xs text-muted-foreground">
                {labels.levelDescription[l.level]}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      {store.capabilities.length === 0 && (
        <EmptyState title={t("matrix.empty.title")} hint={t("matrix.empty.hint")} />
      )}

      {store.capabilities.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              placeholder={t("matrix.search.placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t("matrix.search.placeholder")}
              className="max-w-sm"
            />
          </div>
          <SingleSelectFilter
            id="matrix-curation-filter"
            label={t("matrix.filter.curation")}
            value={curationFilter}
            onChange={(value) => setCurationFilter(value as typeof curationFilter)}
            options={[
              { value: "all", label: t("matrix.filter.curation.all") },
              { value: "ready", label: t("matrix.filter.curation.ready") },
              { value: "needsCuration", label: t("matrix.filter.curation.needsCuration") },
            ]}
          />
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedIds(new Set(store.capabilities.map((c) => c.id)))}
            >
              {t("matrix.expandAll")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExpandedIds(new Set())}>
              {t("matrix.collapseAll")}
            </Button>
            {isAdmin && (
              <Button
                variant={selecting ? "secondary" : "outline"}
                size="sm"
                aria-pressed={selecting}
                onClick={selecting ? stopSelecting : startSelecting}
              >
                {selecting ? t("matrix.select.cancel") : t("matrix.select.start")}
              </Button>
            )}
          </div>
        </div>
      )}

      {selecting && (
        <div className="surface-inset mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
          <p className="text-sm text-muted-foreground">{t("matrix.select.hint")}</p>
          <Button
            variant="destructive"
            size="sm"
            disabled={selection.isEmpty || removing}
            onClick={() => setConfirmBulkRemoval(true)}
          >
            {t("matrix.select.removeSelected", { n: selection.count })}
          </Button>
        </div>
      )}

      {(() => {
        const term = search.trim().toLowerCase();
        const activeCapabilities = store.capabilities.filter((cat) => cat.active);
        const bySearch = term
          ? activeCapabilities.filter(
              (cat) =>
                cat.name.toLowerCase().includes(term) ||
                store.competencies.some(
                  (c) =>
                    c.capabilityId === cat.id && c.active && c.name.toLowerCase().includes(term),
                ),
            )
          : activeCapabilities;
        const visibleCapabilities =
          curationFilter === "all"
            ? bySearch
            : bySearch.filter((cat) =>
                curationFilter === "ready"
                  ? cat.curation.status === "READY"
                  : cat.curation.status !== "READY",
              );

        if (visibleCapabilities.length === 0) {
          return (
            <EmptyState
              hint={
                term
                  ? t("matrix.search.empty", { termo: search.trim() })
                  : t("matrix.filter.curation.empty")
              }
            />
          );
        }

        return (
          <div className="space-y-4">
            {visibleCapabilities.map((cat) => {
              const comps = store.competencies.filter((c) => c.capabilityId === cat.id && c.active);

              const isExpanded = expandedIds.has(cat.id) || term.length > 0;
              const atCapacity = viewModel.isCapabilityAtCapacity(cat);
              return (
                <SectionCard
                  key={cat.id}
                  title={cat.name}
                  description={t("matrix.competencyCount", {
                    n: cat.curation.activeCompetencyCount,
                    max: viewModel.limits.max,
                  })}
                  actions={
                    <div className="flex flex-wrap items-center gap-2">
                      {selecting && (
                        <Checkbox
                          aria-label={t("matrix.select.capability", { nome: cat.name })}
                          checked={selection.capabilityCheckbox(cat.id, store.competencies)}
                          onCheckedChange={() =>
                            setSelection((current) =>
                              current.toggleCapability(cat.id, store.competencies),
                            )
                          }
                        />
                      )}
                      <CurationStatusControl brief={viewModel.curationBriefFor(cat)} />
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setCreatingIn(cat)}
                            disabled={atCapacity}
                            title={
                              atCapacity
                                ? t("matrix.atCapacity.hint", {
                                    max: viewModel.limits.max,
                                  })
                                : undefined
                            }
                          >
                            {t("matrix.newCompetency")}
                          </Button>
                          <button
                            type="button"
                            onClick={() => startEditingCapability(cat)}
                            aria-label={`${t("common.edit")} ${cat.name}`}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteCapability(cat)}
                            aria-label={`${t("common.delete")} ${cat.name}`}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(cat.id)}
                        aria-label={
                          isExpanded
                            ? t("matrix.collapse.collapse", { nome: cat.name })
                            : t("matrix.collapse.expand", { nome: cat.name })
                        }
                        aria-expanded={isExpanded}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  }
                >
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                            {selecting && <th scope="col" className="w-8 py-2" />}
                            <th scope="col" className="py-2">
                              {t("col.competency")}
                            </th>
                            <th scope="col" />
                          </tr>
                        </thead>
                        <tbody>
                          {comps.map((c) => (
                            <tr key={c.id} className="border-b border-border/60 last:border-0">
                              {selecting && (
                                <td className="py-2">
                                  <Checkbox
                                    aria-label={t("matrix.select.competency", { nome: c.name })}
                                    checked={selection.has(c.id)}
                                    onCheckedChange={() =>
                                      setSelection((current) => current.toggle(c.id))
                                    }
                                  />
                                </td>
                              )}
                              <td className="py-2 font-medium">{c.name}</td>
                              <td className="py-2 text-right">
                                {isAdmin && (
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                      onClick={() => setEditing(c)}
                                      aria-label={t("matrix.edit.action", { nome: c.name })}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                      onClick={() =>
                                        setConfirmDelete({ competency: c, capability: cat })
                                      }
                                      aria-label={t("matrix.delete.action", { nome: c.name })}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              );
            })}
          </div>
        );
      })()}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("matrix.delete.confirmTitle", {
          competencia: confirmDelete?.competency.name ?? "",
          capacidade: confirmDelete?.capability.name ?? "",
        })}
        description={t("matrix.delete.confirmDescription")}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => void removeConfirmedCompetency()}
      />

      <ConfirmDialog
        open={confirmBulkRemoval}
        title={
          selection.count === 1
            ? t("matrix.bulkRemoval.confirmTitleOne")
            : t("matrix.bulkRemoval.confirmTitle", { n: selection.count })
        }
        description={
          <>
            <span className="block">{t("matrix.bulkRemoval.confirmDescription")}</span>
            <span className="mt-2 block font-medium text-foreground">
              {selection
                .chosenFrom(store.competencies)
                .map((competency) => competency.name)
                .join(" · ")}
            </span>
          </>
        }
        onCancel={() => setConfirmBulkRemoval(false)}
        onConfirm={() => {
          if (!removing) void removeSelected();
        }}
      />

      {bulkRemovalResult && (
        <BulkRemovalResultDialog
          outcomes={bulkRemovalResult.outcomes}
          names={bulkRemovalResult.names}
          onClose={() => setBulkRemovalResult(null)}
        />
      )}

      <Dialog
        open={editingCapability !== null}
        onOpenChange={(v) => !v && setEditingCapability(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cap.edit.title")}</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="capability-edit-name">{t("cap.field.name")}</Label>
            <Input
              id="capability-edit-name"
              value={editCapabilityName}
              onChange={(e) => setEditCapabilityName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveEditingCapability()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCapability(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={saveEditingCapability}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteCapability !== null}
        title={t("matrix.deleteCapability.confirmTitle", {
          nome: confirmDeleteCapability?.name ?? "",
        })}
        description={
          confirmDeleteCapability && capabilityCompetencyCount(confirmDeleteCapability.id) > 0
            ? t("matrix.deleteCapability.confirmDescription", {
                n: capabilityCompetencyCount(confirmDeleteCapability.id),
              })
            : t("matrix.deleteCapability.confirmDescriptionEmpty")
        }
        onCancel={() => setConfirmDeleteCapability(null)}
        onConfirm={removeCapability}
      />

      {isAdmin && (
        <ArchivedCompetencies capabilities={store.capabilities} competencies={store.competencies} />
      )}

      {editing && <CompetencyEditDialog competency={editing} onClose={() => setEditing(null)} />}
      {creatingIn && (
        <CompetencyCreateDialog capability={creatingIn} onClose={() => setCreatingIn(null)} />
      )}
      {creatingCapability && (
        <CapabilityFoundationDialog onClose={() => setCreatingCapability(false)} />
      )}
      {importing && <CatalogImportDialog onClose={() => setImporting(false)} />}
    </>
  );
}

function CurationStatusControl({ brief }: { brief: CurationBrief }) {
  const { t } = useI18n();
  const ready = brief.status === "READY";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant={ready ? "secondary" : "outline"} aria-haspopup="dialog">
          {ready ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
          {ready ? t("matrix.curation.ready") : t("matrix.curation.requiresCuration")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] space-y-2 text-sm">
        <p className="font-display font-semibold">{t("matrix.curation.explain.title")}</p>
        <p>
          {ready
            ? t("matrix.curation.explain.ready", { ativas: brief.active, max: brief.max })
            : brief.empty
              ? t("matrix.curation.explain.empty", { max: brief.max })
              : t("matrix.curation.explain.requiresCuration", {
                  ativas: brief.active,
                  max: brief.max,
                  acima: brief.over,
                })}
        </p>
      </PopoverContent>
    </Popover>
  );
}

function BulkRemovalResultDialog({
  outcomes,
  names,
  onClose,
}: {
  outcomes: CompetencyRemovalOutcome[];
  names: Map<string, string>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const affectedText = (affected: AffectedRecords) =>
    (Object.entries(affected) as [keyof AffectedRecords, number][])
      .filter(([, count]) => count > 0)
      .map(([kind, count]) =>
        t(`matrix.bulkRemoval.affected.${kind}.${count === 1 ? "one" : "other"}` as MessageKey, {
          n: count,
        }),
      )
      .join(", ");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("matrix.bulkRemoval.result.title")}</DialogTitle>
        </DialogHeader>
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto text-sm">
          {outcomes.map((outcome) => {
            const affected = affectedText(outcome.affected);
            return (
              <li key={outcome.competencyId} className="flex flex-col">
                <span className="font-medium">
                  {names.get(outcome.competencyId) ?? outcome.competencyId}
                </span>
                <span className="text-xs text-muted-foreground">
                  {outcome.outcome === "removed"
                    ? t("matrix.bulkRemoval.result.removed")
                    : t("matrix.bulkRemoval.result.archived")}
                  {affected ? ` (${affected})` : ""}
                </span>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button onClick={onClose}>{t("matrix.bulkRemoval.result.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CatalogImportDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const { t } = useI18n();
  const [editor, setEditor] = useState<CatalogImportEditor>(() =>
    CatalogImportEditor.from(store.capabilities, store.competencies),
  );
  const {
    submitting: importingNow,
    error,
    clearError,
    run,
  } = useAsyncSubmit(t("matrix.import.failed"));
  const notifySuccess = useSuccessToast();

  const preview = editor.preview();

  const readFile = async (file: File) => {
    const text = await file.text();
    setEditor(editor.withText(text));
    clearError();
  };

  const submit = async () => {
    const payload = editor.payload();
    if (!payload) return;
    const result = await run(() => store.importCatalog(payload));
    if (result.ok) {
      const summary = result.value;
      notifySuccess(
        "msg.catalog.import.success",
        {
          capCriadas: summary.capabilitiesCreated.length,
          capAtualizadas: summary.capabilitiesUpdated.length,
          compCriadas: summary.competenciesCreated.length,
          compAtualizadas: summary.competenciesUpdated.length,
        },
        summary,
      );
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !importingNow && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("matrix.import.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("matrix.import.hint")}</p>
          <div>
            <Label htmlFor="catalog-import-file">{t("matrix.import.file")}</Label>
            <Input
              id="catalog-import-file"
              type="file"
              accept="application/json,.json"
              disabled={importingNow}
              className="mt-1"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
          </div>
          <div>
            <Label htmlFor="catalog-import-text">{t("matrix.import.paste")}</Label>
            <textarea
              id="catalog-import-text"
              rows={8}
              disabled={importingNow}
              className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1.5 font-mono text-xs"
              placeholder='{"capabilities": [...]}'
              value={editor.text}
              onChange={(e) => {
                setEditor(editor.withText(e.target.value));
                clearError();
              }}
            />
          </div>

          {editor.errorKey && (
            <p className="text-xs text-destructive" role="alert">
              {t(editor.errorKey)}
            </p>
          )}

          {preview && (
            <div className="surface-inset p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("matrix.import.preview")}
              </p>
              <p className="mt-1 text-sm">
                {t("matrix.import.previewSummary", {
                  capCriadas: preview.capabilitiesToCreate,
                  capAtualizadas: preview.capabilitiesToUpdate,
                  compCriadas: preview.competenciesToCreate,
                  compAtualizadas: preview.competenciesToUpdate,
                })}
              </p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                {preview.capabilities.map((capability) => (
                  <li key={capability.name}>
                    <span className="font-medium">{capability.name}</span>{" "}
                    <span className="text-muted-foreground">
                      —{" "}
                      {capability.action === "create"
                        ? t("matrix.import.capabilityCreate")
                        : t("matrix.import.capabilityUpdate")}
                      {" · "}
                      {t("matrix.import.competencyCounts", {
                        criadas: capability.competenciesToCreate.length,
                        atualizadas: capability.competenciesToUpdate.length,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={importingNow} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!editor.isValid || importingNow} onClick={() => void submit()}>
            {importingNow ? t("team.transition.submitting") : t("matrix.import.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CapabilityFoundationDialog({ onClose }: { onClose: () => void }) {
  const viewModel = useCompetencyMatrixViewModel();
  const { t } = useI18n();
  const limits = viewModel.limits;
  const [editor, setEditor] = useState(() => CapabilityFoundationEditor.begin(limits));

  const { submitting: saving, run } = useToastSubmit();

  const found = async () => {
    const payload = editor.payload();
    if (!payload || saving) return;

    const result = await run(() => viewModel.foundCapability(payload));
    if (result.ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("matrix.newCapability")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="new-capability-name">{t("cap.field.name")}</Label>
            <Input
              id="new-capability-name"
              value={editor.name}
              disabled={saving}
              onChange={(e) => setEditor(editor.withName(e.target.value))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("matrix.foundation.hint", { min: limits.min, max: limits.max })}
          </p>
          {editor.competencyNames.map((competencyName, position) => (
            <div key={position} className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor={`new-capability-competency-${position}`}>
                  {t("matrix.foundation.competency", { n: position + 1 })}
                </Label>
                <Input
                  id={`new-capability-competency-${position}`}
                  value={competencyName}
                  disabled={saving}
                  onChange={(e) => setEditor(editor.withCompetencyName(position, e.target.value))}
                />
              </div>
              {editor.canRemoveCompetency(position) && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  aria-label={t("matrix.foundation.remove", { n: position + 1 })}
                  onClick={() => setEditor(editor.removeCompetency(position))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          {editor.canAddCompetency && (
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setEditor(editor.addCompetency())}
            >
              {t("matrix.foundation.addAnother")}
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void found()} disabled={!editor.isValid || saving}>
            {t("matrix.foundation.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchivedCompetencies({
  capabilities,
  competencies,
}: {
  capabilities: Capability[];
  competencies: Competency[];
}) {
  const viewModel = useCompetencyMatrixViewModel();
  const { t } = useI18n();
  const archivedCapabilities = capabilities.filter((c) => !c.active);
  const archivedCompetencies = competencies.filter(
    (c) => !c.active && archivedCapabilities.every((cat) => cat.id !== c.capabilityId),
  );
  if (!archivedCapabilities.length && !archivedCompetencies.length) return null;

  return (
    <SectionCard
      className="mt-6"
      title={t("matrix.archived.title")}
      description={t("matrix.archived.hint")}
    >
      <ul className="space-y-2 text-sm">
        {archivedCapabilities.map((cat) => (
          <li key={cat.id} className="flex items-center justify-between gap-2">
            <span>
              {cat.name}{" "}
              <span className="text-xs text-muted-foreground">
                ({t("matrix.archived.capability")})
              </span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => viewModel.restoreCapability(cat.id)}
            >
              {t("matrix.restore")}
            </Button>
          </li>
        ))}
        {archivedCompetencies.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            <span>{c.name}</span>
            <Button size="sm" variant="secondary" onClick={() => viewModel.restoreCompetency(c.id)}>
              {t("matrix.restore")}
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function CompetencyCreateDialog({
  capability,
  onClose,
}: {
  capability: Capability;
  onClose: () => void;
}) {
  const viewModel = useCompetencyMatrixViewModel();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const canSave = viewModel.canCreateCompetency(name);

  const { submitting: saving, run } = useToastSubmit();

  const save = async () => {
    if (!canSave) return;

    const result = await run(() => viewModel.createCompetency(capability.id, name));
    if (result.ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("matrix.create.title", { capacidade: capability.name })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="new-competency-name">{t("matrix.edit.name")}</Label>
            <Input
              id="new-competency-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("matrix.levelFromRule.hint")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={!canSave || saving}>
            {t("matrix.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompetencyEditDialog({
  competency,
  onClose,
}: {
  competency: Competency;
  onClose: () => void;
}) {
  const viewModel = useCompetencyMatrixViewModel();
  const { t } = useI18n();
  const [name, setName] = useState(competency.name);

  const save = () => {
    if (!name.trim()) return;

    viewModel.updateCompetency(competency.id, name);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("matrix.edit.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="competency-name">{t("matrix.edit.name")}</Label>
            <Input
              id="competency-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("matrix.levelFromRule.hint")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
