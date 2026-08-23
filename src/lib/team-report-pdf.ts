import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import type { ConsolidatedGapRow } from "@/components/app/gap-analysis-shared";
import {
  downloadBlob,
  formatAvg,
  gapColumnLabels,
  gapRowValues,
  isoDate,
  type T,
  type TeamReportInput,
} from "@/lib/team-report-shared";

/**
 * `pdfkit` já existe no backend (`reports/evolution-pdf-renderer.ts`), mas
 * não roda no browser — este arquivo é o único lugar do frontend que importa
 * `jspdf`/`jspdf-autotable` (que arrastam `html2canvas`/`canvg`, ~600kB),
 * exatamente para que `import()` dinâmico em `progression.tsx` baste para
 * manter esse peso fora do chunk da rota.
 */
export async function exportTeamReportPdf(t: T, input: TeamReportInput): Promise<void> {
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
    head: [[t("col.architect"), ...input.capabilities.map((c) => c.short)]],
    body: input.architects.map((a) => {
      const averages = input.capabilityAveragesFor(a.id);
      return [
        a.name,
        ...input.capabilities.map((c) =>
          formatAvg(averages.find((d) => d.capability.id === c.id)?.avg),
        ),
      ];
    }),
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
      head: [gapColumnLabels(t, mastery)],
      body: rows.map((row) => gapRowValues(t, input, row, mastery)),
    });
    y = tableEndY(doc) + 24;
  };

  gapSection(t("gap.export.pdf.blockingSection"), input.blocking, false);
  gapSection(t("gap.export.pdf.opportunitySection"), input.opportunity, false);
  gapSection(t("gap.export.pdf.masterySection"), input.mastery, true);

  downloadBlob(doc.output("blob"), `progressao-time-${isoDate(input.generatedAt)}.pdf`);
}

/** `lastAutoTable` é injetado pelo plugin no documento, sem tipo próprio exportado pela lib. */
function tableEndY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}
