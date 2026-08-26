import {
  capabilityShortLabels,
  GAP_SEVERITY_MESSAGE_KEY,
  gapSeverityOf,
  type Architect,
  type Capability,
} from "../domain";
import type { MessageKey } from "../i18n";
import type { CapabilityAverage, ConsolidatedGapRow } from "../selectors";
import { defaultDateFormatter } from "../text";

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-28 (§40/§41) — o
 * relatório do time (`/progression`) é gerado inteiramente no cliente: os
 * números já são os mesmos que a tela mostra (`useGapAnalysisData`,
 * `sel.capabilityAverages`).
 *
 * OO3-11j — as 8 funções soltas de `team-report-shared.ts` viraram esta
 * classe (apresentação: cabeçalhos, linhas, rótulos, nome do arquivo);
 * `downloadBlob` foi para `lib/download.ts` (efeito de DOM) e `isoDate`
 * virou `DateFormatter.isoDate`. A montagem de CSV (RFC 4180) e a de PDF
 * (jsPDF) ficam nos seus módulos — é serialização, não apresentação, e o
 * isolamento do `jspdf` (~600kB, import dinâmico em `progression.tsx`) não
 * pode ser quebrado: esta classe NÃO importa `jspdf`, nem transitivamente.
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

export class TeamReportPresenter {
  constructor(
    private readonly t: T,
    private readonly input: TeamReportInput,
  ) {}

  /** R2-ESC-02 — dedup das siglas enquanto o catálogo tiver duplicatas legadas. */
  get heatmapHead(): string[] {
    const shortLabels = capabilityShortLabels(this.input.capabilities);
    return [
      this.t("col.architect"),
      ...this.input.capabilities.map((c) => shortLabels.get(c.id) ?? c.short),
    ];
  }

  /** Uma linha por arquiteto; "—" onde não há média (nunca `0` — ausência não é nível baixo). */
  get heatmapBody(): (string | number)[][] {
    return this.input.architects.map((a) => {
      const averages = this.input.capabilityAveragesFor(a.id);
      return [
        a.name,
        ...this.input.capabilities.map((c) =>
          this.formatAvg(averages.find((d) => d.capability.id === c.id)?.avg),
        ),
      ];
    });
  }

  /** Colunas da tabela de lacunas — `mastery` omite a coluna de tipo (sem "próximo nível" pra bloquear). */
  gapColumns(mastery: boolean): string[] {
    return [
      this.t("col.competency"),
      this.t("col.capability"),
      ...(mastery ? [] : [this.t("col.type")]),
      this.t("col.people"),
      this.t("col.currentAvg"),
      this.t("col.targetAvg"),
      this.t("col.avgGap"),
      this.t("col.classification"),
    ];
  }

  gapRows(rows: readonly ConsolidatedGapRow[], mastery: boolean): (string | number)[][] {
    return rows.map((row) => [
      row.name,
      this.capabilityName(row.capabilityId),
      ...(mastery ? [] : [this.gapTypeLabel(row)]),
      row.people,
      row.avgFinal,
      row.avgTarget,
      row.avgGap,
      this.gapClassificationLabel(row, mastery),
    ]);
  }

  /** Nome do arquivo exportado — data em UTC de propósito (mudar para fuso local trocaria o nome à noite no Brasil). */
  filename(extension: "csv" | "pdf"): string {
    return `progressao-time-${defaultDateFormatter.isoDate(this.input.generatedAt)}.${extension}`;
  }

  private formatAvg(value: number | undefined): string {
    return value === undefined ? "—" : String(Math.round(value));
  }

  private capabilityName(id: string): string {
    return this.input.capabilities.find((c) => c.id === id)?.name ?? id;
  }

  /** Coluna "Tipo" — bloqueante × oportunidade. */
  private gapTypeLabel(row: ConsolidatedGapRow): string {
    return row.requirementType === "RESTRICTIVE"
      ? this.t("gap.type.blocking")
      : this.t("gap.type.opportunity");
  }

  /**
   * Coluna "Classificação" — a MESMA régua do `GapBadge` na tela, agora de
   * fato compartilhada via `gapSeverityOf`/`GAP_SEVERITY_MESSAGE_KEY`
   * (OO3-11i) em vez de reproduzida à mão — o fim da régua dupla que o
   * comentário do antigo `team-report-shared.ts` aceitava "por ser trivial
   * de auditar lado a lado".
   */
  private gapClassificationLabel(row: ConsolidatedGapRow, mastery: boolean): string {
    if (mastery) return this.t("gap.mastery.badge", { n: row.maxGap });
    const gap = row.maxGap;
    const rotulo = this.t(GAP_SEVERITY_MESSAGE_KEY[gapSeverityOf(gap)]);
    return this.t("gap.badge", { n: Math.max(0, gap), rotulo });
  }
}
