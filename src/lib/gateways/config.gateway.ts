import { scoringBandsResponseSchema } from "../api-schemas";
import type { ApiClient } from "../api-client";
import type { ScoringBand, ScoringScale } from "../scoring-bands";

/**
 * CFG-02 — gateway do contexto "configuração". Ver `cycles.gateway.ts` para
 * a explicação do padrão interface + `Http*` e do porquê dos métodos serem
 * arrow functions de campo (spread-safe na fachada `api.ts`).
 *
 * `bands()` devolve as escalas AGRUPADAS como o servidor serializa
 * (`GET /api/config/bands`, `ConfigController`): `Partial` de propósito —
 * uma escala pode não vir (tabela vazia num ambiente recém-migrado), e é o
 * consumidor (`withDefaultScoringBands`, via `useScoringBands` em
 * `store.tsx`) quem completa com o default byte-idêntico ao seed.
 */
export type ScoringBandsResponse = { [K in ScoringScale]?: ScoringBand[] | undefined };

export interface ConfigGateway {
  bands(): Promise<ScoringBandsResponse>;
}

export class HttpConfigGateway implements ConfigGateway {
  constructor(private readonly client: ApiClient) {}

  // R2-TEC-19 — validado em runtime (mesmo padrão de `careerLevels`), não só
  // um cast de tipo: a régua entra em badge, painel e relatório — um campo
  // renomeado no servidor tem que falhar barulhento no `useQuery`, não
  // propagar `undefined` silencioso pela UI.
  bands = (): Promise<ScoringBandsResponse> =>
    this.client
      .request<ScoringBandsResponse>("/api/config/bands")
      .then((data) => scoringBandsResponseSchema.parse(data));
}
