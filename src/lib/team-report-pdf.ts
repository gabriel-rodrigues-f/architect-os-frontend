import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { downloadBlob } from "@/lib/download";
import {
  TeamReportPresenter,
  type T,
  type TeamReportInput,
} from "@/lib/presenters/team-report-presenter";
import type { GapSeverityRuler } from "@/lib/scoring-bands";
import type { ConsolidatedGapRow } from "@/lib/selectors";

export async function exportTeamReportPdf(
  t: T,
  input: TeamReportInput,
  ruler?: GapSeverityRuler,
): Promise<void> {
  const presenter = new TeamReportPresenter(t, input, ruler);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;

  doc.setFontSize(16);
  doc.text(t("gap.export.pdf.title"), margin, y);
  y += 20;
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(input.scopeLabel, margin, y);
  y += 14;
  doc.text(
    t("gap.export.pdf.generatedAt", { data: input.generatedAt.toLocaleString() }),
    margin,
    y,
  );
  y += 20;

  doc.setTextColor(20);
  doc.setFontSize(12);
  doc.text(t("gap.export.pdf.heatmapSection"), margin, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [60, 60, 60] },
    head: [presenter.heatmapHead],
    body: presenter.heatmapBody,
  });
  y = tableEndY(doc) + 24;

  const gapSection = (title: string, rows: ConsolidatedGapRow[], mastery: boolean) => {
    if (rows.length === 0) return;
    if (y > 700) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(12);
    doc.text(title, margin, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [60, 60, 60] },
      head: [presenter.gapColumns(mastery)],
      body: presenter.gapRows(rows, mastery),
    });
    y = tableEndY(doc) + 24;
  };

  gapSection(t("gap.export.pdf.blockingSection"), input.blocking, false);
  gapSection(t("gap.export.pdf.opportunitySection"), input.opportunity, false);
  gapSection(t("gap.export.pdf.masterySection"), input.mastery, true);

  downloadBlob(doc.output("blob"), presenter.filename("pdf"));
}

function tableEndY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}
