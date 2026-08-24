import { createFileRoute, Link } from "@tanstack/react-router";

import { ArchitectFilter } from "@/components/app/ArchitectFilter";
import { CapabilitiesTabs } from "@/components/app/CapabilitiesTabs";
import { CapabilityRadar } from "@/components/app/charts";
import { type ConsolidatedGapRow, useGapAnalysisData } from "@/components/app/gap-analysis-shared";
import { GapBadge, NameList, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";

export const Route = createFileRoute("/gap-analysis")({
  head: () => ({
    meta: [
      { title: "Prioridades de Desenvolvimento — Synapse" },
      {
        name: "description",
        content: "Radar de arquitetura e ranking de prioridades de desenvolvimento por pessoa.",
      },
      { property: "og:title", content: "Prioridades de Desenvolvimento — Synapse" },
      { property: "og:description", content: "Radar e prioridades de desenvolvimento." },
    ],
  }),
  component: GapPage,
});

function GapPage() {
  const { t } = useI18n();
  const help = usePageHelp("gapAnalysis");
  const {
    store,
    selected,
    setSelected,
    architects,
    radar,
    radarCoverage,
    blocking,
    opportunity,
    scopeLabel,
  } = useGapAnalysisData();

  return (
    <>
      <CapabilitiesTabs />
      <PageHeader
        title={t("gap.title")}
        description={t("gap.subtitle")}
        help={help}
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
            {store.architects.length === 0
              ? "Cadastre arquitetos em Time e abra uma avaliação do ciclo para ver as lacunas aqui."
              : t("gap.empty.filterHint")}
          </p>
        </div>
      ) : (
        // R2-UX-04/R2-RESP-03 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — mesmo
        // min-content trap dos outros 4 grids do app: minmax(0,1fr) deixa a
        // pista encolher, o overflow interno faz o resto.
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SectionCard
            title={t("gap.radar.title")}
            description={t("gap.radar.subtitle", { escopo: scopeLabel })}
          >
            <CapabilityRadar data={radar} />
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
            className="flex flex-col"
            title={t("gap.priorities.title")}
            description={t("gap.priorities.subtitle", { n: architects.length })}
          >
            {/* Rola só esta lista, não a página inteira — mesma ideia do
                heatmap/tabela em `/progression` (`max-h` + `overflow-auto`),
                só que aqui cobrindo as duas seções (bloqueante+oportunidade)
                como uma região só, já que juntas são "as prioridades". */}
            <div className="max-h-[460px] space-y-4 overflow-y-auto pr-1">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-destructive">
                  {t("gap.priorities.blocking.title")}
                </h3>
                <GapPriorityList rows={blocking} emptyLabel={t("gap.priorities.blocking.none")} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("gap.priorities.opportunity.title")}
                </h3>
                <GapPriorityList
                  rows={opportunity}
                  emptyLabel={t("gap.priorities.opportunity.none")}
                />
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </>
  );
}

/**
 * ORIENTACAO-NONA-RODADA ENT-09-012 — os números secundários que compõem o
 * gap (médio, máximo, atual, alvo, pessoas afetadas) sempre juntos: o
 * `GapBadge` sozinho só mostra o pior caso, e a Seção 33 pede que a média
 * apareça lado a lado, nunca escondida atrás do máximo.
 *
 * Cada informação na sua própria linha (nome · pessoas · gap médio ·
 * nomes) — apontado ao vivo que tudo espremido num só parágrafo ficava
 * ilegível assim que o nome da competência era longo o bastante pra
 * quebrar linha no meio da legenda.
 */
function GapPriorityList({ rows, emptyLabel }: { rows: ConsolidatedGapRow[]; emptyLabel: string }) {
  const { t } = useI18n();
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <ol className="space-y-2">
      {rows.slice(0, 8).map((row, i) => (
        <li
          key={row.competencyId}
          className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2"
        >
          <div className="min-w-0 text-sm">
            <p>
              <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
              {row.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("gap.priorities.peopleCount", { n: row.people })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("gap.priorities.avgGapLine", { avg: row.avgGap })}
            </p>
            <p className="text-xs text-muted-foreground">
              <NameList names={row.architectNames} />
            </p>
          </div>
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
    </ol>
  );
}
