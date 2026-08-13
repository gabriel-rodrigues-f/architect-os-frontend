import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ArchitectFilter, applyArchitectFilter } from "@/components/app/ArchitectFilter";
import { DomainRadar } from "@/components/app/charts";
import { GapBadge, LevelCell, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/gap-analysis")({
  head: () => ({
    meta: [
      { title: "Análise de Lacunas — Architect OS" },
      {
        name: "description",
        content: "Análise automática de gaps entre nível atual e nível esperado por competência.",
      },
      { property: "og:title", content: "Análise de Lacunas — Architect OS" },
      {
        property: "og:description",
        content: "Tabela, radar, heatmap e ranking de prioridades de desenvolvimento.",
      },
    ],
  }),
  component: GapPage,
});

function GapPage() {
  const store = useStore();
  const sel = useSelectors();
  const [selected, setSelected] = useState<string[]>([]);

  /** Toda a tela lê deste recorte — filtro vazio significa o time inteiro. */
  const architects = applyArchitectFilter(store.architects, selected);

  /** Radar: média das médias por domínio entre os arquitetos filtrados. */
  const radar = useMemo(
    () =>
      store.categories.map((cat) => {
        const rows = architects.map(
          (a) =>
            sel.domainAverages(a.id).find((d) => d.category.id === cat.id) ?? { avg: 0, target: 0 },
        );
        const mean = (pick: (r: { avg: number; target: number }) => number) =>
          rows.length
            ? Number((rows.reduce((s, r) => s + pick(r), 0) / rows.length).toFixed(2))
            : 0;
        return { domain: cat.short, atual: mean((r) => r.avg), alvo: mean((r) => r.target) };
      }),
    [architects, store.categories, sel],
  );

  /**
   * Prioridades e tabela consolidam os gaps de todos os arquitetos filtrados,
   * somando o impacto por competência.
   */
  const consolidated = useMemo(() => {
    const map = new Map<
      string,
      {
        competencyId: string;
        name: string;
        categoryId: string;
        people: number;
        totalGap: number;
        maxGap: number;
        sumFinal: number;
        sumTarget: number;
      }
    >();

    for (const architect of architects) {
      for (const gap of sel.gapsFor(architect.id)) {
        if (gap.gap <= 0 || !gap.competency) continue;
        const current = map.get(gap.competency.id) ?? {
          competencyId: gap.competency.id,
          name: gap.competency.name,
          categoryId: gap.competency.categoryId,
          people: 0,
          totalGap: 0,
          maxGap: 0,
          sumFinal: 0,
          sumTarget: 0,
        };
        map.set(gap.competency.id, {
          ...current,
          people: current.people + 1,
          totalGap: current.totalGap + gap.gap,
          maxGap: Math.max(current.maxGap, gap.gap),
          sumFinal: current.sumFinal + gap.item.final,
          sumTarget: current.sumTarget + gap.item.target,
        });
      }
    }

    return [...map.values()]
      .map((row) => ({
        ...row,
        avgFinal: Number((row.sumFinal / row.people).toFixed(1)),
        avgTarget: Number((row.sumTarget / row.people).toFixed(1)),
        avgGap: Math.round(row.totalGap / row.people),
      }))
      .sort((a, b) => b.totalGap - a.totalGap || b.maxGap - a.maxGap);
  }, [architects, sel]);

  const scopeLabel =
    selected.length === 0
      ? "todo o time"
      : architects.map((a) => a.name.split(" ")[0]).join(", ") || "seleção vazia";

  return (
    <>
      <PageHeader
        title="Análise de Lacunas"
        description="Lacuna 0 adequado · Lacuna 1 desenvolvimento recomendado · Lacuna 2 prioridade alta · Lacuna 3+ crítico."
        actions={
          <ArchitectFilter
            architects={store.architects}
            selected={selected}
            onChange={setSelected}
          />
        }
      />

      {architects.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-medium">Nenhum arquiteto para analisar</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre arquitetos em Time e abra uma avaliação do ciclo para ver as lacunas aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard
              title="Radar de Arquitetura"
              description={`Nível atual versus esperado por domínio — ${scopeLabel}.`}
            >
              <DomainRadar data={radar} />
            </SectionCard>

            <SectionCard
              title="Principais Prioridades de Desenvolvimento"
              description={`Maiores lacunas considerando ${architects.length} arquiteto(s) no filtro.`}
            >
              <ol className="space-y-2">
                {consolidated.slice(0, 8).map((row, i) => (
                  <li
                    key={row.competencyId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="text-sm">
                      <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
                      {row.name}
                      {row.people > 1 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {row.people} pessoas
                        </span>
                      )}
                    </span>
                    <GapBadge gap={row.maxGap} />
                  </li>
                ))}
                {consolidated.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma lacuna identificada.</p>
                )}
              </ol>
            </SectionCard>
          </div>

          <SectionCard
            className="mt-6"
            title="Mapa de Calor de Lacunas do Time"
            description={`Médias por domínio — ${scopeLabel}.`}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
                <thead>
                  <tr>
                    <th className="w-44 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      Architect
                    </th>
                    {store.categories.map((c) => (
                      <th key={c.id} className="text-center text-[11px] text-muted-foreground">
                        {c.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {architects.map((a) => (
                    <tr key={a.id}>
                      <td className="text-sm font-medium">{a.name}</td>
                      {sel.domainAverages(a.id).map((d) => (
                        <td key={d.category.id} className="min-w-[52px]">
                          <LevelCell level={Math.round(d.avg)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            className="mt-6"
            title="Tabela de Lacunas"
            description={`Competências com lacuna identificada — ${scopeLabel}.`}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2">Competência</th>
                    <th className="py-2">Domínio</th>
                    <th className="py-2 text-center">Pessoas</th>
                    <th className="py-2 text-center">Atual (méd.)</th>
                    <th className="py-2 text-center">Alvo (méd.)</th>
                    <th className="py-2">Classificação</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidated.map((row) => (
                    <tr key={row.competencyId} className="border-b border-border/60 last:border-0">
                      <td className="py-2 font-medium">{row.name}</td>
                      <td className="py-2 text-muted-foreground">
                        {store.categories.find((c) => c.id === row.categoryId)?.name}
                      </td>
                      <td className="py-2 text-center tabular-nums">{row.people}</td>
                      <td className="py-2 text-center tabular-nums">{row.avgFinal}</td>
                      <td className="py-2 text-center tabular-nums">{row.avgTarget}</td>
                      <td className="py-2">
                        <GapBadge gap={row.maxGap} />
                      </td>
                    </tr>
                  ))}
                  {consolidated.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-3 text-sm text-muted-foreground">
                        Nenhuma lacuna para o filtro atual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </>
  );
}
