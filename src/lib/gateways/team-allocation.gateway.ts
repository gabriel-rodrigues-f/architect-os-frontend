import { ApiError } from "../api-errors";
import type { ApiClient } from "../api-client";
import type { Professional } from "../domain";
import type { TeamSummary } from "./teams.gateway";

export interface TeamAllocationGateway {
  allocateProfessionalToTeam(
    professionalId: string,
    teamId: string,
    reason: string,
  ): Promise<Professional>;
  releaseProfessionalFromTeam(professionalId: string): Promise<Professional>;
}

export interface TeamAllocationMade {
  readonly professionalId: string;
  readonly teamId: string;
  readonly reason: string;
}

export class HttpTeamAllocationGateway implements TeamAllocationGateway {
  constructor(private readonly client: ApiClient) {}

  allocateProfessionalToTeam = (
    professionalId: string,
    teamId: string,
    reason: string,
  ): Promise<Professional> =>
    this.client.post<Professional>(`/professionals/${professionalId}/team-allocation`, {
      teamId,
      reason,
    });

  releaseProfessionalFromTeam = (professionalId: string): Promise<Professional> =>
    this.client.del<Professional>(`/professionals/${professionalId}/team-allocation`);
}

export class TeamAllocationRefusal {
  static reasonRequired(): ApiError {
    return new ApiError("Informe o motivo da mudança de time.", 400, undefined, "VALIDATION_ERROR");
  }

  static professionalNotFound(professionalId: string): ApiError {
    return new ApiError(
      `Profissional ${professionalId} não encontrado.`,
      404,
      undefined,
      "PROFESSIONAL_NOT_FOUND",
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

  static alreadyInTeam(professional: Professional): ApiError {
    return new ApiError(
      `${professional.name} já está neste time.`,
      409,
      undefined,
      "PROFESSIONAL_ALREADY_IN_TEAM",
    );
  }

  static withoutTeam(professional: Professional): ApiError {
    return new ApiError(
      `${professional.name} não está em nenhum time.`,
      409,
      undefined,
      "PROFESSIONAL_WITHOUT_TEAM",
    );
  }
}

export class InMemoryTeamAllocationGateway implements TeamAllocationGateway {
  private readonly professionalsById: Map<string, Professional>;
  readonly allocationsMade: TeamAllocationMade[] = [];
  readonly releasesMade: string[] = [];

  constructor(
    professionals: readonly Professional[],
    private readonly teams: readonly TeamSummary[],
  ) {
    this.professionalsById = new Map(
      professionals.map((professional) => [professional.id, { ...professional }]),
    );
  }

  allocateProfessionalToTeam = (
    professionalId: string,
    teamId: string,
    reason: string,
  ): Promise<Professional> => {
    if (reason.trim() === "") return Promise.reject(TeamAllocationRefusal.reasonRequired());
    const professional = this.professionalsById.get(professionalId);
    if (!professional)
      return Promise.reject(TeamAllocationRefusal.professionalNotFound(professionalId));
    const team = this.teams.find((candidate) => candidate.id === teamId);
    if (!team) return Promise.reject(TeamAllocationRefusal.teamNotFound(teamId));
    if (!team.active) return Promise.reject(TeamAllocationRefusal.teamDeactivated());
    if (professional.teamId === teamId) {
      return Promise.reject(TeamAllocationRefusal.alreadyInTeam(professional));
    }
    const allocated = { ...professional, teamId, version: professional.version + 1 };
    this.professionalsById.set(professionalId, allocated);
    this.allocationsMade.push({ professionalId, teamId, reason });
    return Promise.resolve(allocated);
  };

  releaseProfessionalFromTeam = (professionalId: string): Promise<Professional> => {
    const professional = this.professionalsById.get(professionalId);
    if (!professional)
      return Promise.reject(TeamAllocationRefusal.professionalNotFound(professionalId));
    if (professional.teamId == null)
      return Promise.reject(TeamAllocationRefusal.withoutTeam(professional));
    const released = { ...professional, teamId: null, version: professional.version + 1 };
    this.professionalsById.set(professionalId, released);
    this.releasesMade.push(professionalId);
    return Promise.resolve(released);
  };
}
