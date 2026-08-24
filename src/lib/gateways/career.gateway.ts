import type { CareerLevel, CareerLevelPolicy } from "../domain";
import { careerLevelsResponseSchema } from "../api-schemas";
import type { ApiClient } from "../api-client";

/**
 * OO-FE-02 — gateway do contexto "carreira". Ver `cycles.gateway.ts` para a
 * explicação do padrão interface + `Http*` e do porquê dos métodos serem
 * arrow functions de campo (spread-safe na fachada `api.ts`).
 */
export interface CareerGateway {
  careerLevels(): Promise<CareerLevel[]>;
  updateCareerLevelPolicy(
    careerLevelId: string,
    minimumQualifiedCapabilities: number,
  ): Promise<CareerLevelPolicy>;
}

export class HttpCareerGateway implements CareerGateway {
  constructor(private readonly client: ApiClient) {}

  // R2-TEC-19 — validado em runtime (mesmo padrão de getState/appStateSchema),
  // não só um cast de tipo: `careerLevels` perdeu essa checagem quando saiu
  // de `/api/state` (B-24, ADR-0011) e nunca ganhou uma equivalente no
  // endpoint dedicado.
  careerLevels = (): Promise<CareerLevel[]> =>
    this.client
      .request<CareerLevel[]>("/api/career-levels")
      .then((data) => careerLevelsResponseSchema.parse(data));

  /**
   * ORIENTACAO-NONA-RODADA, Seção 16 (ENT-09-009) — Política de Progressão:
   * mínimo global >=3 já é validado no backend (`policyPatchSchema`,
   * `routes/api/career.ts`); admin-only lá também.
   */
  updateCareerLevelPolicy = (
    careerLevelId: string,
    minimumQualifiedCapabilities: number,
  ): Promise<CareerLevelPolicy> =>
    this.client.patch<CareerLevelPolicy>(`/api/career-levels/${careerLevelId}/policy`, {
      minimumQualifiedCapabilities,
    });
}
