import type {
  ProfessionalEvolutionResult,
  EvolutionFilters,
  SelectionScope,
  TeamEvolutionResult,
} from "../domain";
import type { ApiClient } from "../api-client";

export interface EvolutionGateway {
  professional(
    professionalId: string,
    filters: EvolutionFilters,
  ): Promise<ProfessionalEvolutionResult>;
  team(professionals: SelectionScope, filters: EvolutionFilters): Promise<TeamEvolutionResult>;
}

export class HttpEvolutionGateway implements EvolutionGateway {
  constructor(private readonly client: ApiClient) {}

  professional = (
    professionalId: string,
    filters: EvolutionFilters,
  ): Promise<ProfessionalEvolutionResult> =>
    this.client.post<ProfessionalEvolutionResult>("/evolution/professional", {
      professionalId,
      ...filters,
    });

  team = (professionals: SelectionScope, filters: EvolutionFilters): Promise<TeamEvolutionResult> =>
    this.client.post<TeamEvolutionResult>("/evolution/team", { professionals, ...filters });
}
