import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Bar, PageHeader, SectionCard } from "@/components/app/ui-bits";
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
} from "@/components/ui/dialog";
import { isLeadCapable } from "@/lib/api";
import { authErrorMessage, useCurrentUser } from "@/lib/auth";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { defaultDateFormatter, defaultNameFormatter } from "@/lib/text";
import { useLabels } from "@/lib/labels";
import { type LearningItemType, type LearningPath, type LearningPathItem } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useSelectors, useStore } from "@/lib/store";
import { LearningPathsViewModel } from "@/lib/view-models/learning-paths-view-model";

/**
 * OO2-08 — mesma convenção de `useTeamViewModel`/`useDevelopmentPlansViewModel`/
 * `useCompetencyMatrixViewModel`: `store` já é o serviço narrow que o
 * `LearningPathsViewModel` precisa, sem `FrontendContainer`/`useContainer()`.
 */
function useLearningPathsViewModel(): LearningPathsViewModel {
  const store = useStore();
  return useMemo(() => new LearningPathsViewModel(store), [store]);
}

export const Route = createFileRoute("/learning-paths")({
  head: () => ({
    meta: [
      { title: "Trilhas de Aprendizagem — Synapse" },
      {
        name: "description",
        content:
          "Trilhas de desenvolvimento com cursos, labs, projetos, workshops e certificações.",
      },
      { property: "og:title", content: "Trilhas de Aprendizagem — Synapse" },
      {
        property: "og:description",
        content: "Trilhas técnicas com progresso, evidências e responsáveis.",
      },
    ],
  }),
  component: LearningPage,
});

const ITEM_TYPES: LearningItemType[] = [
  "Curso",
  "Vídeo",
  "Livro",
  "Artigo",
  "Laboratório",
  "Desafio",
  "Projeto",
  "Certificação",
  "Apresentação",
  "Workshop",
];

function LearningPage() {
  const store = useStore();
  const sel = useSelectors();
  const user = useCurrentUser();
  const labels = useLabels();
  const vm = useLearningPathsViewModel();
  const { t, locale } = useI18n();
  const help = usePageHelp("learningPaths");
  const [editingPath, setEditingPath] = useState<LearningPath | null>(null);
  const [creatingPath, setCreatingPath] = useState(false);
  const [search, setSearch] = useState("");
  /**
   * REVISAO-360-FRONTEND, Seção 34 — cada trilha sempre renderizava a lista
   * inteira de itens × pessoas atribuídas (o que chegava a ~2500px com
   * poucas trilhas de tamanho médio). Nasce recolhida — mesmo padrão da
   * Matriz de Competências (Seção 40-42): resumo sempre visível, detalhe só
   * sob demanda, um card por vez ou "Expandir tudo".
   */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /**
   * Catálogo é curadoria de Lead/Admin — antes qualquer autenticado criava
   * uma trilha global, misturando iniciativa individual com o catálogo
   * oficial. Ver AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-SYNAPSE.md, EPIC 4.
   */
  const canCreatePath = isLeadCapable(user.role);

  /**
   * Espelha `canEditPath` do backend: autor (por id, não mais por e-mail) ou
   * admin; trilha sem autor (dado anterior a esta migração) fica restrita a
   * quem já tem poder de curadoria — Lead ou Admin, nunca "qualquer pessoa
   * logada" como antes.
   */
  const canEdit = (path: LearningPath) => {
    if (user.role === "admin") return true;
    if (path.createdByUserId) return path.createdByUserId === user.id;
    return user.role === "lead";
  };

  /**
   * Progresso é execução, não edição da trilha: só a própria pessoa, ou o
   * Tech Lead responsável por ela (não qualquer Lead da empresa), registra o
   * progresso dela — espelha `canActFor` do backend (`PATCH .../progress`),
   * não o `isLeadCapable(role)` genérico que liberava o campo pra Lead de
   * outra equipe. Ver UX-001, AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-
   * 19.md.
   */
  const canEditProgress = (architectId: string) =>
    defaultUiAuthorizationPolicy.canActFor(user, sel.architectById(architectId));

  return (
    <>
      <PageHeader
        title={t("path.title")}
        description={t("path.subtitle")}
        help={help}
        actions={
          canCreatePath ? (
            <Button onClick={() => setCreatingPath(true)}>{t("path.new.placeholder")}</Button>
          ) : undefined
        }
      />

      {store.learningPaths.length === 0 && (
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-medium">{t("path.empty.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("path.empty.hint")}</p>
        </div>
      )}

      {store.learningPaths.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              placeholder={t("path.search.placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t("path.search.placeholder")}
              className="max-w-sm"
            />
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedIds(new Set(store.learningPaths.map((p) => p.id)))}
            >
              {t("path.expandAll")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExpandedIds(new Set())}>
              {t("path.collapseAll")}
            </Button>
          </div>
        </div>
      )}

      {(() => {
        const term = search.trim().toLowerCase();
        const visiblePaths = term
          ? store.learningPaths.filter(
              (path) =>
                path.name.toLowerCase().includes(term) ||
                path.competencyIds.some((cid) =>
                  (sel.competencyById(cid)?.name ?? "").toLowerCase().includes(term),
                ) ||
                path.assignedTo.some((aid) =>
                  (sel.architectById(aid)?.name ?? "").toLowerCase().includes(term),
                ),
            )
          : store.learningPaths;

        if (term && visiblePaths.length === 0) {
          return (
            <div className="surface-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t("path.search.empty", { termo: search.trim() })}
              </p>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {visiblePaths.map((path) => {
              /**
               * Progresso do card é a média entre as pessoas atribuídas — cada
               * uma com a própria média entre os itens (OO3-11l:
               * `LearningPathsViewModel.teamProgressPercent`).
               */
              const total = vm.teamProgressPercent(path);
              const editable = canEdit(path);
              const createdAt = defaultDateFormatter.formatDate(path.createdAt, locale);
              const isExpanded = expandedIds.has(path.id) || term.length > 0;

              return (
                <SectionCard
                  key={path.id}
                  title={path.name}
                  description={path.description}
                  actions={
                    <div className="flex items-center gap-3">
                      <div className="w-40">
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                          <span>{t("path.progress")}</span>
                          <span className="tabular-nums">{total}%</span>
                        </div>
                        <Bar value={total} />
                      </div>
                      {editable ? (
                        <Button variant="outline" size="sm" onClick={() => setEditingPath(path)}>
                          <Pencil className="h-3.5 w-3.5" />
                          {t("common.edit")}
                        </Button>
                      ) : (
                        <span
                          className="flex items-center gap-1.5 text-xs text-muted-foreground"
                          title={t("path.readOnly.hint", { autor: path.createdBy ?? "" })}
                        >
                          <Lock className="h-3.5 w-3.5" />
                          {t("path.readOnly.badge")}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(path.id)}
                        aria-label={
                          isExpanded
                            ? t("path.collapse.collapse", { nome: path.name })
                            : t("path.collapse.expand", { nome: path.name })
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
                  <p className="mb-3 text-xs text-muted-foreground">
                    {path.createdBy
                      ? t("path.createdBy", { autor: path.createdBy })
                      : t("path.noAuthor")}
                    {createdAt ? ` · ${createdAt}` : ""}
                    {" · "}
                    {t("path.summary.items", { n: path.items.length })}
                    {" · "}
                    {t("path.summary.people", { n: path.assignedTo.length })}
                  </p>

                  <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
                    {path.competencyIds.map((cid) => (
                      <span key={cid} className="rounded-md bg-secondary px-2 py-0.5">
                        {sel.competencyById(cid)?.name ?? cid}
                      </span>
                    ))}
                    {path.assignedTo.map((aid) => (
                      <span key={aid} className="rounded-md border border-border px-2 py-0.5">
                        {sel.architectById(aid)?.name ?? aid}
                      </span>
                    ))}
                  </div>

                  {isExpanded && (
                    <ul className="divide-y divide-border">
                      {path.items.map((item) => (
                        <li key={item.id} className="py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="w-24 shrink-0 rounded-md bg-secondary px-2 py-0.5 text-center text-xs">
                              {item.type}
                            </span>
                            <div className="min-w-40 flex-1">
                              <p className="text-sm font-medium">{item.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {t("path.item.hoursEstimate", { n: item.hours })}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {path.assignedTo.map((architectId) => {
                              const person = sel.architectById(architectId);
                              const prog = vm.progressFor(path, architectId, item.id);
                              const nome = person?.name ?? architectId;
                              return (
                                <div key={architectId} className="flex items-center gap-2 pl-2">
                                  <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                                    {nome}
                                  </span>
                                  <ProgressControl
                                    progress={prog.progress}
                                    statusLabel={labels.learningStatus[prog.status]}
                                    editable={canEditProgress(architectId)}
                                    ariaLabel={t("path.item.progressAriaLabel", {
                                      nome,
                                      item: item.title,
                                    })}
                                    onCommit={(value) =>
                                      vm.recordProgress(path.id, architectId, item.id, value)
                                    }
                                  />
                                </div>
                              );
                            })}
                            {path.assignedTo.length === 0 && (
                              <p className="pl-2 text-xs text-muted-foreground">
                                {t("path.item.noAssignee")}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                      {!path.items.length && (
                        <p className="py-2 text-sm text-muted-foreground">
                          {t("path.card.noItems")}
                        </p>
                      )}
                    </ul>
                  )}
                </SectionCard>
              );
            })}
          </div>
        );
      })()}

      {editingPath && (
        <EditPathDialog
          path={store.learningPaths.find((p) => p.id === editingPath.id) ?? editingPath}
          onClose={() => setEditingPath(null)}
        />
      )}
      {creatingPath && <CreatePathDialog onClose={() => setCreatingPath(false)} />}
    </>
  );
}

/**
 * R2-UX-12 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — mata a criação em 2 tempos
 * (nome solto → criar → só depois abrir "Editar" pra preencher o resto).
 * Reaproveita o corpo de `EditPathDialog` (nome, descrição, competências,
 * atribuições) — os "itens" da trilha ficam de fora daqui de propósito:
 * `addLearningPathItem` exige um `path.id` real, que só existe depois do
 * primeiro save; continuam entrando depois, em "Editar trilha".
 */
function CreatePathDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const user = useCurrentUser();
  const { t } = useI18n();
  const vm = useLearningPathsViewModel();
  const [form, setForm] = useState({ name: "", description: "" });
  const [competencyIds, setCompetencyIds] = useState<string[]>([]);
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  /** R2-ESC-07 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — filtro local acima de 20 competências. */
  const [competencyFilter, setCompetencyFilter] = useState("");
  const visibleCompetencies = store.competencies.filter((c) =>
    defaultNameFormatter.matchesSearch(c.name, competencyFilter.trim().toLowerCase()),
  );

  const assignableArchitects = vm.assignableArchitects(store.architects, []);

  const toggle = (field: "competencyIds" | "assignedTo", id: string) => {
    if (field === "competencyIds") {
      setCompetencyIds((prev) =>
        prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
      );
    } else {
      setAssignedTo((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
    }
  };

  /**
   * Sem id local nem sucesso otimista: o servidor gera o id de verdade — ver
   * AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, IDOR-001.
   */
  const create = async () => {
    const trimmed = form.name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await vm.createPath(user, form, competencyIds, assignedTo);
      toast.success(t("path.new.toast", { nome: trimmed }));
      onClose();
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("path.new.placeholder")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="new-path-name">{t("path.edit.name")}</Label>
            <Input
              id="new-path-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </div>
          <div>
            <Label htmlFor="new-path-description">{t("path.edit.description")}</Label>
            <Textarea
              id="new-path-description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("path.edit.competencies")}</Label>
              {store.competencies.length > 20 && (
                <Input
                  aria-label={t("common.searchCompetency")}
                  placeholder={t("common.searchCompetency")}
                  value={competencyFilter}
                  onChange={(e) => setCompetencyFilter(e.target.value)}
                  className="mt-2"
                />
              )}
              <div className="mt-2 max-h-40 overflow-y-auto surface-inset p-2">
                {visibleCompetencies.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      checked={competencyIds.includes(c.id)}
                      onChange={() => toggle("competencyIds", c.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  </label>
                ))}
                {visibleCompetencies.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("common.noCompetencyFound")}</p>
                )}
              </div>
            </div>
            <div>
              <Label>{t("path.edit.assignedTo")}</Label>
              <div className="mt-2 max-h-40 overflow-y-auto surface-inset p-2">
                {assignableArchitects.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      checked={assignedTo.includes(a.id)}
                      onChange={() => toggle("assignedTo", a.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  </label>
                ))}
                {assignableArchitects.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("filter.noArchitects")}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={create} disabled={!form.name.trim() || saving}>
            {t("path.new.action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * B-33 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §12.4) — o slider
 * disparava um PATCH a cada passo do arrasto (`onChange` de `<input
 * type="range">` é contínuo, não só no soltar). Estado local (`draft`) dá o
 * movimento do thumb e o "%" instantâneo; o PATCH só sai ao soltar
 * (`onMouseUp`/`onTouchEnd`) ou ao ajustar por teclado (`onKeyUp`, sem
 * "soltar" nenhum). O rótulo de status (`statusLabel`, "Em andamento" etc.)
 * continua refletindo só o servidor — não duplica a regra de threshold do
 * store (`>=100`/`>0`/senão) só por causa do feedback visual do arrasto.
 */
function ProgressControl({
  progress,
  editable,
  ariaLabel,
  statusLabel,
  onCommit,
}: {
  progress: number;
  editable: boolean;
  ariaLabel: string;
  statusLabel: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(progress);
  useEffect(() => setDraft(progress), [progress]);
  const commit = () => {
    if (draft !== progress) onCommit(draft);
  };

  if (!editable) {
    return (
      <>
        <Bar value={progress} className="flex-1" />
        <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {progress}% · {statusLabel}
        </span>
      </>
    );
  }

  return (
    <>
      <input
        type="range"
        min={0}
        max={100}
        step={10}
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(Number(e.target.value))}
        onMouseUp={commit}
        onTouchEnd={commit}
        onKeyUp={commit}
        className="w-full accent-[var(--primary)]"
      />
      <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {draft}% · {statusLabel}
      </span>
    </>
  );
}

/** Edição completa da trilha: dados, competências, atribuições e itens. */
function EditPathDialog({ path, onClose }: { path: LearningPath; onClose: () => void }) {
  const store = useStore();
  const { t } = useI18n();
  const labels = useLabels();
  const vm = useLearningPathsViewModel();
  const [form, setForm] = useState({ name: path.name, description: path.description });
  const [newItem, setNewItem] = useState({
    title: "",
    type: ITEM_TYPES[0] as LearningItemType,
    hours: "4",
  });
  /** R2-ESC-07 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — filtro local acima de 20 competências. */
  const [competencyFilter, setCompetencyFilter] = useState("");
  const visibleCompetencies = store.competencies.filter((c) =>
    defaultNameFormatter.matchesSearch(c.name, competencyFilter.trim().toLowerCase()),
  );

  const saveDetails = () => {
    vm.updateDetails(path, form);
    toast.success(t("path.edit.toast", { nome: form.name.trim() || path.name }));
    onClose();
  };

  const toggle = (field: "competencyIds" | "assignedTo", id: string) => {
    if (field === "competencyIds") vm.toggleCompetency(path, id);
    else vm.toggleAssignment(path, id);
  };

  /**
   * Atribuir trilha nova é para o time atual — quem já saiu não é opção nova.
   * Quem já estava atribuído antes de sair continua na lista (senão a
   * atribuição existente ficaria invisível, sem jeito de desmarcar). Ver
   * AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC E.
   */
  const assignableArchitects = vm.assignableArchitects(store.architects, path.assignedTo);

  const addItem = () => {
    const title = newItem.title.trim();
    if (!title) return;
    vm.addItem(path.id, newItem.title, newItem.type, newItem.hours);
    setNewItem({ title: "", type: ITEM_TYPES[0] as LearningItemType, hours: "4" });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("path.edit.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="path-name">{t("path.edit.name")}</Label>
            <Input
              id="path-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="path-description">{t("path.edit.description")}</Label>
            <Textarea
              id="path-description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <Label>{t("path.edit.items")}</Label>
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {path.items.length > 0 && (
                <li className="flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span className="w-32 shrink-0">{t("path.col.type")}</span>
                  <span className="flex-1">{t("path.col.name")}</span>
                  <span className="w-20 shrink-0">{t("path.col.hours")}</span>
                  {/* espaço da lixeira, para as colunas alinharem com as linhas */}
                  <span className="w-9 shrink-0" aria-hidden="true" />
                </li>
              )}
              {path.items.map((item) => (
                <LearningPathItemRow
                  key={item.id}
                  item={item}
                  onUpdateType={(type) => vm.updateItem(path, item.id, { type })}
                  onUpdateTitle={(title) => vm.updateItem(path, item.id, { title })}
                  onUpdateHours={(hours) => vm.updateItem(path, item.id, { hours })}
                  onRemove={() => vm.removeItem(path.id, item.id)}
                />
              ))}
              {path.items.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">{t("path.edit.noItems")}</p>
              )}
            </ul>

            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="item-title">{t("path.edit.newItem")}</Label>
                <Input
                  id="item-title"
                  placeholder={t("path.edit.itemTitle")}
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                />
              </div>
              <select
                className="h-9 rounded-md border border-input bg-card px-2 text-sm"
                value={newItem.type}
                aria-label={t("path.edit.itemType")}
                onChange={(e) =>
                  setNewItem({ ...newItem, type: e.target.value as LearningItemType })
                }
              >
                {ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {labels.learningItemType[type]}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={0}
                className="w-20"
                value={newItem.hours}
                aria-label={t("path.edit.itemHours")}
                onChange={(e) => setNewItem({ ...newItem, hours: e.target.value })}
              />
              <Button variant="outline" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" />
                {t("path.edit.addItem")}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("path.edit.competencies")}</Label>
              {store.competencies.length > 20 && (
                <Input
                  aria-label={t("common.searchCompetency")}
                  placeholder={t("common.searchCompetency")}
                  value={competencyFilter}
                  onChange={(e) => setCompetencyFilter(e.target.value)}
                  className="mt-2"
                />
              )}
              <div className="mt-2 max-h-40 overflow-y-auto surface-inset p-2">
                {visibleCompetencies.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      checked={path.competencyIds.includes(c.id)}
                      onChange={() => toggle("competencyIds", c.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  </label>
                ))}
                {visibleCompetencies.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("common.noCompetencyFound")}</p>
                )}
              </div>
            </div>
            <div>
              <Label>{t("path.edit.assignedTo")}</Label>
              <div className="mt-2 max-h-40 overflow-y-auto surface-inset p-2">
                {assignableArchitects.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      checked={path.assignedTo.includes(a.id)}
                      onChange={() => toggle("assignedTo", a.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  </label>
                ))}
                {assignableArchitects.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("filter.noArchitects")}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            variant="destructive"
            onClick={() => {
              vm.removePath(path.id);
              toast.success(t("path.delete.toast", { nome: path.name }));
              onClose();
            }}
          >
            {t("path.delete.action")}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {t("path.edit.close")}
            </Button>
            <Button onClick={saveDetails}>{t("path.edit.save")}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * B-33 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §12.4) — título e
 * horas mandavam o array `items` inteiro por tecla digitada (`onChange`
 * chamando `store.updateLearningPath` direto). Mesmo padrão de
 * blur-save já usado em `ActionPlanField` (`development-plans.tsx`):
 * estado local (`draft`) dá o feedback instantâneo de digitação, o PATCH
 * só sai no `blur`. `type` continua imediato — um `<select>` não tem
 * problema de flooding por tecla.
 */
function LearningPathItemRow({
  item,
  onUpdateType,
  onUpdateTitle,
  onUpdateHours,
  onRemove,
}: {
  item: LearningPathItem;
  onUpdateType: (type: LearningItemType) => void;
  onUpdateTitle: (title: string) => void;
  onUpdateHours: (hours: number) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const labels = useLabels();
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [hoursDraft, setHoursDraft] = useState(String(item.hours));

  useEffect(() => setTitleDraft(item.title), [item.title]);
  useEffect(() => setHoursDraft(String(item.hours)), [item.hours]);

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <select
        className="w-32 shrink-0 rounded-md border border-input bg-card px-2 py-1.5 text-sm"
        value={item.type}
        aria-label={t("path.item.typeAriaLabel", { item: item.title })}
        onChange={(e) => onUpdateType(e.target.value as LearningItemType)}
      >
        {ITEM_TYPES.map((type) => (
          <option key={type} value={type}>
            {labels.learningItemType[type]}
          </option>
        ))}
      </select>
      <Input
        value={titleDraft}
        aria-label={t("path.item.titleAriaLabel", { item: item.title })}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={() => {
          if (titleDraft !== item.title) onUpdateTitle(titleDraft);
        }}
      />
      <Input
        type="number"
        min={0}
        className="w-20"
        value={hoursDraft}
        aria-label={t("path.item.hoursAriaLabel", { item: item.title })}
        onChange={(e) => setHoursDraft(e.target.value)}
        onBlur={() => {
          const hours = Number(hoursDraft) || 0;
          setHoursDraft(String(hours));
          if (hours !== item.hours) onUpdateHours(hours);
        }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("path.item.deleteAriaLabel", { item: item.title })}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
