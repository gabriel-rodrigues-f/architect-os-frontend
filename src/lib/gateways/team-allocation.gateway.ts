import { ApiError } from "../api-errors";
import type { ApiClient } from "../api-client";
import type { Architect } from "../domain";
import type { TeamSummary } from "./teams.gateway";

export interface TeamAllocationGateway {
  allocateArchitectToTeam(architectId: string, teamId: string): Promise<Architect>;
  releaseArchitectFromTeam(architectId: string): Promise<Architect>;
}

export interface TeamAllocationMade {
  readonly architectId: string;
  readonly teamId: string;
}

export class HttpTeamAllocationGateway implements TeamAllocationGateway {
  constructor(private readonly client: ApiClient) {}

  allocateArchitectToTeam = (architectId: string, teamId: string): Promise<Architect> =>
    this.client.post<Architect>(`/architects/${architectId}/team-allocation`, { teamId });

  releaseArchitectFromTeam = (architectId: string): Promise<Architect> =>
    this.client.del<Architect>(`/architects/${architectId}/team-allocation`);
}

export class TeamAllocationRefusal {
  static architectNotFound(architectId: string): ApiError {
    return new ApiError(
      `Arquiteto ${architectId} não encontrado.`,
      404,
      undefined,
      "ARCHITECT_NOT_FOUND",
    );
  }

  static teamNotFound(teamId: string): ApiError {
    return new ApiError(`Time ${teamId} não encontrado.`, 404, undefined, "TEAM_NOT_FOUND");
  }

  static teamDeactivated(): ApiError {
    return new ApiError(
      "O time está desativado e não recebe pessoas.",
      409,
      undefined,
      "TEAM_DEACTIVATED",
    );
  }

  static alreadyInTeam(architect: Architect): ApiError {
    return new ApiError(
      `${architect.name} já está neste time.`,
      409,
      undefined,
      "ARCHITECT_ALREADY_IN_TEAM",
    );
  }

  static withoutTeam(architect: Architect): ApiError {
    return new ApiError(
      `${architect.name} não está em nenhum time.`,
      409,
      undefined,
      "ARCHITECT_WITHOUT_TEAM",
    );
  }
}

export class InMemoryTeamAllocationGateway implements TeamAllocationGateway {
  private readonly architectsById: Map<string, Architect>;
  readonly allocationsMade: TeamAllocationMade[] = [];
  readonly releasesMade: string[] = [];

  constructor(
    architects: readonly Architect[],
    private readonly teams: readonly TeamSummary[],
  ) {
    this.architectsById = new Map(architects.map((architect) => [architect.id, { ...architect }]));
  }

  allocateArchitectToTeam = (architectId: string, teamId: string): Promise<Architect> => {
    const architect = this.architectsById.get(architectId);
    if (!architect) return Promise.reject(TeamAllocationRefusal.architectNotFound(architectId));
    const team = this.teams.find((candidate) => candidate.id === teamId);
    if (!team) return Promise.reject(TeamAllocationRefusal.teamNotFound(teamId));
    if (!team.active) return Promise.reject(TeamAllocationRefusal.teamDeactivated());
    if (architect.teamId === teamId) {
      return Promise.reject(TeamAllocationRefusal.alreadyInTeam(architect));
    }
    const allocated = { ...architect, teamId, version: architect.version + 1 };
    this.architectsById.set(architectId, allocated);
    this.allocationsMade.push({ architectId, teamId });
    return Promise.resolve(allocated);
  };

  releaseArchitectFromTeam = (architectId: string): Promise<Architect> => {
    const architect = this.architectsById.get(architectId);
    if (!architect) return Promise.reject(TeamAllocationRefusal.architectNotFound(architectId));
    if (architect.teamId == null)
      return Promise.reject(TeamAllocationRefusal.withoutTeam(architect));
    const released = { ...architect, teamId: null, version: architect.version + 1 };
    this.architectsById.set(architectId, released);
    this.releasesMade.push(architectId);
    return Promise.resolve(released);
  };
}
