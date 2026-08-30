import { capabilityShortLabels, type Architect, type Capability } from "../domain";
import type { MessageKey } from "../i18n";
import { defaultGapSeverityRuler, type GapSeverityRuler } from "../scoring-bands";
import type { CapabilityAverage, ConsolidatedGapRow } from "../selectors";
import { defaultDateFormatter } from "../text";

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

export type TeamReportGapSectionKind = "blocking" | "opportunity" | "mastery";

export interface TeamReportGapSection {
  kind: TeamReportGapSectionKind;
  rows: ConsolidatedGapRow[];
  mastery: boolean;
}

export class TeamReportPresenter {
  constructor(
    private readonly t: T,
    private readonly input: TeamReportInput,
    private readonly ruler: GapSeverityRuler = defaultGapSeverityRuler,
  ) {}

  get heatmapHead(): string[] {
    const shortLabels = capabilityShortLabels(this.input.capabilities);
    return [
      this.t("col.architect"),
      ...this.input.capabilities.map((c) => shortLabels.get(c.id) ?? c.short),
    ];
  }

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

  get gapSections(): TeamReportGapSection[] {
    return [
      { kind: "blocking", rows: this.input.blocking, mastery: false },
      { kind: "opportunity", rows: this.input.opportunity, mastery: false },
      { kind: "mastery", rows: this.input.mastery, mastery: true },
    ];
  }

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

  filename(extension: "csv" | "pdf"): string {
    return `progressao-time-${defaultDateFormatter.isoDate(this.input.generatedAt)}.${extension}`;
  }

  private formatAvg(value: number | undefined): string {
    return value === undefined ? "—" : String(Math.round(value));
  }

  private capabilityName(id: string): string {
    return this.input.capabilities.find((c) => c.id === id)?.name ?? id;
  }

  private gapTypeLabel(row: ConsolidatedGapRow): string {
    return row.requirementType === "RESTRICTIVE"
      ? this.t("gap.type.blocking")
      : this.t("gap.type.opportunity");
  }

  private gapClassificationLabel(row: ConsolidatedGapRow, mastery: boolean): string {
    if (mastery) return this.t("gap.mastery.badge", { n: row.maxGap });
    const gap = row.maxGap;
    const rotulo = this.t(this.ruler.messageKey[this.ruler.severityOf(gap)]);
    return this.t("gap.badge", { n: Math.max(0, gap), rotulo });
  }
}
