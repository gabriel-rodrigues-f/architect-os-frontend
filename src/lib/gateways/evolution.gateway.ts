import type {
  ArchitectEvolutionResult,
  EvolutionFilters,
  SelectionScope,
  TeamEvolutionResult,
} from "../domain";
import type { ApiClient } from "../api-client";

/**
 * OO-FE-02 — gateway do contexto "evolução". Já era um objeto separado
 * (`evolutionApi`) antes desta migração; ganha o mesmo formato interface +
 * `Http*` dos demais gateways por consistência (métodos como arrow
 * functions de campo — ver `cycles.gateway.ts`).
 *
 * ORIENTACAO-DECIMA-RODADA, Seção 47-49/55 — mesmo serviço de analytics do
 * backend, aqui só a chamada de rede; nenhum cálculo replicado no cliente.
 */
export interface EvolutionGateway {
  architect(architectId: string, filters: EvolutionFilters): Promise<ArchitectEvolutionResult>;
  team(architects: SelectionScope, filters: EvolutionFilters): Promise<TeamEvolutionResult>;
}

export class HttpEvolutionGateway implements EvolutionGateway {
  constructor(private readonly client: ApiClient) {}

  architect = (architectId: string, filters: EvolutionFilters): Promise<ArchitectEvolutionResult> =>
    this.client.post<ArchitectEvolutionResult>("/api/evolution/architect", {
      architectId,
      ...filters,
    });

  team = (architects: SelectionScope, filters: EvolutionFilters): Promise<TeamEvolutionResult> =>
    this.client.post<TeamEvolutionResult>("/api/evolution/team", { architects, ...filters });
}
