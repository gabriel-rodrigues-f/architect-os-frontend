import { createFileRoute } from "@tanstack/react-router";

import { GapBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/training-needs")({
  head: () => ({
    meta: [
      { title: "Necessidades de Treinamento — Architect OS" },
      {
        name: "description",
        content:
          "Análise agregada de necessidades de treinamento do time (LNT) a partir dos gaps individuais.",
      },
      { property: "og:title", content: "Necessidades de Treinamento — Architect OS" },
      {
        property: "og:description",
        content: "Treinamentos recomendados que atendem várias pessoas simultaneamente.",
      },
    ],
  }),
  component: TrainingNeedsPage,
});

function TrainingNeedsPage() {
  const store = useStore();
  const sel = useSelectors();
  const needs = sel.teamTrainingNeeds();
  const top = needs.slice(0, 15);
  const collective = needs.filter((n) => n.people >= 3).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Análise de Necessidades de Treinamento"
        description="Agregação dos gaps de todo o time para priorizar investimentos de capacitação."
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard
          title="Lacunas agregadas"
          description="Ordenado pelo impacto total (soma das lacunas)."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">Competência</th>
                  <th className="py-2">Domínio</th>
                  <th className="py-2 text-center">Pessoas com lacuna</th>
                  <th className="py-2 text-center">Lacuna média</th>
                </tr>
              </thead>
              <tbody>
                {top.map((n) => (
                  <tr key={n.competency!.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 font-medium">{n.competency!.name}</td>
                    <td className="py-2 text-muted-foreground">
                      {store.categories.find((c) => c.id === n.competency!.categoryId)?.short}
                    </td>
                    <td className="py-2 text-center tabular-nums">{n.people}</td>
                    <td className="py-2 text-center tabular-nums">{n.avgGap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Treinamentos Recomendados para o Time"
          description="Competências com lacuna em 3 ou mais arquitetos — candidatas a treinamento coletivo."
        >
          <ul className="space-y-3">
            {collective.map((n) => (
              <li key={n.competency!.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{n.competency!.name}</p>
                  <GapBadge gap={Math.round(n.avgGap)} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.people} arquitetos · formato sugerido: workshop prático + architecture review
                </p>
              </li>
            ))}
            {!collective.length && (
              <p className="text-sm text-muted-foreground">Nenhuma lacuna coletiva relevante.</p>
            )}
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
