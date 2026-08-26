import type { Architect, Capability } from "../domain";
import type { MessageKey } from "../i18n";
import {
  concentrationRiskMaxReferencesFrom,
  DEFAULT_SCORING_BANDS,
  proficiencyViewBandsFrom,
  type ProficiencyViewBand,
  type ScoringBand,
} from "../scoring-bands";
import type { CapabilityAverage } from "../selectors";

export const BANDS: readonly ProficiencyViewBand[] = proficiencyViewBandsFrom(
  DEFAULT_SCORING_BANDS.PROFICIENCY,
);

export type RiskState =
  "insufficientData" | "noReference" | "concentrationRisk" | "distributedCoverage";

export interface CapabilityCoverageArea {
  cat: Capability;
  bands: {
    key: string;
    labelKey: MessageKey;
    tone: string;
    people: { architect: Architect; level: number }[];
  }[];
  assessedCount: number;
  notAssessed: number;
  references: { architect: Architect; level: number }[];
  risk: RiskState;
}

export class CapabilityCoveragePresenter {
  readonly bands: readonly ProficiencyViewBand[];
  private readonly concentrationRiskMaxReferences: number;

  constructor(
    private readonly capabilities: readonly Capability[],
    private readonly capabilityAveragesFor: (architectId: string) => readonly CapabilityAverage[],
    scales: {
      PROFICIENCY: readonly ScoringBand[];
      CONCENTRATION_RISK: readonly ScoringBand[];
    } = DEFAULT_SCORING_BANDS,
  ) {
    this.bands = proficiencyViewBandsFrom(scales.PROFICIENCY);
    this.concentrationRiskMaxReferences = concentrationRiskMaxReferencesFrom(
      scales.CONCENTRATION_RISK,
    );
  }

  classifyRisk(assessedCount: number, referenceCount: number): RiskState {
    if (assessedCount === 0) return "insufficientData";
    if (referenceCount === 0) return "noReference";
    if (referenceCount < this.concentrationRiskMaxReferences) return "concentrationRisk";
    return "distributedCoverage";
  }

  areas(population: readonly Architect[]): CapabilityCoverageArea[] {
    return this.capabilities
      .filter((cat) => cat.active)
      .map((cat) => {
        const people = population.map((a) => ({
          architect: a,
          level: this.capabilityAveragesFor(a.id).find((d) => d.capability.id === cat.id)?.avg,
        }));
        const assessed = people.filter(
          (p): p is { architect: Architect; level: number } => p.level !== undefined,
        );
        const notAssessed = people.length - assessed.length;
        const bands = this.bands.map((band) => ({
          ...band,
          people: assessed.filter((p) => p.level >= band.min && p.level < band.max),
        }));
        const experts = bands.find((b) => b.key === "experts")?.people ?? [];
        const advanced = bands.find((b) => b.key === "advanced")?.people ?? [];
        const references = [...experts, ...advanced];
        const risk = this.classifyRisk(assessed.length, references.length);
        return { cat, bands, assessedCount: assessed.length, notAssessed, references, risk };
      });
  }
}
