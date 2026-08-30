import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { downloadBlob, type BlobDownload } from "@/lib/download";
import type { MessageKey } from "@/lib/i18n";
import {
  TeamReportPresenter,
  type T,
  type TeamReportGapSection,
  type TeamReportGapSectionKind,
  type TeamReportInput,
} from "@/lib/presenters";
import type { GapSeverityRuler } from "@/lib/scoring-bands";

export class TeamReportPdfBuilder {
  private static readonly MARGIN = 40;
  private static readonly PAGE_BREAK_Y = 700;
  private static readonly TABLE_STYLE = {
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [60, 60, 60] as [number, number, number] },
  };

  private readonly presenter: TeamReportPresenter;

  private readonly sectionTitle: Record<TeamReportGapSectionKind, MessageKey> = {
    blocking: "gap.export.pdf.blockingSection",
    opportunity: "gap.export.pdf.opportunitySection",
    mastery: "gap.export.pdf.masterySection",
  };

  private doc!: jsPDF;
  private y = TeamReportPdfBuilder.MARGIN;

  constructor(
    private readonly t: T,
    private readonly input: TeamReportInput,
    ruler?: GapSeverityRuler,
    private readonly downloadFile: BlobDownload = downloadBlob,
  ) {
    this.presenter = new TeamReportPresenter(t, input, ruler);
  }

  get filename(): string {
    return this.presenter.filename("pdf");
  }

  build(): Blob {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
    this.y = TeamReportPdfBuilder.MARGIN;
    this.writeCover();
    this.writeHeatmap();
    for (const section of this.presenter.gapSections) {
      this.writeGapSection(section);
    }
    return this.doc.output("blob");
  }

  download(): void {
    this.downloadFile(this.build(), this.filename);
  }

  private writeCover(): void {
    const margin = TeamReportPdfBuilder.MARGIN;
    this.doc.setFontSize(16);
    this.doc.text(this.t("gap.export.pdf.title"), margin, this.y);
    this.y += 20;
    this.doc.setFontSize(9);
    this.doc.setTextColor(90);
    this.doc.text(this.input.scopeLabel, margin, this.y);
    this.y += 14;
    this.doc.text(
      this.t("gap.export.pdf.generatedAt", { data: this.input.generatedAt.toLocaleString() }),
      margin,
      this.y,
    );
    this.y += 20;
    this.doc.setTextColor(20);
  }

  private writeHeatmap(): void {
    this.writeSectionTitle(this.t("gap.export.pdf.heatmapSection"));
    this.writeTable(this.presenter.heatmapHead, this.presenter.heatmapBody);
  }

  private writeGapSection(section: TeamReportGapSection): void {
    if (section.rows.length === 0) return;
    if (this.y > TeamReportPdfBuilder.PAGE_BREAK_Y) {
      this.doc.addPage();
      this.y = TeamReportPdfBuilder.MARGIN;
    }
    this.writeSectionTitle(this.t(this.sectionTitle[section.kind]));
    this.writeTable(
      this.presenter.gapColumns(section.mastery),
      this.presenter.gapRows(section.rows, section.mastery),
    );
  }

  private writeSectionTitle(title: string): void {
    this.doc.setFontSize(12);
    this.doc.text(title, TeamReportPdfBuilder.MARGIN, this.y);
    this.y += 8;
  }

  private writeTable(head: string[], body: (string | number)[][]): void {
    const margin = TeamReportPdfBuilder.MARGIN;
    autoTable(this.doc, {
      startY: this.y,
      margin: { left: margin, right: margin },
      ...TeamReportPdfBuilder.TABLE_STYLE,
      head: [head],
      body,
    });
    this.y = this.tableEndY() + 24;
  }

  private tableEndY(): number {
    return (this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  }
}

export async function exportTeamReportPdf(
  t: T,
  input: TeamReportInput,
  ruler?: GapSeverityRuler,
): Promise<void> {
  new TeamReportPdfBuilder(t, input, ruler).download();
}
