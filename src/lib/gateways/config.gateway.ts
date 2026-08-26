import {
  scoringBandsPutResponseSchema,
  scoringBandsResponseSchema,
  textTemplatesResponseSchema,
} from "../api-schemas";
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

/**
 * CFG-03 — `templates()` devolve os templates de texto de domínio AGRUPADOS
 * como o servidor serializa (`GET /api/config/templates`, `key → locale →
 * template`): `Record` de strings livres de propósito — uma key/locale pode
 * não vir (ambiente recém-migrado), e é o consumidor
 * (`withDefaultTextTemplates`, via `useTextTemplates` em `store.tsx`) quem
 * completa com o default byte-idêntico ao seed.
 */
export type TextTemplatesResponse = Record<string, Record<string, string>>;

export interface ConfigGateway {
  bands(): Promise<ScoringBandsResponse>;
  templates(): Promise<TextTemplatesResponse>;
  /**
   * CFG-02 (admin UI) — `PUT /api/config/bands/:scale`: substitui a régua
   * INTEIRA de uma escala. Admin-only e validação de contiguidade no
   * backend (`ScoringBandScale.create` → 400 `INVALID_SCORING_BANDS`, que
   * a aba "Réguas e limiares" mostra no formulário).
   */
  updateScoringBands(scale: ScoringScale, bands: ScoringBand[]): Promise<ScoringBand[]>;
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

  // CFG-03 — mesma disciplina de `bands`: validado em runtime, não só cast.
  // O template vira DADO persistido (objetivo de item de PDI) — uma resposta
  // com forma errada tem que falhar barulhento no `useQuery`, não gravar
  // lixo silencioso no plano de alguém.
  templates = (): Promise<TextTemplatesResponse> =>
    this.client
      .request<TextTemplatesResponse>("/api/config/templates")
      .then((data) => textTemplatesResponseSchema.parse(data));

  // CFG-02 (admin UI) — a resposta do PUT também é validada (a régua
  // recém-gravada volta direto para o cache via invalidação; forma errada
  // tem que falhar barulhento aqui, não corromper o badge).
  updateScoringBands = (scale: ScoringScale, bands: ScoringBand[]): Promise<ScoringBand[]> =>
    this.client
      .put<ScoringBand[]>(`/api/config/bands/${scale}`, { bands })
      .then((data) => scoringBandsPutResponseSchema.parse(data));
}
