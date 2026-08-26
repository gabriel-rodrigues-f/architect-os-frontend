import type { SessionUser } from "../api";
import { DEFAULT_CURATION_POLICY, type CurationPolicy } from "../curation-policy";
import type { CareerLevel, Capability, Competency, Level, RequirementType } from "../domain";
import type { UiAuthorizationPolicy } from "../scope";
import type { Api } from "../store";

export type CatalogService = Pick<
  Api,
  | "addCapability"
  | "updateCapability"
  | "removeCapability"
  | "addCompetency"
  | "updateCompetency"
  | "removeCompetency"
  | "swapCompetencyRequirement"
>;

export class CompetencyMatrixViewModel {
  constructor(
    private readonly service: CatalogService,
    private readonly policy: UiAuthorizationPolicy,
    private readonly curationPolicy: CurationPolicy = DEFAULT_CURATION_POLICY,
  ) {}

  get limits(): CurationPolicy {
    return this.curationPolicy;
  }

  isAdmin(user: SessionUser): boolean {
    return this.policy.isAdmin(user);
  }

  createCapability(name: string): Promise<Capability> {
    return this.service.addCapability({ name: name.trim(), active: true });
  }

  renameCapability(id: string, name: string): void {
    this.service.updateCapability(id, { name: name.trim() });
  }

  removeCapability(id: string): Promise<{ archived: boolean; competenciesRemoved: number }> {
    return this.service.removeCapability(id);
  }

  restoreCapability(id: string): void {
    this.service.updateCapability(id, { active: true });
  }

  isCapabilityAtCapacity(capability: Pick<Capability, "curation">): boolean {
    return capability.curation.activeCompetencyCount >= this.curationPolicy.maxActiveCompetencies;
  }

  createCompetency(
    capabilityId: string,
    name: string,
    levels: Partial<Record<string, Level>>,
    requirementType: RequirementType,
  ): Promise<Competency> {
    return this.service.addCompetency({
      name: name.trim(),
      capabilityId,
      requirementType,
      expected: levels as Record<string, Level>,
      active: true,
    });
  }

  canCreateCompetency(
    name: string,
    levels: Partial<Record<string, Level>>,
    careerLevels: readonly Pick<CareerLevel, "id">[],
  ): boolean {
    return name.trim().length > 0 && careerLevels.every((cl) => levels[cl.id] !== undefined);
  }

  updateCompetency(
    id: string,
    name: string,
    levels: Partial<Record<string, Level>>,
    requirementType: RequirementType,
  ): void {
    this.service.updateCompetency(id, {
      name: name.trim(),
      expected: levels as Record<string, Level>,
      requirementType,
    });
  }

  removeCompetency(id: string): Promise<{ archived: boolean }> {
    return this.service.removeCompetency(id);
  }

  restoreCompetency(id: string): void {
    this.service.updateCompetency(id, { active: true });
  }

  swapRequirementType(id: string, withCompetencyId: string): Promise<void> {
    return this.service.swapCompetencyRequirement(id, withCompetencyId);
  }

  isRequirementTypeFull(
    capability: Pick<Capability, "curation"> | undefined,
    type: RequirementType,
    excluding?: Pick<Competency, "requirementType"> | null,
  ): boolean {
    const count =
      type === "RESTRICTIVE"
        ? (capability?.curation.restrictiveCompetencyCount ?? 0)
        : (capability?.curation.nonRestrictiveCompetencyCount ?? 0);
    const limit =
      type === "RESTRICTIVE"
        ? this.curationPolicy.requiredRestrictive
        : this.curationPolicy.requiredNonRestrictive;
    const adjustment = excluding?.requirementType === type ? 1 : 0;
    return count - adjustment >= limit;
  }

  swapCandidates(
    competencies: readonly Competency[],
    capabilityId: string,
    type: RequirementType,
    excludingCompetencyId: string,
  ): Competency[] {
    return competencies.filter(
      (c) =>
        c.capabilityId === capabilityId &&
        c.active &&
        c.requirementType === type &&
        c.id !== excludingCompetencyId,
    );
  }
}
