import { ApiError, UserFacingError } from "../api-errors";
import type { Architect } from "../domain";
import type { SessionUser, TeamMemberRole } from "../gateways/auth.gateway";
import { TeamMemberRoles } from "../gateways/auth.gateway";
import type { TeamSummary } from "../gateways/teams.gateway";
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

  private constructor(readonly activeArchitects: number) {}

  static of(error: unknown): TeamDeactivationRefusal | null {
    if (!(error instanceof ApiError) || error.code !== TeamDeactivationRefusal.CODE) return null;
    const details = error.details as { activeArchitects?: unknown } | undefined;
    const count = details?.activeArchitects;
    return typeof count === "number" ? new TeamDeactivationRefusal(count) : null;
  }
}

export class TeamRegistryViewModel {
  constructor(private readonly policy: UiAuthorizationPolicy) {}

  canAdminister(user: SessionUser): boolean {
    return this.policy.isAdmin(user);
  }

  canCompose(user: SessionUser): boolean {
    return this.policy.canComposeAnyTeam(user);
  }

  canComposeTeam(user: SessionUser, teamId: string): boolean {
    return this.policy.canComposeTeam(user, teamId);
  }

  canReadAccountDirectory(user: SessionUser): boolean {
    return this.policy.isAdmin(user);
  }

  membershipRolesOfferedTo(user: SessionUser): TeamMemberRole[] {
    return TeamMemberRoles.ALL.filter(
      (role) => role !== TeamMemberRoles.MANAGER || this.policy.isAdmin(user),
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

  activePeopleOf(teamId: string, architects: readonly Architect[]): Architect[] {
    return architects.filter((architect) => architect.active && architect.teamId === teamId);
  }

  allocatableTo(teamId: string, architects: readonly Architect[]): Architect[] {
    return architects
      .filter((architect) => architect.active && architect.teamId !== teamId)
      .sort(defaultNameFormatter.byName);
  }

  teamNameOf(teamId: string | null | undefined, teams: readonly TeamSummary[]): string | null {
    if (teamId == null) return null;
    return teams.find((team) => team.id === teamId)?.name ?? null;
  }

  allocationRefusalOf(error: unknown): string | null {
    if (!(error instanceof ApiError)) return null;
    return error.status === 403 || error.status === 409 ? error.message : null;
  }

  linkableAccounts(accounts: readonly SessionUser[]): SessionUser[] {
    return accounts.filter((account) => account.role !== "admin" && account.status === "active");
  }

  deactivationRefusalOf(error: unknown): TeamDeactivationRefusal | null {
    return TeamDeactivationRefusal.of(error);
  }
}
