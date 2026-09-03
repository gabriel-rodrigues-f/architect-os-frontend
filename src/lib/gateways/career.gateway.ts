import type { CareerLevel, Level, TeamLevelRule } from "../domain";
import {
  architectAdherenceResponseSchema,
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
  minimumQualifiedCapabilities: number;
  capabilityIds: string[];
  competencies: TeamRuleCompetencyRequirement[];
}

export interface ArchitectAdherence {
  architectId: string;
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
  architectAdherence(
    architectId: string,
    careerLevelId: string,
    teamId?: string,
  ): Promise<ArchitectAdherence>;
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

  architectAdherence = (
    architectId: string,
    careerLevelId: string,
    teamId?: string,
  ): Promise<ArchitectAdherence> => {
    const query = new URLSearchParams({ careerLevelId });
    if (teamId !== undefined) query.set("teamId", teamId);
    return this.client
      .request<ArchitectAdherence>(`/architects/${architectId}/adherence?${query.toString()}`)
      .then((data) => architectAdherenceResponseSchema.parse(data) as ArchitectAdherence);
  };
}
