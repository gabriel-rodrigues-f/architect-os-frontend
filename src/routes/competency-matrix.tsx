import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
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
  isCapabilityShortTaken,
  LEVELS,
  roleShort,
  type Competency,
  type Capability,
  type Level,
  type RequirementType,
} from "@/lib/domain";
import { authErrorMessage, useCurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import { usePageHelp } from "@/lib/page-help";
import { useCareerLevelsByRank, useStore } from "@/lib/store";

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

/**
 * B-38 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md) — a matriz
 * iterava `ROLES` (união hardcoded de 3 cargos) para renderizar/editar
 * `Competency.expected`; agora itera os níveis de carreira REAIS (já
 * data-driven — `repositories/career.ts` no backend), ordenados por
 * `rank` (I → II → III), indexando `expected` por `CareerLevel.id`, não
 * mais pelo texto do cargo.
 */
function MatrixPage() {
  const store = useStore();
  const careerLevels = useCareerLevelsByRank();
  /** Catálogo mestre é administrativo — backend já recusa o resto. */
  const isAdmin = useCurrentUser().role === "admin";
  const [creatingCapability, setCreatingCapability] = useState(false);
  const { t } = useI18n();
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
  const [editCapabilityShort, setEditCapabilityShort] = useState("");
  const [confirmDeleteCapability, setConfirmDeleteCapability] = useState<Capability | null>(null);
  const [search, setSearch] = useState("");
  const [curationFilter, setCurationFilter] = useState<"all" | "ready" | "needsCuration">("all");
  /**
   * REVISAO-360-FRONTEND, Seção 40-42 — a matriz inteira expandida chegava a
   * ~5000px (11 capacidades × até 6 competências cada, sempre renderizadas
   * abertas). Vazio por padrão agora significa "tudo recolhido" — o inverso
   * do comportamento anterior — e cada card guarda seu próprio estado, então
   * expandir uma capacidade não mexe nas outras.
   */
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
    setEditCapabilityShort(capability.short);
  };

  const saveEditingCapability = () => {
    if (!editingCapability) return;
    const trimmedName = editCapabilityName.trim();
    const trimmedShort = editCapabilityShort.trim();
    if (!trimmedName || !trimmedShort) return;
    // R2-ESC-02 — checagem no cliente é só UX (resposta imediata, sem
    // esperar o round-trip nem o flash de "otimista, depois desfeito").
    // `updateCapability` é fire-and-forget (`remote()`): se mesmo assim
    // colidir (corrida entre dois admins), o toast de erro já vem de lá.
    if (isCapabilityShortTaken(trimmedShort, store.capabilities, editingCapability.id)) {
      toast.error(t("cap.short.taken", { sigla: trimmedShort }));
      return;
    }
    store.updateCapability(editingCapability.id, { name: trimmedName, short: trimmedShort });
    toast.success(t("cap.edit.toast", { nome: trimmedName }));
    setEditingCapability(null);
  };

  const removeCapability = async () => {
    if (!confirmDeleteCapability) return;
    const { archived } = await store.removeCapability(confirmDeleteCapability.id);
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
            <Button onClick={() => setCreatingCapability(true)}>{t("matrix.newCapability")}</Button>
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
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-medium">{t("matrix.empty.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("matrix.empty.hint")}</p>
        </div>
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
          <div>
            <label className="block text-xs text-muted-foreground" htmlFor="matrix-curation-filter">
              {t("matrix.filter.curation")}
            </label>
            <select
              id="matrix-curation-filter"
              value={curationFilter}
              onChange={(e) => setCurationFilter(e.target.value as typeof curationFilter)}
              className="mt-1 rounded-md border border-input bg-card px-2 py-2 text-sm"
            >
              <option value="all">{t("matrix.filter.curation.all")}</option>
              <option value="ready">{t("matrix.filter.curation.ready")}</option>
              <option value="needsCuration">{t("matrix.filter.curation.needsCuration")}</option>
            </select>
          </div>
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
            <div className="surface-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {term
                  ? t("matrix.search.empty", { termo: search.trim() })
                  : t("matrix.filter.curation.empty")}
              </p>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {visibleCapabilities.map((cat) => {
              const comps = store.competencies.filter((c) => c.capabilityId === cat.id && c.active);
              /** Busca ativa força a expansão de todo grupo visível — já filtrado por casar com o termo, sem exigir um segundo clique pra ver por quê. */
              const isExpanded = expandedIds.has(cat.id) || term.length > 0;
              const atCapacity = cat.curation.activeCompetencyCount >= 6;
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
                            title={atCapacity ? t("matrix.atCapacity.hint") : undefined}
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
                                {roleShort(cl.name)}
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
            const { archived } = await store.removeCompetency(confirmDelete.competency.id);
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
          <div>
            {/* R2-ESC-02 — sigla editável e explícita: antes era sempre
                `nome.split(" ")[0]`, recalculada silenciosamente a cada
                edição de nome, sem checar se já pertencia a outra
                capacidade ("Arquitetura Corporativa"/"Arquitetura de
                Dados" coincidindo em "Arquitetura"). */}
            <Label htmlFor="capability-edit-short">{t("cap.field.short")}</Label>
            <Input
              id="capability-edit-short"
              value={editCapabilityShort}
              onChange={(e) => setEditCapabilityShort(e.target.value)}
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
    </>
  );
}

/**
 * R2-UX-12 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — padrão único de criação:
 * botão primário → modal, mesmo formato de `CompetencyCreateDialog` (que já
 * seguia esse padrão) em vez dos dois inputs soltos no cabeçalho de antes.
 */
function CapabilityCreateDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    const trimmedName = name.trim();
    // R2-ESC-02 — sigla nasce derivada só como sugestão (1ª palavra do
    // nome); o campo continua editável, não mais um valor fixo que colidia
    // entre nomes parecidos ("Arquitetura Corporativa"/"Arquitetura de
    // Dados" → os dois "Arquitetura").
    const trimmedShort = short.trim() || trimmedName.split(" ")[0] || trimmedName;
    if (!trimmedName || !trimmedShort) return;
    if (isCapabilityShortTaken(trimmedShort, store.capabilities)) {
      toast.error(t("cap.short.taken", { sigla: trimmedShort }));
      return;
    }
    setSaving(true);
    try {
      // B-32 — id gerado no servidor (nunca mais slug(nome), que colidia
      // entre duas capacidades de nome parecido).
      await store.addCapability({ name: trimmedName, short: trimmedShort, active: true });
      onClose();
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSaving(false);
    }
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
          <div>
            <Label htmlFor="new-capability-short">{t("cap.field.short")}</Label>
            <Input
              id="new-capability-short"
              value={short}
              onChange={(e) => setShort(e.target.value)}
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

/**
 * Capacidades e competências arquivados: fora da matriz ativa (não entram em
 * avaliação nova), mas não desaparecem — ficam aqui, restauráveis a
 * qualquer momento. Só existem porque já têm histórico vinculado; ver
 * `deleteCompetency`/`deleteCapability` no backend.
 */
function ArchivedCompetencies({
  capabilities,
  competencies,
}: {
  capabilities: Capability[];
  competencies: Competency[];
}) {
  const store = useStore();
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
              onClick={() => store.updateCapability(cat.id, { active: true })}
            >
              {t("matrix.restore")}
            </Button>
          </li>
        ))}
        {archivedCompetencies.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            <span>{c.name}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => store.updateCompetency(c.id, { active: true })}
            >
              {t("matrix.restore")}
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/**
 * Nível esperado por cargo nasce em branco — nunca 3/4/5 fabricado só para
 * satisfazer o formulário. Admin escolhe os três níveis antes de conseguir
 * salvar. Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 39.
 */
function CompetencyCreateDialog({
  capability,
  onClose,
}: {
  capability: Capability;
  onClose: () => void;
}) {
  const store = useStore();
  const careerLevels = useCareerLevelsByRank();
  const { t } = useI18n();
  const labels = useLabels();
  const restrictiveFull = capability.curation.restrictiveCompetencyCount >= 3;
  const nonRestrictiveFull = capability.curation.nonRestrictiveCompetencyCount >= 3;
  const [name, setName] = useState("");
  const [levels, setLevels] = useState<Partial<Record<string, Level>>>({});
  const [requirementType, setRequirementType] = useState<RequirementType>(
    nonRestrictiveFull ? "RESTRICTIVE" : "NON_RESTRICTIVE",
  );
  const canSave = name.trim().length > 0 && careerLevels.every((cl) => levels[cl.id] !== undefined);

  const save = async () => {
    if (!canSave) return;
    // B-32 — id gerado no servidor (nunca mais derivado do nome, que
    // colidia entre duas competências homônimas em capacidades distintas).
    try {
      await store.addCompetency({
        name: name.trim(),
        capabilityId: capability.id,
        requirementType,
        expected: levels as Record<string, Level>,
        active: true,
      });
      onClose();
    } catch (error) {
      toast.error(authErrorMessage(error));
    }
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
            {/* REVISAO-360-FRONTEND, FE-360-004 — mesmo padrão responsivo já
                aplicado no diálogo "Editar competência" (R10-UX-001);
                este de criação ainda usava grid-cols-3 rígido. */}
            <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {careerLevels.map((cl) => (
                <div key={cl.id} className="min-w-0">
                  <span className="block text-xs text-muted-foreground">{roleShort(cl.name)}</span>
                  <select
                    className="mt-1 w-full min-w-0 rounded-md border border-input bg-card px-2 py-2 text-sm"
                    value={levels[cl.id] ?? ""}
                    aria-label={`${t("matrix.edit.levels")} — ${roleShort(cl.name)}`}
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
                {t("matrix.requirement.restrictiveFull")}
              </p>
            )}
            {nonRestrictiveFull && (
              <p className="mt-1 text-xs text-amber-600">
                {t("matrix.requirement.nonRestrictiveFull")}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {t("matrix.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Nome, nível esperado por cargo e exigência (ENT-CAR-011) são o que o
 * diálogo edita. Trocar de capacidade é uma decisão de reorganização maior
 * (afeta relatórios agrupados por capacidade), não um ajuste pontual; fica
 * fora daqui.
 */
function CompetencyEditDialog({
  competency,
  onClose,
}: {
  competency: Competency;
  onClose: () => void;
}) {
  const store = useStore();
  const careerLevels = useCareerLevelsByRank();
  const { t } = useI18n();
  const labels = useLabels();
  const capability = store.capabilities.find((c) => c.id === competency.capabilityId);
  /** Subtrai a própria competência da contagem: ela já ocupa uma vaga do tipo atual. */
  const restrictiveFull =
    (capability?.curation.restrictiveCompetencyCount ?? 0) -
      (competency.requirementType === "RESTRICTIVE" ? 1 : 0) >=
    3;
  const nonRestrictiveFull =
    (capability?.curation.nonRestrictiveCompetencyCount ?? 0) -
      (competency.requirementType === "NON_RESTRICTIVE" ? 1 : 0) >=
    3;
  const [name, setName] = useState(competency.name);
  const [levels, setLevels] = useState<Partial<Record<string, Level>>>(competency.expected);
  const [requirementType, setRequirementType] = useState<RequirementType>(
    competency.requirementType,
  );

  /**
   * ORIENTACAO-NONA-RODADA — quando o lado de destino já está em 3/3, um
   * PATCH comum sempre recusa (por isso a opção continua desabilitada
   * abaixo). A única saída é trocar de lugar com uma competência existente
   * do outro tipo — `swap-requirement` no servidor, numa transação só, para
   * nunca passar por um estado fora de 3+3.
   */
  const [swapTargetId, setSwapTargetId] = useState("");
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  const restrictiveSiblings = store.competencies.filter(
    (c) =>
      c.capabilityId === competency.capabilityId &&
      c.active &&
      c.requirementType === "RESTRICTIVE" &&
      c.id !== competency.id,
  );
  const nonRestrictiveSiblings = store.competencies.filter(
    (c) =>
      c.capabilityId === competency.capabilityId &&
      c.active &&
      c.requirementType === "NON_RESTRICTIVE" &&
      c.id !== competency.id,
  );

  const swapWith = async () => {
    if (!swapTargetId) return;
    setSwapping(true);
    setSwapError(null);
    try {
      await store.swapCompetencyRequirement(competency.id, swapTargetId);
      // O servidor já confirmou a troca — esta competência agora É o tipo
      // que estava travado, sem precisar de um segundo PATCH para o campo.
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
    // PATCH faz merge (`jsonbMerge`, backend) — enviar só os níveis já
    // preenchidos não zera os demais do Perfil por Cargo.
    store.updateCompetency(competency.id, {
      name: name.trim(),
      expected: levels as Record<string, Level>,
      requirementType,
    });
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
                  <span className="block text-xs text-muted-foreground">{roleShort(cl.name)}</span>
                  <select
                    className="mt-1 w-full min-w-0 rounded-md border border-input bg-card px-2 py-2 text-sm"
                    value={levels[cl.id] ?? ""}
                    aria-label={`${t("matrix.edit.levels")} — ${roleShort(cl.name)}`}
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
                hint={t("matrix.requirement.restrictiveFull")}
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
                hint={t("matrix.requirement.nonRestrictiveFull")}
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

/**
 * Escolher com quem trocar de tipo, quando o lado de destino já está em
 * 3/3. Reaproveitado pelos dois sentidos (restritiva↔não restritiva) —
 * mesma UI, candidatos diferentes.
 */
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
