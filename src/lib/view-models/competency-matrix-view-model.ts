import type { SessionUser } from "../api";
import {
  CompetencyCountRange,
  EffectiveCurationPolicy,
  type CurationPolicy,
} from "../curation-policy";
import type { Capability, Competency } from "../domain";
import type {
  CapabilityFoundationPayload,
  CompetencyRemovalSummary,
} from "../gateways/catalog.gateway";
import type { UiAuthorizationPolicy } from "../scope";
import type { Api } from "../store";

export type CatalogService = Pick<
  Api,
  | "foundCapability"
  | "updateCapability"
  | "removeCapability"
  | "addCompetency"
  | "updateCompetency"
  | "removeCompetency"
  | "removeCompetencies"
>;

export interface CurationBrief {
  status: Capability["curation"]["status"];
  active: number;
  min: number;
  max: number;
  over: number;
  missing: number;
  empty: boolean;
}

/**
 * Fase 2 (backend ADRs 0032-0034) — o catálogo global é definição pura:
 * criar/editar competência é só nome + capacidade + atividade. O nível
 * exigido mora na régua do time (`/teams/:teamId/rules/:careerLevelId`),
 * fora desta tela. Onda 36 (ADRs 0081-0082): o teto de ativas vem da
 * política de curadoria (nunca literal aqui) e é máximo, não meta.
 *
 * Onda 36.1/37 (ADRs 0083-0085): o intervalo ganhou PISO — "Pronta" é ter do
 * mínimo até o máximo, e a capacidade nasce fundada com as competências que a
 * definem (`foundCapability`), num ato só. Quem conhece os dois números é o
 * `CompetencyCountRange`; a tela lê `limits`, nunca escreve 3 nem 6.
 */
export class CompetencyMatrixViewModel {
  constructor(
    private readonly service: CatalogService,
    private readonly policy: UiAuthorizationPolicy,
    private readonly curationPolicy: CurationPolicy = EffectiveCurationPolicy.defaults,
  ) {}

  get limits(): CompetencyCountRange {
    return CompetencyCountRange.of(this.curationPolicy);
  }

  isAdmin(user: SessionUser): boolean {
    return this.policy.isAdmin(user);
  }

  foundCapability(foundation: CapabilityFoundationPayload): Promise<Capability> {
    return this.service.foundCapability(foundation);
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

  curationBriefFor(capability: Pick<Capability, "curation">): CurationBrief {
    const range = this.limits;
    const active = capability.curation.activeCompetencyCount;
    return {
      status: capability.curation.status,
      active,
      min: range.min,
      max: range.max,
      over: range.aboveMaximum(active),
      missing: range.missingToMinimum(active),
      empty: active === 0,
    };
  }

  isCapabilityAtCapacity(capability: Pick<Capability, "curation">): boolean {
    return this.limits.atCapacity(capability.curation.activeCompetencyCount);
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

  removeCompetencies(competencyIds: string[]): Promise<CompetencyRemovalSummary> {
    return this.service.removeCompetencies(competencyIds);
  }

  restoreCompetency(id: string): void {
    this.service.updateCompetency(id, { active: true });
  }
}
