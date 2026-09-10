import type { CareerLevel, Level, TeamLevelRule } from "../domain";
import {
  professionalAdherenceResponseSchema,
  careerLevelsResponseSchema,
  teamRuleResponseSchema,
} from "../api-schemas";
import type { ApiClient } from "../api-client";

interface TeamRuleCompetencyRequirement {
  competencyId: string;
  requiredLevel: Level;
}

export interface TeamRuleView extends TeamLevelRule {
  capabilityIds: string[];
  competencies: TeamRuleCompetencyRequirement[];
}

export interface TeamRuleDefinition {
  capabilityIds: string[];
  competencies: TeamRuleCompetencyRequirement[];
}

export interface ProfessionalAdherence {
  professionalId: string;
  teamId: string | null;
  careerLevelId: string;
  adherence: {
    percentage: number;
    missingCompetencies: {
      competencyId: string;
      currentLevel: number;
      requiredLevel: number;
    }[];
  };
  semRegua?: true | undefined;
}

export interface CareerGateway {
  careerLevels(): Promise<CareerLevel[]>;
  teamRule(teamId: string, careerLevelId: string): Promise<TeamRuleView>;
  defineTeamRule(
    teamId: string,
    careerLevelId: string,
    definition: TeamRuleDefinition,
  ): Promise<TeamRuleView>;
  professionalAdherence(
    professionalId: string,
    careerLevelId: string,
    teamId?: string,
  ): Promise<ProfessionalAdherence>;
}

export class HttpCareerGateway implements CareerGateway {
  constructor(private readonly client: ApiClient) {}

  careerLevels = (): Promise<CareerLevel[]> =>
    this.client
      .request<CareerLevel[]>("/career-levels")
      .then((data) => careerLevelsResponseSchema.parse(data));

  teamRule = (teamId: string, careerLevelId: string): Promise<TeamRuleView> =>
    this.client
      .request<TeamRuleView>(`/teams/${teamId}/rules/${careerLevelId}`)
      .then((data) => teamRuleResponseSchema.parse(data) as TeamRuleView);

  defineTeamRule = (
    teamId: string,
    careerLevelId: string,
    definition: TeamRuleDefinition,
  ): Promise<TeamRuleView> =>
    this.client.put<TeamRuleView>(`/teams/${teamId}/rules/${careerLevelId}`, definition);

  professionalAdherence = (
    professionalId: string,
    careerLevelId: string,
    teamId?: string,
  ): Promise<ProfessionalAdherence> => {
    const query = new URLSearchParams({ careerLevelId });
    if (teamId !== undefined) query.set("teamId", teamId);
    return this.client
      .request<ProfessionalAdherence>(
        `/professionals/${professionalId}/adherence?${query.toString()}`,
      )
      .then((data) => professionalAdherenceResponseSchema.parse(data) as ProfessionalAdherence);
  };
}
