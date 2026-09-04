import type { MessageKey } from "../i18n/registry";
import type { SessionUser } from "../api";
import type { Architect, RoleName } from "../domain";
import type { TeamSummary } from "../gateways/teams.gateway";
import type { UiAuthorizationPolicy } from "../scope";
import { SeniorityReading } from "../seniority";
import type { Api } from "../store";

/** Vazio enquanto nenhum nível de carreira estiver escolhido — nunca um `RoleName` inventado. */
export type ArchitectFormRole = RoleName | "";

/**
 * ONDA 37 — o que /team ainda escreve. Cadastrar, editar e desativar saíram
 * daqui: a pessoa nasce, muda de cargo e é desativada em Usuários, num ato
 * só (backend ADR-0084). `updateArchitect` fica pela REATIVAÇÃO, que é o
 * único caminho de volta que a interface tem — o filtro "Inativos" só existe
 * nesta tela.
 */
export type TeamRosterService = Pick<
  Api,
  | "updateArchitect"
  | "transitionCareerLevel"
  | "allocateArchitectToTeam"
  | "releaseArchitectFromTeam"
>;

export class TeamOrLevelChange {
  constructor(
    readonly architect: Architect,
    readonly toRole: ArchitectFormRole,
    readonly toTeamId: string | null,
  ) {}

  get levelChanged(): boolean {
    if (!SeniorityReading.has(this.architect)) return false;
    return this.toRole !== "" && this.toRole !== this.architect.role;
  }

  get teamChanged(): boolean {
    return this.toTeamId !== (this.architect.teamId ?? null);
  }

  get isEffective(): boolean {
    return this.levelChanged || this.teamChanged;
  }

  /**
   * A pergunta do campo de motivo acompanha o que está mudando de verdade.
   * Pedido do dono (2026-09-03): *"se eu estiver mudando o nível, quero ver
   * 'Por que o nível de carreira está mudando?'; se eu estiver mudando o
   * time, 'Por que o time está mudando?'"*. Mudando os dois — ou ainda nada —
   * a pergunta é a das duas coisas, que é a única honesta nesse instante.
   */
  get reasonPlaceholderKey(): MessageKey {
    if (this.levelChanged && !this.teamChanged) return "team.transition.reasonPlaceholder.level";
    if (this.teamChanged && !this.levelChanged) return "team.transition.reasonPlaceholder.team";
    return "team.transition.reasonPlaceholder";
  }
}

export class TeamViewModel {
  constructor(
    private readonly service: TeamRosterService,
    private readonly policy: UiAuthorizationPolicy,
  ) {}

  isAdmin(user: SessionUser): boolean {
    return this.policy.isAdmin(user);
  }

  allocatableTeams(teams: readonly TeamSummary[]): TeamSummary[] {
    return teams.filter((team) => team.active);
  }

  teamNameOf(teamId: string | null | undefined, teams: readonly TeamSummary[]): string | null {
    if (teamId == null) return null;
    return teams.find((team) => team.id === teamId)?.name ?? null;
  }

  otherCareerLevels<TLevel extends { name: string }>(
    levels: readonly TLevel[],
    currentRole: RoleName | null,
  ): TLevel[] {
    return levels.filter((level) => level.name !== currentRole);
  }

  reactivate(architect: Architect): void {
    this.service.updateArchitect(architect.id, { active: true });
  }

  transitionCareerLevel(architectId: string, toRole: RoleName, reason: string): Promise<Architect> {
    return this.service.transitionCareerLevel(architectId, toRole, reason);
  }

  async changeTeamOrLevel(change: TeamOrLevelChange, reason: string): Promise<Architect> {
    const { id } = change.architect;
    let updated = change.architect;
    if (change.levelChanged && change.toRole !== "") {
      updated = await this.service.transitionCareerLevel(id, change.toRole, reason);
    }
    if (change.teamChanged) {
      updated =
        change.toTeamId === null
          ? await this.service.releaseArchitectFromTeam(id)
          : await this.service.allocateArchitectToTeam(id, change.toTeamId, reason);
    }
    return updated;
  }
}
