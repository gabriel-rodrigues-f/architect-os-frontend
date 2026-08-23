import {
  downloadBlob,
  formatAvg,
  gapColumnLabels,
  gapRowValues,
  isoDate,
  type T,
  type TeamReportInput,
} from "@/lib/team-report-shared";

/** Escapa um campo para CSV (RFC 4180): aspas duplicadas, campo entre aspas se tiver vírgula/aspas/quebra de linha. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(fields: (string | number)[]): string {
  return fields.map(csvField).join(",") + "\r\n";
}

function gapRowsToCsv(
  t: T,
  input: TeamReportInput,
  rows: TeamReportInput["blocking"],
  mastery: boolean,
): string {
  let out = csvRow(gapColumnLabels(t, mastery));
  for (const row of rows) {
    out += csvRow(gapRowValues(t, input, row, mastery));
  }
  return out;
}

export function exportTeamReportCsv(t: T, input: TeamReportInput): void {
  const heatmapHeader = csvRow([t("col.architect"), ...input.capabilities.map((c) => c.short)]);
  const heatmapRows = input.architects
    .map((a) => {
      const averages = input.capabilityAveragesFor(a.id);
      return csvRow([
        a.name,
        ...input.capabilities.map((c) =>
          formatAvg(averages.find((d) => d.capability.id === c.id)?.avg),
        ),
      ]);
    })
    .join("");

  let csv = "﻿"; // BOM — acentos corretos ao abrir no Excel.
  csv += `${t("gap.export.csv.heatmapSection")}\r\n`;
  csv += heatmapHeader + heatmapRows;
  csv += "\r\n";
  csv += `${t("gap.export.csv.blockingSection")}\r\n`;
  csv += gapRowsToCsv(t, input, input.blocking, false);
  csv += "\r\n";
  csv += `${t("gap.export.csv.opportunitySection")}\r\n`;
  csv += gapRowsToCsv(t, input, input.opportunity, false);
  if (input.mastery.length > 0) {
    csv += "\r\n";
    csv += `${t("gap.export.csv.masterySection")}\r\n`;
    csv += gapRowsToCsv(t, input, input.mastery, true);
  }

  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `progressao-time-${isoDate(input.generatedAt)}.csv`,
  );
}
