import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
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
  type CompetencyCategory,
  type Level,
  type RoleName,
} from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { slug } from "@/lib/text";

export const Route = createFileRoute("/competency-matrix")({
  head: () => ({
    meta: [
      { title: "Matriz de Competências — Architect OS" },
      {
        name: "description",
        content:
          "Catálogo de competências de arquitetura agrupadas por domínio, com níveis esperados por cargo.",
      },
      { property: "og:title", content: "Matriz de Competências — Architect OS" },
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
const competencyId = (category: CompetencyCategory, name: string) => slug(`${category.id}-${name}`);

function MatrixPage() {
  const store = useStore();
  const [newCategory, setNewCategory] = useState("");
  const { t } = useI18n();
  const [newComp, setNewComp] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<{
    competency: Competency;
    category: CompetencyCategory;
  } | null>(null);
  const [editing, setEditing] = useState<Competency | null>(null);

  return (
    <>
      <PageHeader
        title={t("matrix.title")}
        description={t("matrix.subtitle")}
        actions={
          <div className="flex gap-2">
            <Input
              placeholder={t("matrix.newDomain")}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-48"
            />
            <Button
              variant="secondary"
              onClick={() => {
                if (!newCategory.trim()) return;
                store.addCategory({
                  id: slug(newCategory),
                  name: newCategory,
                  short: newCategory.split(" ")[0] ?? newCategory,
                });
                setNewCategory("");
              }}
            >
              {t("matrix.add")}
            </Button>
          </div>
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

      {store.categories.length === 0 && (
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-medium">{t("matrix.empty.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("matrix.empty.hint")}</p>
        </div>
      )}

      <div className="space-y-4">
        {store.categories.map((cat) => {
          const comps = store.competencies.filter((c) => c.categoryId === cat.id);
          return (
            <SectionCard
              key={cat.id}
              title={cat.name}
              description={t("matrix.competencyCount", { n: comps.length })}
              actions={
                <div className="flex gap-2">
                  <Input
                    placeholder={t("matrix.newCompetency")}
                    className="w-52"
                    value={newComp[cat.id] ?? ""}
                    onChange={(e) => setNewComp({ ...newComp, [cat.id]: e.target.value })}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const name = (newComp[cat.id] ?? "").trim();
                      if (!name) return;
                      store.addCompetency({
                        id: competencyId(cat, name),
                        name,
                        categoryId: cat.id,
                        expected: {
                          "Arquiteto de Soluções I": 3 as Level,
                          "Arquiteto de Soluções II": 4 as Level,
                          "Arquiteto de Soluções III": 5 as Level,
                        },
                      });
                      setNewComp({ ...newComp, [cat.id]: "" });
                    }}
                  >
                    {t("matrix.add")}
                  </Button>
                </div>
              }
            >
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
                        <td className="py-2 font-medium">{c.name}</td>
                        {ROLES.map((r) => (
                          <td key={r} className="py-2 text-center">
                            <LevelBadge level={c.expected[r]} />
                          </td>
                        ))}
                        <td className="py-2 text-right">
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
                              onClick={() => setConfirmDelete({ competency: c, category: cat })}
                              aria-label={`Excluir ${c.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={
          <>
            Tem certeza que deseja excluir {confirmDelete?.competency.name} de{" "}
            {confirmDelete?.category.name}?
          </>
        }
        description="A competência sai da matriz e das avaliações em que aparece. Esta ação não pode ser desfeita."
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) {
            store.removeCompetency(confirmDelete.competency.id);
            toast.success(t("matrix.delete.toast", { nome: confirmDelete.competency.name }));
          }
          setConfirmDelete(null);
        }}
      />

      {editing && <CompetencyEditDialog competency={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/**
 * Nome e nível esperado por cargo são as únicas colunas que a matriz mostra —
 * então são as únicas que o diálogo edita. Trocar de domínio é uma decisão de
 * reorganização maior (afeta relatórios agrupados por categoria), não um
 * ajuste pontual; fica fora daqui.
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
  const [name, setName] = useState(competency.name);
  const [levels, setLevels] = useState<Record<RoleName, Level>>(competency.expected);

  const save = () => {
    if (!name.trim()) return;
    store.updateCompetency(competency.id, { name: name.trim(), expected: levels });
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
