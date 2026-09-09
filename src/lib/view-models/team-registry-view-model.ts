import { ApiError, UserFacingError } from "../api-errors";
import type { Professional } from "../domain";
import type { SessionUser, TeamMemberRole } from "../gateways/auth.gateway";
import { TeamMemberRoles, UserRoles } from "../gateways/auth.gateway";
import type { TeamSummary } from "../gateways/teams.gateway";
import { RefusalNumber } from "../refusal-number";
import type { UiAuthorizationPolicy } from "../scope";
import { defaultNameFormatter } from "../text";

export const TEAM_STATUS_FILTERS = ["active", "inactive", "all"] as const;
export type TeamStatusFilter = (typeof TEAM_STATUS_FILTERS)[number];

export class TeamStatusFilters {
  static readonly ALL = TEAM_STATUS_FILTERS;

  static includes(value: string): value is TeamStatusFilter {
    return (TEAM_STATUS_FILTERS as readonly string[]).includes(value);
  }
}

export class TeamDeactivationRefusal {
  static readonly CODE = "TEAM_STILL_HAS_PEOPLE";

  private constructor(readonly activeProfessionals: number) {}

  static of(error: unknown): TeamDeactivationRefusal | null {
    if (!(error instanceof ApiError) || error.code !== TeamDeactivationRefusal.CODE) return null;
    const details = error.details as { activeProfessionals?: unknown } | undefined;
    const count = details?.activeProfessionals;
    return typeof count === "number" ? new TeamDeactivationRefusal(count) : null;
  }
}

export class TeamRegistryViewModel {
  constructor(private readonly policy: UiAuthorizationPolicy) {}

  canAdminister(user: SessionUser): boolean {
    return this.policy.operatesTheSystem(user);
  }

  canCompose(user: SessionUser): boolean {
    return this.policy.canComposeAnyTeam(user);
  }

  canComposeTeam(user: SessionUser, teamId: string): boolean {
    return this.policy.canComposeTeam(user, teamId);
  }

  canReadAccountDirectory(user: SessionUser): boolean {
    return this.policy.operatesTheSystem(user);
  }

  membershipRolesOfferedTo(user: SessionUser): TeamMemberRole[] {
    return TeamMemberRoles.ALL.filter(
      (role) => !TeamMemberRoles.isManager(role) || this.policy.operatesTheSystem(user),
    );
  }

  canAlterBondWithRole(user: SessionUser, role: TeamMemberRole): boolean {
    return this.membershipRolesOfferedTo(user).includes(role);
  }

  rolesToMoveTo(user: SessionUser, currentRole: TeamMemberRole): TeamMemberRole[] {
    return this.membershipRolesOfferedTo(user).filter((role) => role !== currentRole);
  }

  rosterQueryKey(teamId: string): readonly ["team-roster", string] {
    return ["team-roster", teamId];
  }

  readingFailureOf(error: unknown): string | null {
    return error instanceof UserFacingError ? error.message : null;
  }

  reachableTeams(user: SessionUser, teams: readonly TeamSummary[]): TeamSummary[] {
    return teams.filter((team) => this.policy.canComposeTeam(user, team.id));
  }

  filterByStatus(teams: readonly TeamSummary[], filter: TeamStatusFilter): TeamSummary[] {
    if (filter === "all") return [...teams];
    return teams.filter((team) => team.active === (filter === "active"));
  }

  activePeopleOf(teamId: string, professionals: readonly Professional[]): Professional[] {
    return professionals.filter(
      (professional) => professional.active && professional.teamId === teamId,
    );
  }

  allocatableTo(teamId: string, professionals: readonly Professional[]): Professional[] {
    return professionals
      .filter((professional) => professional.active && professional.teamId !== teamId)
      .sort(defaultNameFormatter.byName);
  }

  teamNameOf(teamId: string | null | undefined, teams: readonly TeamSummary[]): string | null {
    if (teamId == null) return null;
    return teams.find((team) => team.id === teamId)?.name ?? null;
  }

  /**
   * A frase do serviço quando ele recusa mudar a pessoa de time — o roteiro
   * *"o Gerente do time atual pede a transferência e o Gerente do time de
   * destino aprova"*, que é instrução e não erro.
   *
   * REGRA 18 (dono, 2026-09-09): as duas recusas que chegam aqui
   * (`TEAM_TRANSFER_REQUIRES_REQUEST` e `TEAM_ALLOCATION_FORBIDDEN`) são de
   * **ATO** — a pessoa está na tela, o quadro está desenhado, e o que se
   * recusa é o gesto. Ficam em 403, com a frase.
   *
   * O 404 fica de fora de propósito, e é o outro lado da mesma regra: uma
   * recusa de ALCANCE viaja com o corpo de "não encontrado", byte a byte
   * igual ao de recurso inexistente. Repetir essa frase aqui seria colar
   * "profissional não encontrado" embaixo de um nome que a própria tela
   * acabou de listar — a tela cai na frase da casa, que não conta nada.
   */
  allocationRefusalOf(error: unknown): string | null {
    if (!(error instanceof ApiError)) return null;
    return RefusalNumber.isAct(error) || error.status === 409 ? error.message : null;
  }

  linkableAccounts(accounts: readonly SessionUser[]): SessionUser[] {
    return accounts.filter(
      (account) => !UserRoles.isOrganizationRole(account.role) && account.status === "active",
    );
  }

  deactivationRefusalOf(error: unknown): TeamDeactivationRefusal | null {
    return TeamDeactivationRefusal.of(error);
  }
}
