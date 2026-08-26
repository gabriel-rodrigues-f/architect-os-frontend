import { downloadBlob } from "@/lib/download";
import {
  TeamReportPresenter,
  type T,
  type TeamReportInput,
} from "@/lib/presenters/team-report-presenter";
import type { GapSeverityRuler } from "@/lib/scoring-bands";

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(fields: (string | number)[]): string {
  return fields.map(csvField).join(",") + "\r\n";
}

function gapRowsToCsv(
  presenter: TeamReportPresenter,
  rows: TeamReportInput["blocking"],
  mastery: boolean,
): string {
  let out = csvRow(presenter.gapColumns(mastery));
  for (const row of presenter.gapRows(rows, mastery)) {
    out += csvRow(row);
  }
  return out;
}

export function exportTeamReportCsv(t: T, input: TeamReportInput, ruler?: GapSeverityRuler): void {
  const presenter = new TeamReportPresenter(t, input, ruler);
  const heatmapHeader = csvRow(presenter.heatmapHead);
  const heatmapRows = presenter.heatmapBody.map(csvRow).join("");

  let csv = "﻿";
  csv += `${t("gap.export.csv.heatmapSection")}\r\n`;
  csv += heatmapHeader + heatmapRows;
  csv += "\r\n";
  csv += `${t("gap.export.csv.blockingSection")}\r\n`;
  csv += gapRowsToCsv(presenter, input.blocking, false);
  csv += "\r\n";
  csv += `${t("gap.export.csv.opportunitySection")}\r\n`;
  csv += gapRowsToCsv(presenter, input.opportunity, false);
  if (input.mastery.length > 0) {
    csv += "\r\n";
    csv += `${t("gap.export.csv.masterySection")}\r\n`;
    csv += gapRowsToCsv(presenter, input.mastery, true);
  }

  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), presenter.filename("csv"));
}
