import { ApiError } from "../api-errors";
import { teamRosterResponseSchema } from "../api-schemas";
import type { ApiClient } from "../api-client";
import { TeamMemberRoles, type TeamMemberRole } from "./auth.gateway";
import type { DataOrigin, OriginatedData } from "./data-origin";

export interface TeamRosterMember {
  userId: string;
  name: string;
  email: string;
  role: TeamMemberRole;
}

export interface AvailableTeamRoster extends OriginatedData {
  readonly reading: "available";
  readonly teamId: string;
  readonly members: readonly TeamRosterMember[];
}

export interface UnavailableTeamRoster extends OriginatedData {
  readonly reading: "unavailable";
  readonly teamId: string;
}

export type TeamRoster = AvailableTeamRoster | UnavailableTeamRoster;

export interface TeamRosterGateway {
  readonly dataOrigin: DataOrigin;
  rosterOf(teamId: string): Promise<TeamRoster>;
}

export class TeamRosterOrder {
  private static readonly RANK_BY_ROLE: Record<TeamMemberRole, number> = Object.fromEntries(
    TeamMemberRoles.ALL.map((role, index) => [role, index]),
  ) as Record<TeamMemberRole, number>;

  sorted(members: readonly TeamRosterMember[]): TeamRosterMember[] {
    return [...members].sort(
      (left, right) =>
        TeamRosterOrder.RANK_BY_ROLE[left.role] - TeamRosterOrder.RANK_BY_ROLE[right.role] ||
        left.name.localeCompare(right.name),
    );
  }
}

export class HttpTeamRosterGateway implements TeamRosterGateway {
  readonly dataOrigin: DataOrigin = "organization";

  constructor(private readonly client: ApiClient) {}

  rosterOf = (teamId: string): Promise<TeamRoster> =>
    this.client
      .request<unknown>(`/teams/${teamId}/memberships`)
      .then((data): TeamRoster => ({
        reading: "available",
        teamId,
        members: teamRosterResponseSchema.parse(data),
        dataOrigin: this.dataOrigin,
      }))
      .catch((error: unknown): TeamRoster => {
        if (error instanceof ApiError && error.status === 404) {
          return { reading: "unavailable", teamId, dataOrigin: this.dataOrigin };
        }
        throw error;
      });
}

export class InMemoryTeamRosterGateway implements TeamRosterGateway {
  readonly dataOrigin: DataOrigin = "demonstration";

  private readonly order = new TeamRosterOrder();

  constructor(
    private readonly membersByTeam: ReadonlyMap<string, readonly TeamRosterMember[]>,
    private readonly readable: boolean = true,
  ) {}

  static unavailable(): InMemoryTeamRosterGateway {
    return new InMemoryTeamRosterGateway(new Map(), false);
  }

  rosterOf = (teamId: string): Promise<TeamRoster> => {
    if (!this.readable) {
      return Promise.resolve({ reading: "unavailable", teamId, dataOrigin: this.dataOrigin });
    }
    return Promise.resolve({
      reading: "available",
      teamId,
      members: this.order.sorted(this.membersByTeam.get(teamId) ?? []),
      dataOrigin: this.dataOrigin,
    });
  };
}
