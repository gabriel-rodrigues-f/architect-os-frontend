import type { DevelopmentCycle } from "../domain";
import type { ApiClient } from "../api-client";

/**
 * OO-FE-02 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, Anexo F.6) — gateway do
 * contexto "ciclos", uma das fatias em que o objeto `api` de ~50 métodos
 * foi decomposto. Interface + `Http*` implementação espelha o par
 * Repository/PostgresXRepository do backend (F.3): hoje só existe esta
 * implementação HTTP, mas o formato deixa pronto o ponto de extensão para
 * um fake de teste sem rede, se precisar no futuro. Migração de FORMA, não
 * de comportamento (F.3): mesma URL, método e corpo de cada request.
 *
 * Métodos são arrow functions de campo de instância (não métodos de
 * protótipo) de propósito: `api.ts` (a fachada) monta `export const api =
 * { ...cyclesGateway, ... }` — um spread só copia propriedade própria
 * enumerável, não método de protótipo — e a arrow function de campo já
 * nasce com `this` preso à instância certa, então o método sobrevive
 * destacado do objeto gateway original sem precisar de `.bind()`.
 */
export interface CyclesGateway {
  setActiveCycle(cycleId: string): Promise<{ cycleId: string }>;
  createCycle(cycle: DevelopmentCycle): Promise<DevelopmentCycle>;
  updateCycle(id: string, patch_: Partial<Omit<DevelopmentCycle, "id">>): Promise<DevelopmentCycle>;
  deleteCycle(id: string): Promise<void>;
}

export class HttpCyclesGateway implements CyclesGateway {
  constructor(private readonly client: ApiClient) {}

  setActiveCycle = (cycleId: string): Promise<{ cycleId: string }> =>
    this.client.put<{ cycleId: string }>("/api/settings/active-cycle", { cycleId });

  createCycle = (cycle: DevelopmentCycle): Promise<DevelopmentCycle> =>
    this.client.post<DevelopmentCycle>("/api/cycles", cycle);

  updateCycle = (
    id: string,
    patch_: Partial<Omit<DevelopmentCycle, "id">>,
  ): Promise<DevelopmentCycle> => this.client.patch<DevelopmentCycle>(`/api/cycles/${id}`, patch_);

  deleteCycle = (id: string): Promise<void> => this.client.del<void>(`/api/cycles/${id}`);
}
