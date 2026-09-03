import type { Competency, Level } from "../domain";
import type { TeamRuleDefinition, TeamRuleView } from "../gateways/career.gateway";

export interface TeamRuleCompetencyDraft {
  competencyId: string;
  requiredLevel: number;
}

export type TeamRuleErrorKey =
  | "teamRules.error.minimumBelowFloor"
  | "teamRules.error.competencyWithoutCapability"
  | "teamRules.error.levelOutOfRange";

export interface TeamRuleEditorInput {
  floor: number;
  competencyById: (id: string) => Competency | undefined;
  rule: TeamRuleView | null;
}

interface TeamRuleDraft {
  minimumQualifiedCapabilities: number;
  capabilityIds: readonly string[];
  competencies: readonly TeamRuleCompetencyDraft[];
}

const LOWEST_LEVEL = 1;
const HIGHEST_LEVEL = 5;

/**
 * Onda 36 (backend ADR-0082) — a obrigatoriedade morreu: a competência ESTÁ
 * ou NÃO ESTÁ na régua, com um nível exigido, e toda competência pesa igual
 * na aderência. O editor perdeu tipo de exigência, pesos e a troca de
 * obrigatoriedade.
 */
export class TeamRuleEditorViewModel {
  private constructor(
    private readonly input: TeamRuleEditorInput,
    private readonly baseline: TeamRuleDraft,
    private readonly draft: TeamRuleDraft,
  ) {}

  static from(input: TeamRuleEditorInput): TeamRuleEditorViewModel {
    const baseline: TeamRuleDraft = input.rule
      ? {
          minimumQualifiedCapabilities: input.rule.minimumQualifiedCapabilities,
          capabilityIds: [...input.rule.capabilityIds],
          competencies: input.rule.competencies.map((competency) => ({ ...competency })),
        }
      : { minimumQualifiedCapabilities: input.floor, capabilityIds: [], competencies: [] };
    return new TeamRuleEditorViewModel(input, baseline, baseline);
  }

  get hasRule(): boolean {
    return this.input.rule !== null;
  }

  get minimumQualifiedCapabilities(): number {
    return this.draft.minimumQualifiedCapabilities;
  }

  get capabilityIds(): readonly string[] {
    return this.draft.capabilityIds;
  }

  get competencies(): readonly TeamRuleCompetencyDraft[] {
    return this.draft.competencies;
  }

  withMinimum(minimumQualifiedCapabilities: number): TeamRuleEditorViewModel {
    return this.withDraft({ ...this.draft, minimumQualifiedCapabilities });
  }

  withCapability(capabilityId: string, required: boolean): TeamRuleEditorViewModel {
    if (required) {
      if (this.draft.capabilityIds.includes(capabilityId)) return this;
      return this.withDraft({
        ...this.draft,
        capabilityIds: [...this.draft.capabilityIds, capabilityId],
      });
    }
    return this.withDraft({
      ...this.draft,
      capabilityIds: this.draft.capabilityIds.filter((id) => id !== capabilityId),
      competencies: this.draft.competencies.filter(
        (competency) => this.capabilityOf(competency.competencyId) !== capabilityId,
      ),
    });
  }

  withCompetencyInRule(competencyId: string, requiredLevel: number): TeamRuleEditorViewModel {
    const entry: TeamRuleCompetencyDraft = { competencyId, requiredLevel };
    const known = this.draft.competencies.some(
      (competency) => competency.competencyId === competencyId,
    );
    return this.withDraft({
      ...this.draft,
      competencies: known
        ? this.draft.competencies.map((competency) =>
            competency.competencyId === competencyId ? entry : competency,
          )
        : [...this.draft.competencies, entry],
    });
  }

  withoutCompetency(competencyId: string): TeamRuleEditorViewModel {
    return this.withDraft({
      ...this.draft,
      competencies: this.draft.competencies.filter(
        (competency) => competency.competencyId !== competencyId,
      ),
    });
  }

  withRequiredLevel(competencyId: string, requiredLevel: number): TeamRuleEditorViewModel {
    return this.withDraft({
      ...this.draft,
      competencies: this.draft.competencies.map((competency) =>
        competency.competencyId === competencyId ? { ...competency, requiredLevel } : competency,
      ),
    });
  }

  get errorKeys(): readonly TeamRuleErrorKey[] {
    const keys: TeamRuleErrorKey[] = [];
    if (this.draft.minimumQualifiedCapabilities < this.input.floor) {
      keys.push("teamRules.error.minimumBelowFloor");
    }
    if (
      this.draft.competencies.some(
        (competency) => !this.isWithinRule(this.capabilityOf(competency.competencyId)),
      )
    ) {
      keys.push("teamRules.error.competencyWithoutCapability");
    }
    if (this.draft.competencies.some((competency) => !this.isLevel(competency.requiredLevel))) {
      keys.push("teamRules.error.levelOutOfRange");
    }
    return keys;
  }

  get isValid(): boolean {
    return this.errorKeys.length === 0;
  }

  get isDirty(): boolean {
    return this.serialize(this.draft) !== this.serialize(this.baseline);
  }

  get competencyCount(): number {
    return this.draft.competencies.length;
  }

  definition(): TeamRuleDefinition | null {
    if (!this.isValid) return null;
    const competencies = this.draft.competencies.flatMap((competency) =>
      this.isLevel(competency.requiredLevel)
        ? [{ competencyId: competency.competencyId, requiredLevel: competency.requiredLevel }]
        : [],
    );
    return {
      minimumQualifiedCapabilities: this.draft.minimumQualifiedCapabilities,
      capabilityIds: [...this.draft.capabilityIds],
      competencies,
    };
  }

  private withDraft(draft: TeamRuleDraft): TeamRuleEditorViewModel {
    return new TeamRuleEditorViewModel(this.input, this.baseline, draft);
  }

  private capabilityOf(competencyId: string): string | undefined {
    return this.input.competencyById(competencyId)?.capabilityId;
  }

  private isWithinRule(capabilityId: string | undefined): boolean {
    return capabilityId !== undefined && this.draft.capabilityIds.includes(capabilityId);
  }

  private isLevel(value: number): value is Level {
    return Number.isInteger(value) && value >= LOWEST_LEVEL && value <= HIGHEST_LEVEL;
  }

  private serialize(draft: TeamRuleDraft): string {
    return JSON.stringify([
      draft.minimumQualifiedCapabilities,
      draft.capabilityIds,
      draft.competencies,
    ]);
  }
}
