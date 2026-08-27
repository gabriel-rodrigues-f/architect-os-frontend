import type {
  ArchitectEvolutionResult,
  EvolutionFilters,
  SelectionScope,
  TeamEvolutionResult,
} from "../domain";
import type { ApiClient } from "../api-client";

export interface EvolutionGateway {
  architect(architectId: string, filters: EvolutionFilters): Promise<ArchitectEvolutionResult>;
  team(architects: SelectionScope, filters: EvolutionFilters): Promise<TeamEvolutionResult>;
}

export class HttpEvolutionGateway implements EvolutionGateway {
  constructor(private readonly client: ApiClient) {}

  architect = (architectId: string, filters: EvolutionFilters): Promise<ArchitectEvolutionResult> =>
    this.client.post<ArchitectEvolutionResult>("/evolution/architect", {
      architectId,
      ...filters,
    });

  team = (architects: SelectionScope, filters: EvolutionFilters): Promise<TeamEvolutionResult> =>
    this.client.post<TeamEvolutionResult>("/evolution/team", { architects, ...filters });
}
