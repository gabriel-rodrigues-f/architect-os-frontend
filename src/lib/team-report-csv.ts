import { downloadBlob } from "@/lib/download";
import {
  TeamReportPresenter,
  type T,
  type TeamReportInput,
} from "@/lib/presenters/team-report-presenter";

/** Escapa um campo para CSV (RFC 4180): aspas duplicadas, campo entre aspas se tiver vírgula/aspas/quebra de linha. */
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

/**
 * OO3-11j — o conteúdo (cabeçalhos, linhas, rótulos, nome do arquivo) vem do
 * `TeamReportPresenter`; aqui fica só a serialização CSV.
 */
export function exportTeamReportCsv(t: T, input: TeamReportInput): void {
  const presenter = new TeamReportPresenter(t, input);
  const heatmapHeader = csvRow(presenter.heatmapHead);
  const heatmapRows = presenter.heatmapBody.map(csvRow).join("");

  let csv = "﻿"; // BOM — acentos corretos ao abrir no Excel.
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
