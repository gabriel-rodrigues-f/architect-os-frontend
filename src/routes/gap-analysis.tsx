import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ArchitectFilter, applyArchitectFilter } from "@/components/app/ArchitectFilter";
import { CapabilitiesTabs } from "@/components/app/CapabilitiesTabs";
import { DomainRadar } from "@/components/app/charts";
import { GapBadge, LevelCell, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { averageWithCoverage } from "@/lib/selectors";
import { canActFor } from "@/lib/scope";
import { useSelectors, useStore } from "@/lib/store";

export const Route = createFileRoute("/gap-analysis")({
  head: () => ({
    meta: [
      { title: "Análise de Lacunas — Synapse" },
      {
        name: "description",
        content: "Análise automática de gaps entre nível atual e nível esperado por competência.",
      },
      { property: "og:title", content: "Análise de Lacunas — Synapse" },
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
  const user = useCurrentUser();
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);

  /**
   * Toda a tela lê deste recorte. Filtro vazio significa o time que este
   * viewer de fato enxerga (`canActFor`) — quem já saiu não conta como
   * lacuna do time ativo, e quem está fora do escopo não conta como "sem
   * lacuna" só por não ter registro visível (roster é dado de diretório sem
   * filtro; ver `auth/scope.ts`). Selecionar alguém explicitamente no filtro
   * (incluindo gente inativa ou fora do escopo) ainda funciona — a lista de
   * opções do `ArchitectFilter` continua sendo `store.architects` inteiro; a
   * própria falta de dado visível já degrada de forma transparente via
   * `coverage`. Ver AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-
   * SYNAPSE.md, EPIC E, e ANA-001, AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-
   * 08-19.md.
   */
  const architects =
    selected.length === 0
      ? sel.activeArchitects.filter((a) => canActFor(user, a))
      : applyArchitectFilter(store.architects, selected);

  /**
   * Radar: média por domínio só entre quem tem assessment oficial cobrindo
   * aquele domínio — quem não tem simplesmente não entra na média, em vez de
   * puxá-la para baixo como um nível 0 fictício faria. `coverage` guarda
   * quantos de quantos contribuíram, para a legenda avisar quando a média é
   * de uma fração pequena do grupo. Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-
   * SYNAPSE.md, Seção 9.
   */
  const radar = useMemo(
    () =>
      store.categories.map((cat) => {
        const rows = architects.map((a) =>
          sel.domainAverages(a.id).find((d) => d.category.id === cat.id),
        );
        const atual = averageWithCoverage(rows.map((r) => r?.avg));
        const alvo = averageWithCoverage(rows.map((r) => r?.target));
        return {
          domain: cat.short,
          atual: Number((atual.avg ?? 0).toFixed(2)),
          alvo: Number((alvo.avg ?? 0).toFixed(2)),
          covered: atual.covered,
          total: atual.total,
        };
      }),
    [architects, store.categories, sel],
  );

  /** Pior cobertura entre os domínios do radar — sinaliza quando a leitura é de poucos. */
  const radarCoverage = radar.reduce(
    (min, r) => (r.covered < min.covered ? r : min),
    radar[0] ?? { covered: 0, total: 0 },
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
      <CapabilitiesTabs />
      <PageHeader
        title={t("gap.title")}
        description={t("gap.subtitle")}
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
          <p className="text-sm font-medium">{t("gap.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre arquitetos em Time e abra uma avaliação do ciclo para ver as lacunas aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard
              title={t("gap.radar.title")}
              description={t("gap.radar.subtitle", { escopo: scopeLabel })}
            >
              <DomainRadar data={radar} />
              {radarCoverage.total > 0 && radarCoverage.covered < radarCoverage.total && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("gap.radar.coverage", {
                    covered: radarCoverage.covered,
                    total: radarCoverage.total,
                  })}
                </p>
              )}
            </SectionCard>

            <SectionCard
              title={t("gap.priorities.title")}
              description={t("gap.priorities.subtitle", { n: architects.length })}
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
                    <div className="flex shrink-0 items-center gap-2">
                      <GapBadge gap={row.maxGap} />
                      {/* Diagnóstico precisa levar a algum lugar: daqui se vai tratar a lacuna. */}
                      <Link
                        to="/development-plans"
                        className="whitespace-nowrap text-xs text-primary hover:underline"
                      >
                        {t("gap.priorities.action")}
                      </Link>
                    </div>
                  </li>
                ))}
                {consolidated.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("gap.priorities.none")}</p>
                )}
              </ol>
            </SectionCard>
          </div>

          <SectionCard
            className="mt-6"
            title={t("gap.heatmap.title")}
            description={t("gap.heatmap.subtitle", { escopo: scopeLabel })}
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
                          <LevelCell level={d.avg === undefined ? undefined : Math.round(d.avg)} />
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
            title={t("gap.table.title")}
            description={t("gap.table.subtitle", { escopo: scopeLabel })}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2">{t("col.competency")}</th>
                    <th className="py-2">{t("col.domain")}</th>
                    <th className="py-2 text-center">{t("col.people")}</th>
                    <th className="py-2 text-center">{t("col.currentAvg")}</th>
                    <th className="py-2 text-center">{t("col.targetAvg")}</th>
                    <th className="py-2">{t("col.classification")}</th>
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
