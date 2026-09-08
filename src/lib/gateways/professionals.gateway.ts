import type { Professional, CareerLevelTransition, RoleName } from "../domain";
import type { ApiClient } from "../api-client";

export interface ProfessionalsGateway {
  /**
   * ONDA 37 — Usuários desativa a pessoa (conta + profissional num ato só,
   * backend ADR-0084) e a desativação carrega `expectedVersion`. A tela de
   * contas não monta o `/state`, então lê o profissional pelo id que a
   * própria conta traz.
   */
  professional(id: string): Promise<Professional>;
  updateProfessional(
    id: string,
    patch_: Partial<Omit<Professional, "id" | "role" | "version">>,
  ): Promise<Professional>;
  transitionCareerLevel(
    id: string,
    toRole: RoleName,
    reason: string,
    expectedVersion: number,
  ): Promise<Professional>;

  deactivate(id: string, reason: string, expectedVersion: number): Promise<Professional>;
  /** A volta de `deactivate`: profissional no quadro E conta com acesso, num ato só. */
  reactivate(id: string, expectedVersion: number): Promise<Professional>;
  careerLevelTransitions(id: string): Promise<CareerLevelTransition[]>;
}

export class HttpProfessionalsGateway implements ProfessionalsGateway {
  constructor(private readonly client: ApiClient) {}

  professional = (id: string): Promise<Professional> =>
    this.client.request<Professional>(`/professionals/${id}`);

  updateProfessional = (
    id: string,
    patch_: Partial<Omit<Professional, "id" | "role" | "version">>,
  ): Promise<Professional> => this.client.patch<Professional>(`/professionals/${id}`, patch_);

  transitionCareerLevel = (
    id: string,
    toRole: RoleName,
    reason: string,
    expectedVersion: number,
  ): Promise<Professional> =>
    this.client.post<Professional>(`/professionals/${id}/career-level-transition`, {
      toRole,
      reason,
      expectedVersion,
    });

  deactivate = (id: string, reason: string, expectedVersion: number): Promise<Professional> =>
    this.client.post<Professional>(`/professionals/${id}/deactivate`, { reason, expectedVersion });

  reactivate = (id: string, expectedVersion: number): Promise<Professional> =>
    this.client.post<Professional>(`/professionals/${id}/reactivate`, { expectedVersion });

  careerLevelTransitions = (id: string): Promise<CareerLevelTransition[]> =>
    this.client.request<CareerLevelTransition[]>(`/professionals/${id}/career-level-transitions`);
}
