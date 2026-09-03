import type { Architect, CareerLevelTransition } from "../domain";
import type { ApiClient } from "../api-client";

export interface ArchitectsGateway {
  /**
   * ONDA 37 — Usuários desativa a pessoa (conta + profissional num ato só,
   * backend ADR-0084) e a desativação carrega `expectedVersion`. A tela de
   * contas não monta o `/state`, então lê o profissional pelo id que a
   * própria conta traz.
   */
  professional(id: string): Promise<Architect>;
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

  professional = (id: string): Promise<Architect> =>
    this.client.request<Architect>(`/architects/${id}`);

  createArchitect = (architect: Omit<Architect, "id" | "version">): Promise<Architect> =>
    this.client.post<Architect>("/architects", architect);

  updateArchitect = (
    id: string,
    patch_: Partial<Omit<Architect, "id" | "role" | "version">>,
  ): Promise<Architect> => this.client.patch<Architect>(`/architects/${id}`, patch_);

  transitionCareerLevel = (
    id: string,
    toRole: Architect["role"],
    reason: string,
    expectedVersion: number,
  ): Promise<Architect> =>
    this.client.post<Architect>(`/architects/${id}/career-level-transition`, {
      toRole,
      reason,
      expectedVersion,
    });

  deactivate = (id: string, reason: string, expectedVersion: number): Promise<Architect> =>
    this.client.post<Architect>(`/architects/${id}/deactivate`, { reason, expectedVersion });

  careerLevelTransitions = (id: string): Promise<CareerLevelTransition[]> =>
    this.client.request<CareerLevelTransition[]>(`/architects/${id}/career-level-transitions`);
}
