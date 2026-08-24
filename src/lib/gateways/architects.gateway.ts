import type { Architect, CareerLevelTransition } from "../domain";
import type { ApiClient } from "../api-client";

/**
 * OO-FE-02 — gateway do contexto "arquitetos" (pessoas). Ver
 * `cycles.gateway.ts` para a explicação do padrão interface + `Http*` e do
 * porquê dos métodos serem arrow functions de campo (spread-safe na
 * fachada `api.ts`).
 */
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
  careerLevelTransitions(id: string): Promise<CareerLevelTransition[]>;
}

export class HttpArchitectsGateway implements ArchitectsGateway {
  constructor(private readonly client: ApiClient) {}

  /** B-32 — id é sempre gerado no servidor; nunca aceito do cliente (evita colisão de slug). */
  createArchitect = (architect: Omit<Architect, "id" | "version">): Promise<Architect> =>
    this.client.post<Architect>("/api/architects", architect);

  /** `role`/`version` ficam de fora — ENT-CAR-017: nível de carreira só muda por `transitionCareerLevel`. */
  updateArchitect = (
    id: string,
    patch_: Partial<Omit<Architect, "id" | "role" | "version">>,
  ): Promise<Architect> => this.client.patch<Architect>(`/api/architects/${id}`, patch_);

  /**
   * ENT-CAR-017 — comando dedicado, não um PATCH de `role`: exige motivo e
   * concorrência otimista, mesmo padrão de `reopenPlan`.
   */
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

  careerLevelTransitions = (id: string): Promise<CareerLevelTransition[]> =>
    this.client.request<CareerLevelTransition[]>(`/api/architects/${id}/career-level-transitions`);
}
