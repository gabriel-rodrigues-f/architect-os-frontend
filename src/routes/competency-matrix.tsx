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
  LEVELS,
  ROLES,
  roleShort,
  type Competency,
  type Capability,
  type Level,
  type RequirementType,
  type RoleName,
} from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { slug } from "@/lib/text";

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
 * O id da compet\u00eancia \u00e9 derivado do **id do dom\u00ednio**, n\u00e3o da sigla: dom\u00ednios
 * diferentes podem compartilhar a mesma sigla (as capacidades novas usam a
 * primeira palavra do nome), e nesse caso duas compet\u00eancias hom\u00f4nimas em
 * dom\u00ednios distintos colidiriam no mesmo id \u2014 a segunda sobrescreveria a
 * primeira e excluir uma delas apagaria as duas.
 */
const competencyId = (capability: Capability, name: string) => slug(`${capability.id}-${name}`);

function MatrixPage() {
  const store = useStore();
  /** Catálogo mestre é administrativo — backend já recusa o resto. */
  const isAdmin = useCurrentUser().role === "admin";
  const [newCapability, setNewCapability] = useState("");
  const { t } = useI18n();
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
  /** Vazio por padrão: nenhuma seção começa recolhida — evita telas que já dependem de ver a tabela sem interação extra. */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
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
    const trimmed = editCapabilityName.trim();
    if (!trimmed) return;
    store.updateCapability(editingCapability.id, {
      name: trimmed,
      short: trimmed.split(" ")[0] ?? trimmed,
    });
    toast.success(t("cap.edit.toast", { nome: trimmed }));
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
        actions={
          isAdmin ? (
            <div className="flex gap-2">
              <Input
                placeholder={t("matrix.newCapability")}
                value={newCapability}
                onChange={(e) => setNewCapability(e.target.value)}
                className="w-48"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (!newCapability.trim()) return;
                  store.addCapability({
                    id: slug(newCapability),
                    name: newCapability,
                    short: newCapability.split(" ")[0] ?? newCapability,
                    active: true,
                  });
                  setNewCapability("");
                }}
              >
                {t("matrix.add")}
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
              <p className="mt-2 text-xs text-muted-foreground">{l.description}</p>
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
        <div className="mb-4">
          <Input
            placeholder={t("matrix.search.placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("matrix.search.placeholder")}
            className="max-w-sm"
          />
        </div>
      )}

      {(() => {
        const term = search.trim().toLowerCase();
        const activeCapabilities = store.capabilities.filter((cat) => cat.active);
        const visibleCapabilities = term
          ? activeCapabilities.filter(
              (cat) =>
                cat.name.toLowerCase().includes(term) ||
                store.competencies.some(
                  (c) => c.capabilityId === cat.id && c.active && c.name.toLowerCase().includes(term),
                ),
            )
          : activeCapabilities;

        if (term && visibleCapabilities.length === 0) {
          return (
            <div className="surface-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("matrix.search.empty", { termo: search.trim() })}
              </p>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {visibleCapabilities.map((cat) => {
              const comps = store.competencies.filter((c) => c.capabilityId === cat.id && c.active);
              const isCollapsed = collapsed.has(cat.id);
              const atCapacity = cat.curation.activeCompetencyCount >= 6;
              return (
                <SectionCard
                  key={cat.id}
                  title={cat.name}
                  description={`${t("matrix.competencyCount", { n: cat.curation.activeCompetencyCount })} · ${t("matrix.requirement.count", { restrictive: cat.curation.restrictiveCompetencyCount })} · ${t("matrix.requirement.nonRestrictiveCount", { n: cat.curation.nonRestrictiveCompetencyCount })}`}
                  actions={
                    <div className="flex items-center gap-2">
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
                            aria-label={`Editar ${cat.name}`}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteCapability(cat)}
                            aria-label={`Excluir ${cat.name}`}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(cat.id)}
                        aria-label={
                          isCollapsed ? t("matrix.collapse.expand", { nome: cat.name }) : t("matrix.collapse.collapse", { nome: cat.name })
                        }
                        aria-expanded={!isCollapsed}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        {isCollapsed ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronUp className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  }
                >
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="py-2">{t("col.competency")}</th>
                            {ROLES.map((r) => (
                              <th key={r} className="py-2 text-center">
                                {roleShort(r)}
                              </th>
                            ))}
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {comps.map((c) => (
                            <tr key={c.id} className="border-b border-border/60 last:border-0">
                              <td className="py-2 font-medium">
                                {c.name}
                                {c.requirementType === "RESTRICTIVE" && (
                                  <Badge variant="outline" className="ml-2 align-middle text-[10px]">
                                    {t("matrix.requirement.badge")}
                                  </Badge>
                                )}
                              </td>
                              {ROLES.map((r) => (
                                <td key={r} className="py-2 text-center">
                                  <LevelBadge level={c.expected[r]} />
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
                                      aria-label={`Excluir ${c.name}`}
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
        title={
          <>
            Tem certeza que deseja excluir {confirmDelete?.competency.name} de{" "}
            {confirmDelete?.capability.name}?
          </>
        }
        description="Se a competência já foi usada em alguma avaliação, PDI, evidência ou trilha, ela é arquivada (some da matriz ativa, mas o histórico continua íntegro) em vez de excluída."
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
        title={`Excluir ${confirmDeleteCapability?.name}?`}
        description={
          confirmDeleteCapability && capabilityCompetencyCount(confirmDeleteCapability.id) > 0
            ? `Se alguma das ${capabilityCompetencyCount(confirmDeleteCapability.id)} competências desta capacidade já foi usada em avaliação, PDI, evidência ou trilha, a capacidade e as competências dela são arquivadas em vez de excluídas — o histórico continua íntegro.`
            : "Esta capacidade não tem competências cadastradas."
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
    </>
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
  const { t } = useI18n();
  const restrictiveFull = capability.curation.restrictiveCompetencyCount >= 3;
  const nonRestrictiveFull = capability.curation.nonRestrictiveCompetencyCount >= 3;
  const [name, setName] = useState("");
  const [levels, setLevels] = useState<Partial<Record<RoleName, Level>>>({});
  const [requirementType, setRequirementType] = useState<RequirementType>(
    nonRestrictiveFull ? "RESTRICTIVE" : "NON_RESTRICTIVE",
  );
  const canSave = name.trim().length > 0 && ROLES.every((r) => levels[r] !== undefined);

  const save = () => {
    if (!canSave) return;
    store.addCompetency({
      id: competencyId(capability, name.trim()),
      name: name.trim(),
      capabilityId: capability.id,
      requirementType,
      expected: levels as Record<RoleName, Level>,
      active: true,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
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
            <div className="mt-1 grid grid-cols-3 gap-3">
              {ROLES.map((r) => (
                <div key={r}>
                  <span className="block text-xs text-muted-foreground">{roleShort(r)}</span>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-card px-2 py-2 text-sm"
                    value={levels[r] ?? ""}
                    aria-label={`${t("matrix.edit.levels")} — ${roleShort(r)}`}
                    onChange={(e) =>
                      setLevels({
                        ...levels,
                        [r]: e.target.value ? (Number(e.target.value) as Level) : undefined,
                      })
                    }
                  >
                    <option value="">—</option>
                    {LEVELS.map((l) => (
                      <option key={l.level} value={l.level}>
                        L{l.level} · {l.name}
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
              <p className="mt-1 text-xs text-amber-600">{t("matrix.requirement.restrictiveFull")}</p>
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
  const { t } = useI18n();
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
  const [levels, setLevels] = useState<Record<RoleName, Level>>(competency.expected);
  const [requirementType, setRequirementType] = useState<RequirementType>(
    competency.requirementType,
  );

  const save = () => {
    if (!name.trim()) return;
    store.updateCompetency(competency.id, { name: name.trim(), expected: levels, requirementType });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
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
            <div className="mt-1 grid grid-cols-3 gap-3">
              {ROLES.map((r) => (
                <div key={r}>
                  <span className="block text-xs text-muted-foreground">{roleShort(r)}</span>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-card px-2 py-2 text-sm"
                    value={levels[r]}
                    aria-label={`${t("matrix.edit.levels")} — ${roleShort(r)}`}
                    onChange={(e) => setLevels({ ...levels, [r]: Number(e.target.value) as Level })}
                  >
                    {LEVELS.map((l) => (
                      <option key={l.level} value={l.level}>
                        L{l.level} · {l.name}
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
              <p className="mt-1 text-xs text-amber-600">{t("matrix.requirement.restrictiveFull")}</p>
            )}
            {nonRestrictiveFull && requirementType !== "NON_RESTRICTIVE" && (
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
          <Button onClick={save}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
