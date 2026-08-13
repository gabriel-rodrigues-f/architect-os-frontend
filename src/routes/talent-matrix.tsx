import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { GapBadge, Initials, PageHeader, SectionCard } from "@/components/app/ui-bits";
import type { Architect } from "@/lib/domain";
import { planItemStatusLabel, ratingLabel } from "@/lib/labels";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/talent-matrix")({
  head: () => ({
    meta: [
      { title: "Matriz de Talentos — Architect OS" },
      {
        name: "description",
        content:
          "Matriz 9 Box de desempenho e potencial como ferramenta complementar de desenvolvimento.",
      },
      { property: "og:title", content: "Matriz de Talentos — Architect OS" },
      {
        property: "og:description",
        content: "Posicione arquitetos na 9 Box e conecte a discussão ao PDI e aos gaps técnicos.",
      },
    ],
  }),
  component: TalentMatrixPage,
});

const LEVELS3 = ["High", "Medium", "Low"] as const;

function TalentMatrixPage() {
  const store = useStore();
  const sel = useSelectors();
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const architect = selected ? sel.architectById(selected) : undefined;
  const gaps = architect
    ? sel
        .gapsFor(architect.id)
        .filter((g) => g.gap > 0)
        .slice(0, 3)
    : [];
  const plan = architect ? sel.planFor(architect.id) : undefined;

  return (
    <>
      <PageHeader
        title="Matriz de Talentos (9 Box)"
        description="Complementar à matriz de competências — nunca substitui a avaliação técnica. Arraste os arquitetos entre quadrantes."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <SectionCard
          title="Desempenho × Potencial"
          description="Eixo X: Desempenho · Eixo Y: Potencial"
        >
          <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-2">
            <div />
            {(["Low", "Medium", "High"] as const).map((p) => (
              <div
                key={p}
                className="pb-1 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Performance {p}
              </div>
            ))}
            {LEVELS3.map((potential) => (
              <Row key={potential}>
                <div className="flex items-center pr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pot. {ratingLabel[potential]}
                </div>
                {(["Low", "Medium", "High"] as const).map((performance) => {
                  const people = store.architects.filter(
                    (a) => a.potential === potential && a.performance === performance,
                  );
                  return (
                    <div
                      key={`${potential}-${performance}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragging) store.moveNineBox(dragging, performance, potential);
                        setDragging(null);
                      }}
                      className="min-h-28 rounded-lg border border-dashed border-border bg-secondary/40 p-2"
                    >
                      {people.map((a) => (
                        <button
                          key={a.id}
                          draggable
                          onDragStart={() => setDragging(a.id)}
                          onClick={() => setSelected(a.id)}
                          className="mb-1.5 flex w-full items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-left text-xs hover:border-primary"
                        >
                          <Initials name={a.name} />
                          <span className="truncate">{a.name}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </Row>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Detalhe"
          description="Clique em um arquiteto para ver o contexto de desenvolvimento."
        >
          {!architect ? (
            <p className="text-sm text-muted-foreground">Nenhum arquiteto selecionado.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-display text-base font-semibold">{architect.name}</p>
                <p className="text-xs text-muted-foreground">{architect.role}</p>
              </div>
              <p>
                Posição: <strong>Desempenho {ratingLabel[architect.performance]}</strong> ·{" "}
                <strong>Potencial {ratingLabel[architect.potential]}</strong>
              </p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Principais lacunas
                </p>
                <ul className="mt-1 space-y-1">
                  {gaps.map((g) => (
                    <li
                      key={g.item.competencyId}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{g.competency?.name}</span>
                      <GapBadge gap={g.gap} />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  PDI ativo
                </p>
                <ul className="mt-1 list-disc pl-4">
                  {(plan?.items ?? []).map((i) => (
                    <li key={i.id}>
                      {sel.competencyById(i.competencyId)?.name} — {planItemStatusLabel[i.status]} (
                      {i.progress}%)
                    </li>
                  ))}
                </ul>
              </div>
              <p className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
                Recomendação: {recommendation(architect)}
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function recommendation(a: Architect) {
  if (a.potential === "High" && a.performance === "High")
    return "Ampliar escopo de liderança técnica, conduzir architecture reviews e mentorar outros arquitetos.";
  if (a.potential === "High")
    return "Acelerar exposição prática em projetos estratégicos e reforçar o PDI com ações Apply e Teach.";
  if (a.performance === "High")
    return "Consolidar profundidade técnica e transformar experiência em evidências e documentação.";
  return "Focar em fundamentos, pair architecture e mentoria semanal com metas SMART curtas.";
}
