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
  | "renameCompetency"
  | "updateCompetency"
  | "removeCompetency"
  | "removeCompetencies"
>;

export interface CurationBrief {
  status: Capability["curation"]["status"];
  /** Quantas competências a capacidade tem. Contava ATIVAS até 2026-09-10. */
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
    return this.policy.operatesTheSystem(user);
  }

  foundCapability(foundation: CapabilityFoundationPayload): Promise<Capability> {
    return this.service.foundCapability(foundation);
  }

  /**
   * A EDIÇÃO PEDIDA — a mesma régua do `removeItem` do view-model do PDI:
   * otimista, `onConfirmed` roda quando o SERVIÇO confirma, e é lá que mora o
   * aviso de sucesso, nunca no clique.
   */
  renameCapability(id: string, name: string, onConfirmed?: (updated: Capability) => void): void {
    this.service.updateCapability(id, { name: name.trim() }, onConfirmed);
  }

  /**
   * Ainda há o que salvar? A gravação otimista já deixou a capacidade com o
   * nome enviado antes da resposta, então isto vira `false` no instante do
   * clique e volta a `true` se o serviço recusar e o rollback devolver o nome
   * antigo — é a tranca do segundo envio, derivada do estado, sem um `saving`
   * local que ficaria preso na recusa.
   */
  hasPendingRename(capability: Pick<Capability, "name">, name: string): boolean {
    const trimmed = name.trim();
    return trimmed.length > 0 && trimmed !== capability.name;
  }

  /**
   * APAGA, OU RECUSA — dono (2026-09-10). Não há mais `{ archived }` na
   * resposta, nem `restoreCapability`: o que é apagado não volta, e o que tem
   * vínculo nunca sai.
   */
  removeCapability(id: string): Promise<{ competenciesRemoved: number }> {
    return this.service.removeCapability(id);
  }

  curationBriefFor(capability: Pick<Capability, "curation">): CurationBrief {
    const range = this.limits;
    const active = capability.curation.competencyCount;
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
    return this.limits.atCapacity(capability.curation.competencyCount);
  }

  createCompetency(capabilityId: string, name: string): Promise<Competency> {
    return this.service.addCompetency({ name: name.trim(), capabilityId });
  }

  canCreateCompetency(name: string): boolean {
    return name.trim().length > 0;
  }

  renameCompetency(id: string, name: string): Promise<Competency> {
    return this.service.renameCompetency(id, name.trim());
  }

  removeCompetency(id: string): Promise<void> {
    return this.service.removeCompetency(id);
  }

  removeCompetencies(competencyIds: string[]): Promise<CompetencyRemovalSummary> {
    return this.service.removeCompetencies(competencyIds);
  }
}
