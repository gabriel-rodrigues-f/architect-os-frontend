import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ArchitectFilter } from "@/components/app/ArchitectFilter";
import { CapabilityHeatmap } from "@/components/app/CapabilityHeatmap";
import { GapTable, useGapAnalysisData } from "@/components/app/gap-analysis-shared";
import { EmptyState, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useGapSeverityRuler, useSelectors } from "@/lib/store";
import { exportTeamReportCsv } from "@/lib/team-report-csv";

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

  const ruler = useGapSeverityRuler();
  const { store, selected, setSelected, architects, blocking, opportunity, mastery, scopeLabel } =
    useGapAnalysisData();
  const [exportingPdf, setExportingPdf] = useState(false);

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
      exportTeamReportCsv(t, reportInput(), ruler);
    } catch {
      toast.error(t("gap.export.error"));
    }
  };

  const exportPdf = async () => {
    setExportingPdf(true);
    try {
      const { exportTeamReportPdf } = await import("@/lib/team-report-pdf");
      await exportTeamReportPdf(t, reportInput(), ruler);
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
        <EmptyState
          title={t("gap.empty")}
          hint={
            store.architects.length === 0 ? t("gap.empty.noArchitects") : t("gap.empty.filterHint")
          }
        />
      ) : (
        <>
          <SectionCard
            title={t("gap.heatmap.title")}
            description={t("gap.heatmap.subtitle", { escopo: scopeLabel })}
          >
            <CapabilityHeatmap
              architects={architects}
              capabilities={store.capabilities}
              capabilityAveragesFor={sel.capabilityAverages}
            />
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
