import type { Architect, CareerLevelTransition } from "../domain";
import type { ApiClient } from "../api-client";

export interface ArchitectsGateway {
  createArchitect(architect: Omit<Architect, "id" | "version">): Promise<Architect>;
  updateArchitect(
    id: string,
    patch_: Partial<Omit<Architect, "id" | "role" | "version">>,
  ): Promise<Architect>;
  transitionCareerLevel(
    id: string,
    toRole: Architect["role"],
    reason: string,
    expectedVersion: number,
  ): Promise<Architect>;

  deactivate(id: string, reason: string, expectedVersion: number): Promise<Architect>;
  careerLevelTransitions(id: string): Promise<CareerLevelTransition[]>;
}

export class HttpArchitectsGateway implements ArchitectsGateway {
  constructor(private readonly client: ApiClient) {}

  createArchitect = (architect: Omit<Architect, "id" | "version">): Promise<Architect> =>
    this.client.post<Architect>("/api/architects", architect);

  updateArchitect = (
    id: string,
    patch_: Partial<Omit<Architect, "id" | "role" | "version">>,
  ): Promise<Architect> => this.client.patch<Architect>(`/api/architects/${id}`, patch_);

  transitionCareerLevel = (
    id: string,
    toRole: Architect["role"],
    reason: string,
    expectedVersion: number,
  ): Promise<Architect> =>
    this.client.post<Architect>(`/api/architects/${id}/career-level-transition`, {
      toRole,
      reason,
      expectedVersion,
    });

  deactivate = (id: string, reason: string, expectedVersion: number): Promise<Architect> =>
    this.client.post<Architect>(`/api/architects/${id}/deactivate`, { reason, expectedVersion });

  careerLevelTransitions = (id: string): Promise<CareerLevelTransition[]> =>
    this.client.request<CareerLevelTransition[]>(`/api/architects/${id}/career-level-transitions`);
}
