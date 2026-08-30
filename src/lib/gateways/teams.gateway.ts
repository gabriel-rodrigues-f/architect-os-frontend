import { teamsResponseSchema } from "../api-schemas";
import type { ApiClient } from "../api-client";

export interface TeamSummary {
  id: string;
  name: string;
  active: boolean;
}

export interface TeamsGateway {
  teams(): Promise<TeamSummary[]>;
}

export class HttpTeamsGateway implements TeamsGateway {
  constructor(private readonly client: ApiClient) {}

  teams = (): Promise<TeamSummary[]> =>
    this.client.request<TeamSummary[]>("/teams").then((data) => teamsResponseSchema.parse(data));
}
