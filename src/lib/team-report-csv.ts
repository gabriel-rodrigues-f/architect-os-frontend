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

export class TeamReportCsvBuilder {
  private readonly presenter: TeamReportPresenter;

  private readonly sectionTitle: Record<TeamReportGapSectionKind, MessageKey> = {
    blocking: "gap.export.csv.blockingSection",
    opportunity: "gap.export.csv.opportunitySection",
    mastery: "gap.export.csv.masterySection",
  };

  constructor(
    private readonly t: T,
    input: TeamReportInput,
    ruler?: GapSeverityRuler,
    private readonly downloadFile: BlobDownload = downloadBlob,
  ) {
    this.presenter = new TeamReportPresenter(t, input, ruler);
  }

  get filename(): string {
    return this.presenter.filename("csv");
  }

  build(): string {
    let csv = "﻿";
    csv += `${this.t("gap.export.csv.heatmapSection")}\r\n`;
    csv += this.row(this.presenter.heatmapHead);
    csv += this.presenter.heatmapBody.map((row) => this.row(row)).join("");
    for (const section of this.presenter.gapSections) {
      if (section.kind === "mastery" && section.rows.length === 0) continue;
      csv += "\r\n";
      csv += `${this.t(this.sectionTitle[section.kind])}\r\n`;
      csv += this.table(section);
    }
    return csv;
  }

  blob(): Blob {
    return new Blob([this.build()], { type: "text/csv;charset=utf-8" });
  }

  download(): void {
    this.downloadFile(this.blob(), this.filename);
  }

  private table(section: TeamReportGapSection): string {
    let out = this.row(this.presenter.gapColumns(section.mastery));
    for (const row of this.presenter.gapRows(section.rows, section.mastery)) {
      out += this.row(row);
    }
    return out;
  }

  private row(fields: (string | number)[]): string {
    return fields.map((field) => this.field(field)).join(",") + "\r\n";
  }

  private field(value: string | number): string {
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
}

export function exportTeamReportCsv(t: T, input: TeamReportInput, ruler?: GapSeverityRuler): void {
  new TeamReportCsvBuilder(t, input, ruler).download();
}
