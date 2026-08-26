import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { SingleSelectFilter } from "@/components/app/SingleSelectFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LEVELS,
  type Competency,
  type Capability,
  type Level,
  type RequirementType,
} from "@/lib/domain";
import { useAsyncSubmit, useSuccessToast, useToastSubmit } from "@/hooks/use-async-submit";
import { useCurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import { usePageHelp } from "@/lib/page-help";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useCareerLevelsByRank, useCurationPolicy, useStore } from "@/lib/store";
import { CompetencyMatrixViewModel } from "@/lib/view-models/competency-matrix-view-model";
import { CatalogImportEditor } from "@/lib/view-models/catalog-import-editor";

function useCompetencyMatrixViewModel(): CompetencyMatrixViewModel {
  const store = useStore();

  const curationPolicy = useCurationPolicy();
  return useMemo(
    () => new CompetencyMatrixViewModel(store, defaultUiAuthorizationPolicy, curationPolicy),
    [store, curationPolicy],
  );
}

export const Route = createFileRoute("/competency-matrix")({
  head: () => ({
    meta: [
      { title: "Matriz de Competências — Synapse" },
      {
        name: "description",
        content:
          "Catálogo de competências de arquitetura agrupadas por capacidade, com níveis esperados por cargo.",
      },
      { property: "og:title", content: "Matriz de Competências — Synapse" },
      {
        property: "og:description",
        content: "Crie, edite e organize as competências esperadas de um Arquiteto de Soluções.",
      },
    ],
  }),
  component: MatrixPage,
});

function MatrixPage() {
  const store = useStore();
  const careerLevels = useCareerLevelsByRank();
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
    const { archived } = await viewModel.removeCapability(confirmDeleteCapability.id);
    toast.success(
      archived
        ? t("cap.archive.toast", { nome: confirmDeleteCapability.name })
        : t("cap.delete.toast", { nome: confirmDeleteCapability.name }),
    );
    setConfirmDeleteCapability(null);
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
          {}
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
          </div>
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
                  description={`${t("matrix.competencyCount", { n: cat.curation.activeCompetencyCount })} · ${t("matrix.requirement.count", { restrictive: cat.curation.restrictiveCompetencyCount })} · ${t("matrix.requirement.nonRestrictiveCount", { n: cat.curation.nonRestrictiveCompetencyCount })}`}
                  actions={
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={cat.curation.status === "READY" ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {cat.curation.status === "READY"
                          ? t("matrix.curation.ready")
                          : t("matrix.curation.requiresCuration")}
                      </Badge>
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
                                    max: viewModel.limits.maxActiveCompetencies,
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
                            <th scope="col" className="py-2">
                              {t("col.competency")}
                            </th>
                            {careerLevels.map((cl) => (
                              <th key={cl.id} scope="col" className="py-2 text-center">
                                {labels.roleShort(cl.name)}
                              </th>
                            ))}
                            <th scope="col" />
                          </tr>
                        </thead>
                        <tbody>
                          {comps.map((c) => (
                            <tr key={c.id} className="border-b border-border/60 last:border-0">
                              <td className="py-2 font-medium">
                                {c.name}
                                {c.requirementType === "RESTRICTIVE" && (
                                  <Badge
                                    variant="outline"
                                    className="ml-2 align-middle text-[10px]"
                                  >
                                    {t("matrix.requirement.badge")}
                                  </Badge>
                                )}
                              </td>
                              {careerLevels.map((cl) => (
                                <td key={cl.id} className="py-2 text-center">
                                  <LevelBadge level={c.expected[cl.id]} />
                                </td>
                              ))}
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
        onConfirm={async () => {
          if (confirmDelete) {
            const { archived } = await viewModel.removeCompetency(confirmDelete.competency.id);
            toast.success(
              archived
                ? t("matrix.archive.toast", { nome: confirmDelete.competency.name })
                : t("matrix.delete.toast", { nome: confirmDelete.competency.name }),
            );
          }
          setConfirmDelete(null);
        }}
      />

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
        <CapabilityCreateDialog onClose={() => setCreatingCapability(false)} />
      )}
      {importing && <CatalogImportDialog onClose={() => setImporting(false)} />}
    </>
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

          {}
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

function CapabilityCreateDialog({ onClose }: { onClose: () => void }) {
  const viewModel = useCompetencyMatrixViewModel();
  const { t } = useI18n();
  const [name, setName] = useState("");

  const { submitting: saving, run } = useToastSubmit();

  const create = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const result = await run(() => viewModel.createCapability(name));
    if (result.ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("matrix.newCapability")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="new-capability-name">{t("cap.field.name")}</Label>
            <Input
              id="new-capability-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={create} disabled={!name.trim() || saving}>
            {t("matrix.add")}
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
  const careerLevels = useCareerLevelsByRank();
  const { t } = useI18n();
  const labels = useLabels();
  const restrictiveFull = viewModel.isRequirementTypeFull(capability, "RESTRICTIVE");
  const nonRestrictiveFull = viewModel.isRequirementTypeFull(capability, "NON_RESTRICTIVE");
  const [name, setName] = useState("");
  const [levels, setLevels] = useState<Partial<Record<string, Level>>>({});
  const [requirementType, setRequirementType] = useState<RequirementType>(
    nonRestrictiveFull ? "RESTRICTIVE" : "NON_RESTRICTIVE",
  );
  const canSave = viewModel.canCreateCompetency(name, levels, careerLevels);

  const { submitting: saving, run } = useToastSubmit();

  const save = async () => {
    if (!canSave) return;

    const result = await run(() =>
      viewModel.createCompetency(capability.id, name, levels, requirementType),
    );
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
          <div>
            <Label>{t("matrix.edit.levels")}</Label>
            {}
            <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {careerLevels.map((cl) => (
                <div key={cl.id} className="min-w-0">
                  <span className="block text-xs text-muted-foreground">
                    {labels.roleShort(cl.name)}
                  </span>
                  <select
                    className="mt-1 w-full min-w-0 rounded-md border border-input bg-card px-2 py-2 text-sm"
                    value={levels[cl.id] ?? ""}
                    aria-label={`${t("matrix.edit.levels")} — ${labels.roleShort(cl.name)}`}
                    onChange={(e) =>
                      setLevels({
                        ...levels,
                        [cl.id]: e.target.value ? (Number(e.target.value) as Level) : undefined,
                      })
                    }
                  >
                    <option value="">—</option>
                    {LEVELS.map((l) => (
                      <option key={l.level} value={l.level}>
                        L{l.level} · {labels.levelName[l.level]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="new-competency-requirement">{t("matrix.requirement.label")}</Label>
            <select
              id="new-competency-requirement"
              className="mt-1 w-full rounded-md border border-input bg-card px-2 py-2 text-sm"
              value={requirementType}
              onChange={(e) => setRequirementType(e.target.value as RequirementType)}
            >
              <option value="NON_RESTRICTIVE" disabled={nonRestrictiveFull}>
                {t("matrix.requirement.nonRestrictive")}
              </option>
              <option value="RESTRICTIVE" disabled={restrictiveFull}>
                {t("matrix.requirement.restrictive")}
              </option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">{t("matrix.requirement.hint")}</p>
            {restrictiveFull && (
              <p className="mt-1 text-xs text-amber-600">
                {t("matrix.requirement.restrictiveFull", {
                  limite: viewModel.limits.requiredRestrictive,
                })}
              </p>
            )}
            {nonRestrictiveFull && (
              <p className="mt-1 text-xs text-amber-600">
                {t("matrix.requirement.nonRestrictiveFull", {
                  limite: viewModel.limits.requiredNonRestrictive,
                })}
              </p>
            )}
          </div>
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
  const store = useStore();
  const viewModel = useCompetencyMatrixViewModel();
  const careerLevels = useCareerLevelsByRank();
  const { t } = useI18n();
  const labels = useLabels();
  const capability = store.capabilities.find((c) => c.id === competency.capabilityId);

  const restrictiveFull = viewModel.isRequirementTypeFull(capability, "RESTRICTIVE", competency);
  const nonRestrictiveFull = viewModel.isRequirementTypeFull(
    capability,
    "NON_RESTRICTIVE",
    competency,
  );
  const [name, setName] = useState(competency.name);
  const [levels, setLevels] = useState<Partial<Record<string, Level>>>(competency.expected);
  const [requirementType, setRequirementType] = useState<RequirementType>(
    competency.requirementType,
  );

  const [swapTargetId, setSwapTargetId] = useState("");
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  const restrictiveSiblings = viewModel.swapCandidates(
    store.competencies,
    competency.capabilityId,
    "RESTRICTIVE",
    competency.id,
  );
  const nonRestrictiveSiblings = viewModel.swapCandidates(
    store.competencies,
    competency.capabilityId,
    "NON_RESTRICTIVE",
    competency.id,
  );

  const swapWith = async () => {
    if (!swapTargetId) return;
    setSwapping(true);
    setSwapError(null);
    try {
      await viewModel.swapRequirementType(competency.id, swapTargetId);

      setRequirementType((prev) => (prev === "RESTRICTIVE" ? "NON_RESTRICTIVE" : "RESTRICTIVE"));
      setSwapTargetId("");
    } catch (error) {
      setSwapError(error instanceof ApiError ? error.message : t("matrix.requirement.swapError"));
    } finally {
      setSwapping(false);
    }
  };

  const save = () => {
    if (!name.trim()) return;

    viewModel.updateCompetency(competency.id, name, levels, requirementType);
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
          <div>
            <Label>{t("matrix.edit.levels")}</Label>
            <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {careerLevels.map((cl) => (
                <div key={cl.id} className="min-w-0">
                  <span className="block text-xs text-muted-foreground">
                    {labels.roleShort(cl.name)}
                  </span>
                  <select
                    className="mt-1 w-full min-w-0 rounded-md border border-input bg-card px-2 py-2 text-sm"
                    value={levels[cl.id] ?? ""}
                    aria-label={`${t("matrix.edit.levels")} — ${labels.roleShort(cl.name)}`}
                    onChange={(e) =>
                      setLevels({
                        ...levels,
                        [cl.id]: e.target.value ? (Number(e.target.value) as Level) : undefined,
                      })
                    }
                  >
                    <option value="">—</option>
                    {LEVELS.map((l) => (
                      <option key={l.level} value={l.level}>
                        L{l.level} · {labels.levelName[l.level]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="edit-competency-requirement">{t("matrix.requirement.label")}</Label>
            <select
              id="edit-competency-requirement"
              className="mt-1 w-full rounded-md border border-input bg-card px-2 py-2 text-sm"
              value={requirementType}
              onChange={(e) => setRequirementType(e.target.value as RequirementType)}
            >
              <option value="NON_RESTRICTIVE" disabled={nonRestrictiveFull}>
                {t("matrix.requirement.nonRestrictive")}
              </option>
              <option value="RESTRICTIVE" disabled={restrictiveFull}>
                {t("matrix.requirement.restrictive")}
              </option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">{t("matrix.requirement.hint")}</p>
            {restrictiveFull && requirementType !== "RESTRICTIVE" && (
              <SwapPicker
                hint={t("matrix.requirement.restrictiveFull", {
                  limite: viewModel.limits.requiredRestrictive,
                })}
                label={t("matrix.requirement.swapPickRestrictive")}
                action={t("matrix.requirement.swapAction")}
                candidates={restrictiveSiblings}
                value={swapTargetId}
                onChange={setSwapTargetId}
                onSwap={swapWith}
                swapping={swapping}
              />
            )}
            {nonRestrictiveFull && requirementType !== "NON_RESTRICTIVE" && (
              <SwapPicker
                hint={t("matrix.requirement.nonRestrictiveFull", {
                  limite: viewModel.limits.requiredNonRestrictive,
                })}
                label={t("matrix.requirement.swapPickNonRestrictive")}
                action={t("matrix.requirement.swapAction")}
                candidates={nonRestrictiveSiblings}
                value={swapTargetId}
                onChange={setSwapTargetId}
                onSwap={swapWith}
                swapping={swapping}
              />
            )}
            {swapError && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {swapError}
              </p>
            )}
          </div>
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

function SwapPicker({
  hint,
  label,
  action,
  candidates,
  value,
  onChange,
  onSwap,
  swapping,
}: {
  hint: string;
  label: string;
  action: string;
  candidates: Competency[];
  value: string;
  onChange: (id: string) => void;
  onSwap: () => void;
  swapping: boolean;
}) {
  return (
    <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
      <p className="text-xs text-amber-700">{hint}</p>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <select
          className="min-w-0 flex-1 rounded-md border border-input bg-card px-2 py-1.5 text-xs"
          aria-label={label}
          value={value}
          disabled={swapping}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{label}</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          disabled={!value || swapping}
          onClick={onSwap}
        >
          {action}
        </Button>
      </div>
    </div>
  );
}
