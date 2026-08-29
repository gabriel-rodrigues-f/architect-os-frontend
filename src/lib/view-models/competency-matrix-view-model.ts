import type { SessionUser } from "../api";
import { DEFAULT_CURATION_POLICY, type CurationPolicy } from "../curation-policy";
import type { Capability, Competency } from "../domain";
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
>;

/**
 * Fase 2 (backend ADRs 0032-0034) — o catálogo global é definição pura:
 * criar/editar competência é só nome + capacidade + atividade. Nível exigido,
 * obrigatoriedade e o swap de requisito moram na régua do time
 * (`/teams/:teamId/rules/:careerLevelId`), fora desta tela.
 */
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

  createCompetency(capabilityId: string, name: string): Promise<Competency> {
    return this.service.addCompetency({
      name: name.trim(),
      capabilityId,
      active: true,
    });
  }

  canCreateCompetency(name: string): boolean {
    return name.trim().length > 0;
  }

  updateCompetency(id: string, name: string): void {
    this.service.updateCompetency(id, { name: name.trim() });
  }

  removeCompetency(id: string): Promise<{ archived: boolean }> {
    return this.service.removeCompetency(id);
  }

  restoreCompetency(id: string): void {
    this.service.updateCompetency(id, { active: true });
  }
}
