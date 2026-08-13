import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState } from "react";

import { GapBadge, LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { assessmentStatusLabel } from "@/lib/labels";
import { Textarea } from "@/components/ui/textarea";
import type { Level } from "@/lib/domain";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/assessments")({
  head: () => ({
    meta: [
      { title: "Avaliações — Architect OS" },
      {
        name: "description",
        content: "Autoavaliação, avaliação do líder, nível alvo e nível final por competência.",
      },
      { property: "og:title", content: "Avaliações — Architect OS" },
      {
        property: "og:description",
        content: "Conduza assessments de competências com comentários do arquiteto e do líder.",
      },
    ],
  }),
  component: AssessmentsPage,
});

function AssessmentsPage() {
  const store = useStore();
  const sel = useSelectors();
  const [architectId, setArchitectId] = useState(store.architects[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(store.categories[0]?.id ?? "");
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const assessment = sel.assessmentFor(architectId);
  const comps = store.competencies.filter((c) => c.categoryId === categoryId);

  const levelSelect = (value: number, onChange: (v: Level) => void, disabled = false) => (
    <select
      className="w-full rounded-md border border-input bg-card px-2 py-1 text-sm disabled:opacity-60"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value) as Level)}
    >
      {[1, 2, 3, 4, 5].map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <PageHeader
        title="Avaliação de Competências"
        description="Cada competência combina autoavaliação, avaliação do líder, nível alvo do cargo e nível final acordado."
        actions={
          <div className="flex gap-2">
            <select
              className="rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={architectId}
              onChange={(e) => setArchitectId(e.target.value)}
            >
              {store.architects.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {store.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {!assessment ? (
        <SectionCard
          title="Sem avaliação neste ciclo"
          description="Abra a avaliação para avaliar as competências deste arquiteto."
        >
          {store.architects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cadastre um arquiteto em Time antes de abrir avaliações.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Ao abrir, a avaliação nasce com uma linha por competência cadastrada e o nível alvo
                já preenchido a partir do Role Competency Profile do cargo.
              </p>
              {openError && <p className="mt-2 text-sm text-destructive">{openError}</p>}
              <Button
                className="mt-4"
                disabled={opening || !architectId || !store.activeCycleId}
                onClick={() => {
                  setOpenError(null);
                  setOpening(true);
                  store
                    .openAssessment(architectId, store.activeCycleId)
                    .catch((error: unknown) =>
                      setOpenError(
                        error instanceof Error ? error.message : "Não foi possível abrir",
                      ),
                    )
                    .finally(() => setOpening(false));
                }}
              >
                {opening ? "Abrindo…" : "Abrir avaliação do ciclo"}
              </Button>
            </>
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title={store.categories.find((c) => c.id === categoryId)?.name ?? ""}
          description={`Situação: ${assessmentStatusLabel[assessment.status]}`}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">Competência</th>
                  <th className="w-24 py-2 text-center">Autoavaliação</th>
                  <th className="w-24 py-2 text-center">Líder</th>
                  <th className="w-24 py-2 text-center">Alvo</th>
                  <th className="w-24 py-2 text-center">Final</th>
                  <th className="w-44 py-2">Lacuna</th>
                  <th className="w-24 py-2 text-right">Notas</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((c) => {
                  const item = assessment.items.find((i) => i.competencyId === c.id);
                  if (!item) return null;
                  const gap = item.target - item.final;
                  return (
                    <Fragment key={c.id}>
                      <tr className="border-b border-border/60">
                        <td className="py-2 font-medium">{c.name}</td>
                        <td className="px-1 py-2">
                          {levelSelect(item.self, (v) =>
                            store.updateAssessmentItem(assessment.id, c.id, { self: v }),
                          )}
                        </td>
                        <td className="px-1 py-2">
                          {levelSelect(item.leader, (v) =>
                            store.updateAssessmentItem(assessment.id, c.id, { leader: v }),
                          )}
                        </td>
                        <td className="px-1 py-2 text-center">
                          <LevelBadge level={item.target} />
                        </td>
                        <td className="px-1 py-2">
                          {levelSelect(item.final, (v) =>
                            store.updateAssessmentItem(assessment.id, c.id, { final: v }),
                          )}
                        </td>
                        <td className="py-2">
                          <GapBadge gap={gap} />
                        </td>
                        <td className="py-2 text-right">
                          <button
                            className="text-xs text-primary hover:underline"
                            onClick={() => setOpenComment(openComment === c.id ? null : c.id)}
                          >
                            {openComment === c.id ? "Fechar" : "Comentar"}
                          </button>
                        </td>
                      </tr>
                      {openComment === c.id && (
                        <tr className="border-b border-border/60 bg-secondary/40">
                          <td colSpan={7} className="p-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="mb-1 text-xs font-medium text-muted-foreground">
                                  Comentário do arquiteto
                                </p>
                                <Textarea
                                  value={item.selfComment ?? ""}
                                  onChange={(e) =>
                                    store.updateAssessmentItem(assessment.id, c.id, {
                                      selfComment: e.target.value,
                                    })
                                  }
                                  placeholder="Evidências e contexto da autoavaliação"
                                />
                              </div>
                              <div>
                                <p className="mb-1 text-xs font-medium text-muted-foreground">
                                  Comentário do líder
                                </p>
                                <Textarea
                                  value={item.leaderComment ?? ""}
                                  onChange={(e) =>
                                    store.updateAssessmentItem(assessment.id, c.id, {
                                      leaderComment: e.target.value,
                                    })
                                  }
                                  placeholder="Feedback, evidências observadas e expectativas"
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </>
  );
}
