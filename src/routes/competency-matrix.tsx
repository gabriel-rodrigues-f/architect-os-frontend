import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LEVELS,
  ROLES,
  roleShort,
  type Competency,
  type CompetencyCategory,
  type Level,
  type RoleName,
} from "@/lib/domain";
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
  const [newComp, setNewComp] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<{
    competency: Competency;
    category: CompetencyCategory;
  } | null>(null);

  return (
    <>
      <PageHeader
        title="Matriz de Competências"
        description="Competências necessárias para um Arquiteto de Soluções, agrupadas por domínio técnico e de negócio."
        actions={
          <div className="flex gap-2">
            <Input
              placeholder="Novo domínio"
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
              Adicionar
            </Button>
          </div>
        }
      />

      <SectionCard
        title="Níveis de Proficiência"
        description="Escala única utilizada em toda a plataforma."
        className="mb-6"
      >
        <div className="grid gap-3 md:grid-cols-5">
          {LEVELS.map((l) => (
            <div key={l.level} className="rounded-lg border border-border p-3">
              <LevelBadge level={l.level} showName />
              <p className="mt-2 text-xs text-muted-foreground">{l.description}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="space-y-4">
        {store.categories.map((cat) => {
          const comps = store.competencies.filter((c) => c.categoryId === cat.id);
          return (
            <SectionCard
              key={cat.id}
              title={cat.name}
              description={`${comps.length} competências`}
              actions={
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova competência"
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
                    Adicionar
                  </Button>
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2">Competência</th>
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
                          <button
                            type="button"
                            className="text-muted-foreground transition-colors hover:text-destructive"
                            onClick={() => setConfirmDelete({ competency: c, category: cat })}
                            aria-label={`Excluir ${c.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
          if (confirmDelete) store.removeCompetency(confirmDelete.competency.id);
          setConfirmDelete(null);
        }}
      />
    </>
  );
}
