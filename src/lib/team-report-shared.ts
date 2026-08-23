import type { ConsolidatedGapRow } from "@/components/app/gap-analysis-shared";
import type { Architect, Capability } from "@/lib/domain";
import type { MessageKey } from "@/lib/i18n";
import type { CapabilityAverage } from "@/lib/selectors";

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-28 (§40/§41) — "TL
 * volta pra planilha" porque o único export do produto é o PDF individual de
 * evolução (`evolution.tsx`); o mapa de calor + tabela de lacunas do TIME
 * (`/progression`) não tinha nenhum. Gerado inteiramente no cliente: os
 * números já são os mesmos que a tela mostra (`useGapAnalysisData`,
 * `sel.capabilityAverages`) — um endpoint que recalculasse isso no servidor
 * duplicaria a mesma lógica de gap/média (`lib/selectors.ts`) uma segunda
 * vez, o exato risco de divergência que a auditoria aponta em outro lugar
 * (§18, "próximo nível por rank" 2× no backend).
 *
 * Tipos/helpers em arquivo PRÓPRIO, separado de `team-report-csv.ts`/
 * `team-report-pdf.ts`: o PDF usa `jspdf`+`jspdf-autotable`, que arrastam
 * `html2canvas`/`canvg` (~600kB) para o chunk de quem os importa — CSV não
 * tem essa dependência. `progression.tsx` importa CSV estaticamente e PDF
 * via `import()` dinâmico (só no clique), então o peso do PDF nunca entra
 * no chunk da rota `/progression`, só é baixado se alguém de fato exportar.
 */
export interface TeamReportInput {
  scopeLabel: string;
  generatedAt: Date;
  architects: Pick<Architect, "id" | "name">[];
  capabilities: Pick<Capability, "id" | "name" | "short">[];
  capabilityAveragesFor: (architectId: string) => CapabilityAverage[];
  blocking: ConsolidatedGapRow[];
  opportunity: ConsolidatedGapRow[];
  mastery: ConsolidatedGapRow[];
}

export type T = (key: MessageKey, params?: Record<string, string | number>) => string;

export function formatAvg(value: number | undefined): string {
  return value === undefined ? "—" : String(Math.round(value));
}

export function capabilityName(capabilities: TeamReportInput["capabilities"], id: string): string {
  return capabilities.find((c) => c.id === id)?.name ?? id;
}

/** Coluna "Tipo" — bloqueante × oportunidade (não existe para `mastery`, sem próximo nível pra bloquear). */
export function gapTypeLabel(t: T, row: ConsolidatedGapRow): string {
  return row.requirementType === "RESTRICTIVE" ? t("gap.type.blocking") : t("gap.type.opportunity");
}

/**
 * Coluna "Classificação" — mesma régua de severidade do `GapBadge` na tela
 * (`components/app/ui-bits.tsx`), reproduzida aqui em vez de importar o
 * componente React (que devolve JSX, não texto). Duas fontes de verdade da
 * MESMA régua é um risco real (a auditoria já aponta esse padrão em outro
 * lugar — §18, "próximo nível por rank" 2× no backend); aceito aqui porque
 * a régua em si (`gap<=0 → ok, 1 → low, 2 → high, senão → critical`) é
 * estável há várias rodadas e trivial de auditar lado a lado no código.
 */
export function gapClassificationLabel(t: T, row: ConsolidatedGapRow, mastery: boolean): string {
  if (mastery) return t("gap.mastery.badge", { n: row.maxGap });
  const gap = row.maxGap;
  const rotulo =
    gap <= 0
      ? t("gap.ok")
      : gap === 1
        ? t("gap.recommended")
        : gap === 2
          ? t("gap.highPriority")
          : t("gap.critical");
  return t("gap.badge", { n: Math.max(0, gap), rotulo });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Colunas da tabela de lacunas, na ordem usada por CSV e PDF — `mastery` omite a coluna de tipo (sem sentido sem "próximo nível" pra bloquear). */
export function gapColumnLabels(t: T, mastery: boolean): string[] {
  return [
    t("col.competency"),
    t("col.capability"),
    ...(mastery ? [] : [t("col.type")]),
    t("col.people"),
    t("col.currentAvg"),
    t("col.targetAvg"),
    t("col.avgGap"),
    t("col.classification"),
  ];
}

export function gapRowValues(
  t: T,
  input: TeamReportInput,
  row: ConsolidatedGapRow,
  mastery: boolean,
): (string | number)[] {
  return [
    row.name,
    capabilityName(input.capabilities, row.capabilityId),
    ...(mastery ? [] : [gapTypeLabel(t, row)]),
    row.people,
    row.avgFinal,
    row.avgTarget,
    row.avgGap,
    gapClassificationLabel(t, row, mastery),
  ];
}
