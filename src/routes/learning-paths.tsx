import { createFileRoute } from "@tanstack/react-router";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

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
import { useCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/text";
import { useLabels } from "@/lib/labels";
import type { LearningItemType, LearningPath, LearningPathItem } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/learning-paths")({
  head: () => ({
    meta: [
      { title: "Trilhas de Aprendizagem — Architect OS" },
      {
        name: "description",
        content:
          "Trilhas de desenvolvimento com cursos, labs, projetos, workshops e certificações.",
      },
      { property: "og:title", content: "Trilhas de Aprendizagem — Architect OS" },
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
  const [name, setName] = useState("");
  const { t } = useI18n();
  const [editingPath, setEditingPath] = useState<LearningPath | null>(null);

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    store.addLearningPath({
      id: `lp-${Date.now()}`,
      name: trimmed,
      description: "",
      competencyIds: [],
      assignedTo: [],
      items: [],
      createdBy: user.email,
      createdAt: new Date().toISOString(),
    });
    setName("");
  };

  /** Trilha sem autor registrado fica aberta para qualquer pessoa logada. */
  const canEdit = (path: LearningPath) =>
    !path.createdBy || path.createdBy.toLowerCase() === user.email.toLowerCase();

  return (
    <>
      <PageHeader
        title={t("path.title")}
        description="Trilhas combinam teoria e prática: cursos, laboratórios, projetos reais, apresentações e reviews."
        actions={
          <div className="flex gap-2">
            <Input
              placeholder={t("path.new.placeholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              className="w-52"
            />
            <Button onClick={create}>{t("path.new.action")}</Button>
          </div>
        }
      />

      {store.learningPaths.length === 0 && (
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-medium">Nenhuma trilha cadastrada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie a primeira trilha para organizar o desenvolvimento do time.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {store.learningPaths.map((path) => {
          const total = path.items.length
            ? Math.round(path.items.reduce((s, i) => s + i.progress, 0) / path.items.length)
            : 0;
          const editable = canEdit(path);
          const createdAt = formatDate(path.createdAt);

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
                      Editar
                    </Button>
                  ) : (
                    <span
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      title={`Somente ${path.createdBy} pode editar esta trilha`}
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Somente leitura
                    </span>
                  )}
                </div>
              }
            >
              <p className="mb-3 text-xs text-muted-foreground">
                {path.createdBy
                  ? t("path.createdBy", { autor: path.createdBy })
                  : t("path.noAuthor")}
                {createdAt ? ` · ${createdAt}` : ""}
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

              <ul className="divide-y divide-border">
                {path.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="w-24 shrink-0 rounded-md bg-secondary px-2 py-0.5 text-center text-xs">
                      {item.type}
                    </span>
                    <div className="min-w-40 flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.hours}h estimadas · {labels.learningStatus[item.status]}
                      </p>
                    </div>
                    <div className="flex w-52 items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={10}
                        value={item.progress}
                        aria-label={`Progresso de ${item.title}`}
                        onChange={(e) =>
                          store.updateLearningItem(path.id, item.id, Number(e.target.value))
                        }
                        className="w-full accent-[var(--primary)]"
                      />
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                        {item.progress}%
                      </span>
                    </div>
                  </li>
                ))}
                {!path.items.length && (
                  <p className="py-2 text-sm text-muted-foreground">Trilha ainda sem itens.</p>
                )}
              </ul>
            </SectionCard>
          );
        })}
      </div>

      {editingPath && (
        <EditPathDialog
          path={store.learningPaths.find((p) => p.id === editingPath.id) ?? editingPath}
          onClose={() => setEditingPath(null)}
        />
      )}
    </>
  );
}

/** Edição completa da trilha: dados, competências, atribuições e itens. */
function EditPathDialog({ path, onClose }: { path: LearningPath; onClose: () => void }) {
  const store = useStore();
  const { t } = useI18n();
  const [form, setForm] = useState({ name: path.name, description: path.description });
  const [newItem, setNewItem] = useState({
    title: "",
    type: ITEM_TYPES[0] as LearningItemType,
    hours: "4",
  });

  const saveDetails = () => {
    store.updateLearningPath(path.id, {
      name: form.name.trim() || path.name,
      description: form.description,
    });
    onClose();
  };

  const toggle = (field: "competencyIds" | "assignedTo", id: string) => {
    const current = path[field];
    store.updateLearningPath(path.id, {
      [field]: current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    });
  };

  const addItem = () => {
    const title = newItem.title.trim();
    if (!title) return;
    const item: LearningPathItem = {
      id: `lpi-${Date.now()}`,
      title,
      type: newItem.type,
      hours: Number(newItem.hours) || 1,
      status: "Not Started",
      progress: 0,
    };
    store.addLearningPathItem(path.id, item);
    setNewItem({ title: "", type: ITEM_TYPES[0] as LearningItemType, hours: "4" });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
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
                <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                  <select
                    className="w-32 shrink-0 rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                    value={item.type}
                    aria-label={`Tipo de ${item.title}`}
                    onChange={(e) =>
                      store.updateLearningPath(path.id, {
                        items: path.items.map((i) =>
                          i.id === item.id ? { ...i, type: e.target.value as LearningItemType } : i,
                        ),
                      })
                    }
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={item.title}
                    aria-label={`Título de ${item.title}`}
                    onChange={(e) =>
                      store.updateLearningPath(path.id, {
                        items: path.items.map((i) =>
                          i.id === item.id ? { ...i, title: e.target.value } : i,
                        ),
                      })
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    value={item.hours}
                    aria-label={`Horas de ${item.title}`}
                    onChange={(e) =>
                      store.updateLearningPath(path.id, {
                        items: path.items.map((i) =>
                          i.id === item.id ? { ...i, hours: Number(e.target.value) || 0 } : i,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => store.removeLearningPathItem(path.id, item.id)}
                    aria-label={`Excluir ${item.title}`}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
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
                {ITEM_TYPES.map((t) => (
                  <option key={t}>{t}</option>
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
                Adicionar
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("path.edit.competencies")}</Label>
              <div className="mt-2 max-h-40 overflow-y-auto surface-inset p-2">
                {store.competencies.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      checked={path.competencyIds.includes(c.id)}
                      onChange={() => toggle("competencyIds", c.id)}
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>{t("path.edit.assignedTo")}</Label>
              <div className="mt-2 max-h-40 overflow-y-auto surface-inset p-2">
                {store.architects.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      checked={path.assignedTo.includes(a.id)}
                      onChange={() => toggle("assignedTo", a.id)}
                    />
                    <span className="truncate">{a.name}</span>
                  </label>
                ))}
                {store.architects.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum arquiteto cadastrado.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          <Button
            variant="destructive"
            onClick={() => {
              store.removeLearningPath(path.id);
              onClose();
            }}
          >
            Excluir trilha
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button onClick={saveDetails}>{t("path.edit.save")}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
