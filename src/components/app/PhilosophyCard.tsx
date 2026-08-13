import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DevelopmentPhilosophy, PhilosophyStage } from "@/lib/api";
import { useStore } from "@/lib/store";
import { slug } from "@/lib/text";

/**
 * Filosofia de desenvolvimento do dashboard. Em modo de edição, título,
 * descrição, rodapé e etapas ficam todos editáveis — dá para renomear, remover
 * e acrescentar etapas antes de salvar.
 */
export function PhilosophyCard() {
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DevelopmentPhilosophy>(store.philosophy);

  const startEditing = () => {
    setDraft(store.philosophy);
    setEditing(true);
  };

  const save = () => {
    const stages = draft.stages
      .map((stage) => ({ ...stage, name: stage.name.trim() }))
      .filter((stage) => stage.name.length > 0);
    store.savePhilosophy({
      ...draft,
      title: draft.title.trim() || "Filosofia de Desenvolvimento",
      stages,
    });
    setEditing(false);
  };

  const updateStage = (id: string, name: string) =>
    setDraft((d) => ({
      ...d,
      stages: d.stages.map((stage) => (stage.id === id ? { ...stage, name } : stage)),
    }));

  const removeStage = (id: string) =>
    setDraft((d) => ({ ...d, stages: d.stages.filter((stage) => stage.id !== id) }));

  const addStage = () =>
    setDraft((d) => ({
      ...d,
      stages: [...d.stages, { id: `etapa-${Date.now()}`, name: "" }],
    }));

  if (!editing) {
    return (
      <SectionCard
        className="mt-6"
        title={store.philosophy.title || "Filosofia de Desenvolvimento"}
        description={store.philosophy.description}
        actions={
          <Button variant="outline" size="sm" onClick={startEditing}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {store.philosophy.stages.map((stage, i) => (
            <span key={stage.id} className="flex items-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium">
                {stage.name}
              </span>
              {i < store.philosophy.stages.length - 1 && (
                <span className="text-muted-foreground">→</span>
              )}
            </span>
          ))}
          {store.philosophy.stages.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>
          )}
        </div>
        {store.philosophy.footer && (
          <p className="mt-4 text-sm text-muted-foreground">{store.philosophy.footer}</p>
        )}
      </SectionCard>
    );
  }

  return (
    <SectionCard
      className="mt-6"
      title="Editando a filosofia"
      description="Ajuste os textos e as etapas do fluxo de desenvolvimento."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save}>
            Salvar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="philosophy-title">Título</Label>
          <Input
            id="philosophy-title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="philosophy-description">Chamada</Label>
          <Input
            id="philosophy-description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label>Etapas</Label>
            <Button variant="outline" size="sm" onClick={addStage}>
              <Plus className="h-3.5 w-3.5" />
              Nova etapa
            </Button>
          </div>
          <ul className="mt-2 space-y-2">
            {draft.stages.map((stage, index) => (
              <li key={stage.id} className="flex items-center gap-2">
                <span className="w-6 text-center text-xs tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <Input
                  value={stage.name}
                  placeholder="Nome da etapa"
                  aria-label={`Etapa ${index + 1}`}
                  onChange={(e) => updateStage(stage.id, e.target.value)}
                  onBlur={(e) => {
                    // Estabiliza o id a partir do nome enquanto a etapa é nova.
                    const name = e.target.value.trim();
                    if (name && stage.id.startsWith("etapa-")) {
                      const id = slug(name) || stage.id;
                      setDraft((d) => ({
                        ...d,
                        stages: d.stages.map((s) => (s.id === stage.id ? { ...s, id } : s)),
                      }));
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeStage(stage.id)}
                  aria-label={`Excluir etapa ${stage.name || index + 1}`}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {draft.stages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma etapa. Use “Nova etapa” para começar.
              </p>
            )}
          </ul>
        </div>

        <div>
          <Label htmlFor="philosophy-footer">Texto de apoio</Label>
          <Textarea
            id="philosophy-footer"
            rows={3}
            value={draft.footer}
            onChange={(e) => setDraft({ ...draft, footer: e.target.value })}
          />
        </div>
      </div>
    </SectionCard>
  );
}

export type { PhilosophyStage };
