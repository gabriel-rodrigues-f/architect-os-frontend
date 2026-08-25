import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ArchitectFilter } from "@/components/app/ArchitectFilter";
import {
  capHeatmapColumns,
  GapTable,
  HeatmapColumnsNotice,
  useGapAnalysisData,
} from "@/components/app/gap-analysis-shared";
import { LevelCell, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { capabilityShortLabels } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useSelectors } from "@/lib/store";
import { exportTeamReportCsv } from "@/lib/team-report-csv";

/**
 * Apontado ao vivo: Mapa de Calor + Tabela de Lacunas de Progressão viviam
 * no fim de `/gap-analysis` (Radar + Prioridades), empurrando a página
 * inteira pra baixo — duas visões de escopo diferente (por pessoa vs.
 * consolidado do time) forçadas na mesma rolagem. Vira aba própria dentro
 * de "Capacidades", ao lado de "Prioridades"; o cálculo é o mesmo
 * (`useGapAnalysisData`), só a apresentação muda.
 */
export const Route = createFileRoute("/progression")({
  head: () => ({
    meta: [
      { title: "Progressão — Synapse" },
      {
        name: "description",
        content: "Mapa de calor de competências e tabela de lacunas de progressão do time.",
      },
      { property: "og:title", content: "Progressão — Synapse" },
      { property: "og:description", content: "Mapa de calor e tabela de lacunas do time." },
    ],
  }),
  component: ProgressionPage,
});

function ProgressionPage() {
  const { t } = useI18n();
  const help = usePageHelp("progression");
  const sel = useSelectors();
  const { store, selected, setSelected, architects, blocking, opportunity, mastery, scopeLabel } =
    useGapAnalysisData();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const visibleCapabilities = showAllColumns
    ? store.capabilities
    : capHeatmapColumns(store.capabilities, architects, sel.capabilityAverages);
  const visibleCapabilityIds = new Set(visibleCapabilities.map((c) => c.id));
  /** R2-ESC-02 — dedup do rótulo compacto enquanto o catálogo tiver siglas duplicadas legadas. */
  const shortLabels = capabilityShortLabels(store.capabilities);

  const reportInput = () => ({
    scopeLabel,
    generatedAt: new Date(),
    architects,
    capabilities: store.capabilities,
    capabilityAveragesFor: sel.capabilityAverages,
    blocking,
    opportunity,
    mastery,
  });

  const exportCsv = () => {
    try {
      exportTeamReportCsv(t, reportInput());
    } catch {
      toast.error(t("gap.export.error"));
    }
  };

  const exportPdf = async () => {
    setExportingPdf(true);
    try {
      // `jspdf`/`jspdf-autotable` arrastam `html2canvas`/`canvg` (~600kB) —
      // import() dinâmico mantém esse peso fora do chunk de `/progression`,
      // baixado só quando alguém de fato clica em exportar.
      const { exportTeamReportPdf } = await import("@/lib/team-report-pdf");
      await exportTeamReportPdf(t, reportInput());
    } catch {
      toast.error(t("gap.export.error"));
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t("progression.title")}
        description={t("progression.subtitle")}
        help={help}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ArchitectFilter
              architects={store.architects}
              selected={selected}
              onChange={setSelected}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={architects.length === 0}
              onClick={exportCsv}
            >
              {t("gap.export.csv")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={architects.length === 0 || exportingPdf}
              onClick={() => void exportPdf()}
            >
              {exportingPdf ? t("gap.export.generating") : t("gap.export.pdf")}
            </Button>
          </div>
        }
      />

      {architects.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-medium">{t("gap.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {store.architects.length === 0
              ? t("gap.empty.noArchitects")
              : t("gap.empty.filterHint")}
          </p>
        </div>
      ) : (
        <>
          <SectionCard
            title={t("gap.heatmap.title")}
            description={t("gap.heatmap.subtitle", { escopo: scopeLabel })}
          >
            {/* ENT-09-016 — cabeçalho fixo: o heatmap cresce uma linha por arquiteto do time. */}
            <HeatmapColumnsNotice
              shown={visibleCapabilities.length}
              total={store.capabilities.length}
              showAll={showAllColumns}
              onToggle={() => setShowAllColumns((v) => !v)}
            />
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full min-w-[720px] border-separate border-spacing-1 text-sm">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 top-0 z-20 w-44 bg-card text-left text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      {t("col.architect")}
                    </th>
                    {visibleCapabilities.map((c) => (
                      <th
                        key={c.id}
                        scope="col"
                        className="sticky top-0 z-10 max-w-[64px] truncate bg-card text-center text-[11px] text-muted-foreground"
                        title={c.name}
                      >
                        {shortLabels.get(c.id) ?? c.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {architects.map((a) => (
                    <tr key={a.id}>
                      <td className="sticky left-0 z-10 bg-card text-sm font-medium">{a.name}</td>
                      {sel
                        .capabilityAverages(a.id)
                        .filter((d) => visibleCapabilityIds.has(d.capability.id))
                        .map((d) => (
                          <td key={d.capability.id} className="min-w-[52px]">
                            <LevelCell
                              level={d.avg === undefined ? undefined : Math.round(d.avg)}
                            />
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
            <GapTable rows={[...blocking, ...opportunity]} capabilities={store.capabilities} />
          </SectionCard>

          {mastery.length > 0 && (
            <SectionCard
              className="mt-6"
              title={t("gap.mastery.title")}
              description={t("gap.mastery.subtitle", { escopo: scopeLabel })}
            >
              <GapTable rows={mastery} capabilities={store.capabilities} mastery />
            </SectionCard>
          )}
        </>
      )}
    </>
  );
}
