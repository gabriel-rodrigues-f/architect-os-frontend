import { createFileRoute } from "@tanstack/react-router";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { formatDate } from "@/lib/text";
import { useLabels } from "@/lib/labels";
import {
  progressFor,
  type LearningItemType,
  type LearningPath,
  type LearningPathItem,
} from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { useSelectors, useStore } from "@/lib/store";

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
  const [name, setName] = useState("");
  const { t, locale } = useI18n();
  const [editingPath, setEditingPath] = useState<LearningPath | null>(null);

  /**
   * Catálogo é curadoria de Lead/Admin — antes qualquer autenticado criava
   * uma trilha global, misturando iniciativa individual com o catálogo
   * oficial. Ver AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-SYNAPSE.md, EPIC 4.
   */
  const canCreatePath = isLeadCapable(user.role);

  /**
   * Sem id local nem sucesso otimista: o servidor gera o id de verdade — ver
   * AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, IDOR-001.
   */
  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await store.addLearningPath({
        id: "",
        name: trimmed,
        description: "",
        competencyIds: [],
        assignedTo: [],
        items: [],
        progress: [],
        createdBy: user.email,
        createdByUserId: user.id,
        createdAt: new Date().toISOString(),
      });
      setName("");
    } catch (error) {
      toast.error(authErrorMessage(error));
    }
  };

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
   * Progresso é execução, não edição da trilha: só a própria pessoa (ou o
   * Tech Lead dela) registra o progresso dela — nunca quem só está de
   * passagem pela tela de outra pessoa.
   */
  const canEditProgress = (architectId: string) =>
    isLeadCapable(user.role) || user.architectId === architectId;

  return (
    <>
      <PageHeader
        title={t("path.title")}
        description="Trilhas combinam teoria e prática: cursos, laboratórios, projetos reais, apresentações e reviews."
        actions={
          canCreatePath ? (
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
          ) : undefined
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
          /**
           * Progresso do card é a média entre as pessoas atribuídas — cada
           * uma com a própria média entre os itens. Antes, `item.progress`
           * era um valor só; agora cada pessoa tem o dela (progressFor).
           */
          const perPerson = path.assignedTo.map((architectId) => {
            const values = path.items.map(
              (item) => progressFor(path, architectId, item.id).progress,
            );
            return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
          });
          const total = perPerson.length
            ? Math.round(perPerson.reduce((s, v) => s + v, 0) / perPerson.length)
            : 0;
          const editable = canEdit(path);
          const createdAt = formatDate(path.createdAt, locale);

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
                  <li key={item.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="w-24 shrink-0 rounded-md bg-secondary px-2 py-0.5 text-center text-xs">
                        {item.type}
                      </span>
                      <div className="min-w-40 flex-1">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.hours}h estimadas</p>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {path.assignedTo.map((architectId) => {
                        const person = sel.architectById(architectId);
                        const prog = progressFor(path, architectId, item.id);
                        const nome = person?.name ?? architectId;
                        return (
                          <div key={architectId} className="flex items-center gap-2 pl-2">
                            <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                              {nome}
                            </span>
                            {canEditProgress(architectId) ? (
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={10}
                                value={prog.progress}
                                aria-label={`Progresso de ${nome} em ${item.title}`}
                                onChange={(e) =>
                                  store.updateLearningItemProgress(
                                    path.id,
                                    architectId,
                                    item.id,
                                    Number(e.target.value),
                                  )
                                }
                                className="w-full accent-[var(--primary)]"
                              />
                            ) : (
                              <Bar value={prog.progress} className="flex-1" />
                            )}
                            <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                              {prog.progress}% · {labels.learningStatus[prog.status]}
                            </span>
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
    const nome = form.name.trim() || path.name;
    store.updateLearningPath(path.id, {
      name: nome,
      description: form.description,
    });
    toast.success(t("path.edit.toast", { nome }));
    onClose();
  };

  const toggle = (field: "competencyIds" | "assignedTo", id: string) => {
    const current = path[field];
    store.updateLearningPath(path.id, {
      [field]: current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    });
  };

  /**
   * Atribuir trilha nova é para o time atual — quem já saiu não é opção nova.
   * Quem já estava atribuído antes de sair continua na lista (senão a
   * atribuição existente ficaria invisível, sem jeito de desmarcar). Ver
   * AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC E.
   */
  const assignableArchitects = store.architects.filter(
    (a) => a.active || path.assignedTo.includes(a.id),
  );

  const addItem = () => {
    const title = newItem.title.trim();
    if (!title) return;
    const item: LearningPathItem = {
      id: `lpi-${Date.now()}`,
      title,
      type: newItem.type,
      hours: Number(newItem.hours) || 1,
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
                {assignableArchitects.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      checked={path.assignedTo.includes(a.id)}
                      onChange={() => toggle("assignedTo", a.id)}
                    />
                    <span className="truncate">{a.name}</span>
                  </label>
                ))}
                {assignableArchitects.length === 0 && (
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
              toast.success(t("path.delete.toast", { nome: path.name }));
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
