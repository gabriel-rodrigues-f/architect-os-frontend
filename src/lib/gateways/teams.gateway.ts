import {
  teamCareerLadderResponseSchema,
  teamMembershipBondSchema,
  teamSummarySchema,
  teamsResponseSchema,
} from "../api-schemas";
import type { ApiClient } from "../api-client";
import type { CareerLevel } from "../domain";
import type { TeamMemberRole } from "./auth.gateway";
import type { DataOrigin } from "./data-origin";

export interface TeamSummary {
  id: string;
  name: string;
  active: boolean;
}

/**
 * A ESCADA DE CARREIRA DO TIME (dono, 2026-09-08): quais níveis o time usa e
 * em que ordem se sobe por eles. `declared` é falso para o time que nunca
 * escolheu — nesse caso `levels` é o catálogo inteiro da organização, que é o
 * que todas as telas mostravam antes desta fatia.
 */
export interface TeamCareerLadder {
  teamId: string;
  declared: boolean;
  levels: CareerLevel[];
}

export interface TeamMembershipBond {
  teamId: string;
  userId: string;
  role: TeamMemberRole;
}

export interface TeamsGateway {
  readonly dataOrigin: DataOrigin;
  teams(): Promise<TeamSummary[]>;
  careerLadderOf(teamId: string): Promise<TeamCareerLadder>;
  defineCareerLadder(teamId: string, careerLevelIds: readonly string[]): Promise<TeamCareerLadder>;
  registerTeam(name: string, careerLevelIds: readonly string[]): Promise<TeamSummary>;
  renameTeam(teamId: string, name: string): Promise<TeamSummary>;
  deactivateTeam(teamId: string): Promise<TeamSummary>;
  assignTeamMembership(
    teamId: string,
    userId: string,
    role: TeamMemberRole,
  ): Promise<TeamMembershipBond>;
  reassignTeamMembershipRole(
    teamId: string,
    userId: string,
    currentRole: TeamMemberRole,
    role: TeamMemberRole,
  ): Promise<TeamMembershipBond>;
  releaseTeamMembership(teamId: string, userId: string, role: TeamMemberRole): Promise<void>;
}

export class HttpTeamsGateway implements TeamsGateway {
  readonly dataOrigin: DataOrigin = "organization";

  constructor(private readonly client: ApiClient) {}

  teams = (): Promise<TeamSummary[]> =>
    this.client.request<TeamSummary[]>("/teams").then((data) => teamsResponseSchema.parse(data));

  careerLadderOf = (teamId: string): Promise<TeamCareerLadder> =>
    this.client
      .request<unknown>(`/teams/${teamId}/career-levels`)
      .then((data) => teamCareerLadderResponseSchema.parse(data));

  defineCareerLadder = (
    teamId: string,
    careerLevelIds: readonly string[],
  ): Promise<TeamCareerLadder> =>
    this.client
      .put<unknown>(`/teams/${teamId}/career-levels`, { careerLevelIds: [...careerLevelIds] })
      .then((data) => teamCareerLadderResponseSchema.parse(data));

  registerTeam = (name: string, careerLevelIds: readonly string[]): Promise<TeamSummary> =>
    this.client
      .post<unknown>("/teams", { name, careerLevelIds: [...careerLevelIds] })
      .then((data) => teamSummarySchema.parse(data));

  renameTeam = (teamId: string, name: string): Promise<TeamSummary> =>
    this.client
      .patch<unknown>(`/teams/${teamId}`, { name })
      .then((data) => teamSummarySchema.parse(data));

  deactivateTeam = (teamId: string): Promise<TeamSummary> =>
    this.client
      .post<unknown>(`/teams/${teamId}/deactivate`, {})
      .then((data) => teamSummarySchema.parse(data));

  assignTeamMembership = (
    teamId: string,
    userId: string,
    role: TeamMemberRole,
  ): Promise<TeamMembershipBond> =>
    this.client
      .post<unknown>(`/teams/${teamId}/memberships`, { userId, role })
      .then((data) => teamMembershipBondSchema.parse(data));

  reassignTeamMembershipRole = (
    teamId: string,
    userId: string,
    currentRole: TeamMemberRole,
    role: TeamMemberRole,
  ): Promise<TeamMembershipBond> =>
    this.client
      .patch<unknown>(`/teams/${teamId}/memberships/${userId}/${currentRole}`, { role })
      .then((data) => teamMembershipBondSchema.parse(data));

  releaseTeamMembership = (teamId: string, userId: string, role: TeamMemberRole): Promise<void> =>
    this.client.del<void>(`/teams/${teamId}/memberships/${userId}/${role}`);
}
