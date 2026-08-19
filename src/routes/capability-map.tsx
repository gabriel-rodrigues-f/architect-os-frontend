import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionCard } from "@/components/app/ui-bits";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CompetencyCategory } from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useSelectors, useStore } from "@/lib/store";
import { slug } from "@/lib/text";

export const Route = createFileRoute("/capability-map")({
  head: () => ({
    meta: [
      { title: "Mapa de Capacidades — Synapse" },
      {
        name: "description",
        content:
          "Mapa das capacidades técnicas disponíveis no time de arquitetura, com especialistas, riscos e lacunas.",
      },
      { property: "og:title", content: "Mapa de Capacidades — Synapse" },
      {
        property: "og:description",
        content:
          "Onde há concentração de conhecimento, dependência de pessoas e ausência de especialistas.",
      },
    ],
  }),
  component: CapabilityMapPage,
});

/**
 * Faixas padrão de toda capacidade. Uma capacidade recém-criada já nasce com as
 * quatro, ainda vazias, e vai se preenchendo conforme as avaliações evoluem.
 *
 * A ordem é crescente — da menor proficiência para a maior — para a leitura
 * ocidental da esquerda para a direita acompanhar a evolução do time.
 */
const BANDS = [
  { key: "gaps", labelKey: "cap.band.gaps", tone: "bg-level-1/60", min: -Infinity, max: 2.5 },
  {
    key: "practitioners",
    labelKey: "cap.band.practitioners",
    tone: "bg-level-3/60",
    min: 2.5,
    max: 3.5,
  },
  { key: "advanced", labelKey: "cap.band.advanced", tone: "bg-level-4/60", min: 3.5, max: 4.5 },
  { key: "experts", labelKey: "cap.band.experts", tone: "bg-level-5/60", min: 4.5, max: Infinity },
] as const;

function CapabilityMapPage() {
  const store = useStore();
  const sel = useSelectors();
  /** Catálogo de capacidades é administrativo — backend já recusa o resto. */
  const isAdmin = useCurrentUser().role === "admin";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { t } = useI18n();
  const [editing, setEditing] = useState<CompetencyCategory | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<CompetencyCategory | null>(null);

  /**
   * Ausência de avaliação oficial não é lacuna: quem não tem `avg` para o
   * domínio simplesmente não entra em nenhuma faixa de proficiência — entra
   * na contagem separada `notAssessed`. Antes, `?? 0` empurrava essas
   * pessoas para "Lacunas" junto de quem foi avaliado e está fraco de
   * verdade, os dois casos ficando indistinguíveis na tela. Ver
   * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 7.
   */
  const areas = store.categories.map((cat) => {
    const people = store.architects.map((a) => ({
      architect: a,
      level: sel.domainAverages(a.id).find((d) => d.category.id === cat.id)?.avg,
    }));
    const assessed = people.filter(
      (p): p is { architect: (typeof people)[number]["architect"]; level: number } =>
        p.level !== undefined,
    );
    const notAssessed = people.length - assessed.length;
    const bands = BANDS.map((band) => ({
      ...band,
      people: assessed.filter((p) => p.level >= band.min && p.level < band.max),
    }));
    return { cat, bands, notAssessed };
  });

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    store.addCategory({
      id: slug(trimmed),
      name: trimmed,
      // A sigla das colunas dos mapas de calor sai da primeira palavra do nome.
      short: trimmed.split(" ")[0] ?? trimmed,
    });
    setName("");
    setOpen(false);
  };

  const startEditing = (category: CompetencyCategory) => {
    setEditing(category);
    setEditName(category.name);
  };

  const saveEditing = () => {
    if (!editing) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    store.updateCategory(editing.id, { name: trimmed, short: trimmed.split(" ")[0] ?? trimmed });
    toast.success(t("cap.edit.toast", { nome: trimmed }));
    setEditing(null);
  };

  const remove = () => {
    if (!confirmDelete) return;
    store.removeCategory(confirmDelete.id);
    toast.success(t("cap.delete.toast", { nome: confirmDelete.name }));
    setConfirmDelete(null);
  };

  /** Quantas competências caem junto se a capacidade for excluída. */
  const competencyCount = (categoryId: string) =>
    store.competencies.filter((c) => c.categoryId === categoryId).length;

  const askDelete = (category: CompetencyCategory) => setConfirmDelete(category);

  return (
    <>
      <PageHeader
        title={t("cap.title")}
        description={t("cap.subtitle")}
        actions={
          isAdmin ? <Button onClick={() => setOpen(true)}>{t("cap.new")}</Button> : undefined
        }
      />

      {store.categories.length === 0 && (
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-medium">{t("cap.empty.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("cap.empty.hint")}</p>
          {isAdmin && (
            <Button className="mt-4" onClick={() => setOpen(true)}>
              {t("cap.new")}
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {areas.map((area) => {
          const experts = area.bands.find((b) => b.key === "experts")?.people ?? [];
          const advanced = area.bands.find((b) => b.key === "advanced")?.people ?? [];
          const mentors = [...experts, ...advanced];
          return (
            <SectionCard
              key={area.cat.id}
              title={area.cat.name}
              description={
                mentors.length === 0
                  ? t("cap.risk.noExpert")
                  : experts.length === 1
                    ? t("cap.risk.singlePerson")
                    : t("cap.risk.healthy", { n: mentors.length })
              }
              actions={
                isAdmin && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEditing(area.cat)}
                      aria-label={`Editar ${area.cat.name}`}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => askDelete(area.cat)}
                      aria-label={`Excluir ${area.cat.name}`}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {area.bands.map((band) => (
                  <Group
                    key={band.key}
                    label={t(band.labelKey)}
                    people={band.people.map((p) => p.architect.name)}
                    tone={band.tone}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("cap.mentors", {
                  nomes: mentors.map((p) => p.architect.name).join(", ") || t("common.none"),
                })}
              </p>
              {area.notAssessed > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("cap.notAssessed", { n: area.notAssessed })}
                </p>
              )}
            </SectionCard>
          );
        })}
      </div>

      <Dialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cap.edit.title")}</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="capability-edit-name">{t("cap.field.name")}</Label>
            <Input
              id="capability-edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveEditing()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEditing}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Excluir ${confirmDelete?.name}?`}
        description={
          confirmDelete && competencyCount(confirmDelete.id) > 0
            ? `As ${competencyCount(confirmDelete.id)} competências desta capacidade também serão excluídas, junto com as avaliações e as referências em trilhas.`
            : "Esta capacidade não tem competências cadastradas."
        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={remove}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cap.create.title")}</DialogTitle>
            <DialogDescription>
              A capacidade nasce com as quatro faixas padrão — Lacunas, Praticantes, Avançados e
              Especialistas — e passa a receber pessoas conforme as avaliações do time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="capability-name">Nome</Label>
              <Input
                id="capability-name"
                placeholder="Ex.: Engenharia de Plataforma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
              />
            </div>
            <div className="surface-inset p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("cap.bands.label")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {BANDS.map((band) => (
                  <span key={band.key} className={`rounded-md px-2 py-0.5 text-xs ${band.tone}`}>
                    {t(band.labelKey)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={create}>{t("cap.create.action")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Group({ label, people, tone }: { label: string; people: string[]; tone: string }) {
  return (
    <div className="surface-inset p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span className={`rounded-md px-1.5 text-xs font-semibold tabular-nums ${tone}`}>
          {people.length}
        </span>
      </div>
      <p className="mt-1 text-sm">{people.join(", ") || "—"}</p>
    </div>
  );
}
