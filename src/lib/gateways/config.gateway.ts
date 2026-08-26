import {
  appSettingPutResponseSchema,
  appSettingsResponseSchema,
  curationPolicySchema,
  scoringBandsPutResponseSchema,
  scoringBandsResponseSchema,
  textTemplateRecordSchema,
  textTemplatesResponseSchema,
  vocabulariesResponseSchema,
  vocabularyItemSchema,
} from "../api-schemas";
import type { ApiClient } from "../api-client";
import type { CurationPolicy } from "../curation-policy";
import type { AppSettingsResponse, AppSettingValue } from "../operational-settings";
import type { ScoringBand, ScoringScale } from "../scoring-bands";
import type { Vocabularies, VocabularyItem, VocabularyName } from "../vocabularies";

/** CFG-06 (admin UI) — corpo do POST de item novo: labelKey obrigatório; sort/active têm default no servidor. */
export interface VocabularyItemInput {
  labelKey: string;
  sortOrder?: number | undefined;
  active?: boolean | undefined;
}

/** CFG-06 (admin UI) — corpo do PATCH: só campos editáveis (identidade vocabulary/code é imutável). */
export interface VocabularyItemPatch {
  labelKey?: string | undefined;
  sortOrder?: number | undefined;
  active?: boolean | undefined;
}

/** CFG-03 (admin UI) — a resposta do PUT de template: o registro validado (mesma forma da tabela). */
export interface TextTemplateRecord {
  key: string;
  locale: string;
  template: string;
}

/** CFG-05 (admin UI) — a resposta do PUT de setting: key + valor tipado gravado. */
export interface AppSettingUpdate {
  key: string;
  value: AppSettingValue;
}

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
  /**
   * CFG-03 (admin UI) — `PUT /api/config/templates/:key/:locale`: edita o
   * TEXTO de um template existente. Admin-only e validação no backend
   * (`TextTemplate.create` → 400 `INVALID_TEXT_TEMPLATE` para vazio ou
   * variável fora da key; 404 para key desconhecida) — a aba "Textos"
   * mostra o erro no formulário.
   */
  updateTextTemplate(key: string, locale: string, template: string): Promise<TextTemplateRecord>;
  /**
   * CFG-04 — `GET /api/config/curation-policy`: os três limites de
   * composição do catálogo (`CatalogCurationLimits` do backend). Sempre vem
   * completo (a tabela tem a linha do seed); quem cobre a consulta ainda em
   * voo/falha com o default é `withDefaultCurationPolicy`
   * (`curation-policy.ts`, via `useCurationPolicy` em `store.tsx`).
   */
  curationPolicy(): Promise<CurationPolicy>;
  /**
   * CFG-04 (admin UI) — `PUT /api/config/curation-policy`: substitui a
   * política INTEIRA. Admin-only e validação de negócio no backend
   * (`CatalogCurationPolicy.create` → 400
   * `INVALID_CATALOG_CURATION_POLICY` para soma que não fecha, máximo não
   * positivo ou não-inteiro — a aba "Catálogo" mostra o erro no formulário).
   */
  updateCurationPolicy(policy: CurationPolicy): Promise<CurationPolicy>;
  /**
   * CFG-05 — `GET /api/config/settings`: as políticas operacionais
   * escalares (`app_settings`) como o servidor serializa
   * (`{ settings: [...] }` de `AppSettingRecord`). Uma key pode não vir
   * (ambiente recém-migrado); é o consumidor
   * (`withDefaultOperationalSettings`, via `useOperationalSettings` em
   * `store.tsx`) quem completa campo a campo com o default byte-idêntico
   * ao seed.
   */
  settings(): Promise<AppSettingsResponse>;
  /**
   * CFG-05 (admin UI) — `PUT /api/config/settings/:key`: edita o VALOR de
   * uma setting existente do modelo. Admin-only e validação no backend
   * (`OperationalSettings.apply` → 400 `INVALID_APP_SETTING` para cadência
   * fora do enum ou inteiro < 1; 404 para key desconhecida) — a aba
   * "Operação" mostra o erro no formulário.
   */
  updateSetting(key: string, value: AppSettingValue): Promise<AppSettingUpdate>;
  /**
   * CFG-06 — `GET /api/config/vocabularies`: os 3 vocabulários de domínio
   * agrupados como o servidor serializa (`{ EVIDENCE_TYPE: [...], ... }`).
   * Uma lista pode vir vazia (ambiente recém-migrado); é o consumidor
   * (`withDefaultVocabularies`, via `useVocabularies` em `store.tsx`) quem
   * completa com o default byte-idêntico ao seed.
   */
  vocabularies(): Promise<Vocabularies>;
  /**
   * CFG-06 (admin UI) — `POST /api/config/vocabularies/:vocabulary/:code`:
   * cadastra um code NOVO. Admin-only e validação no backend
   * (`DomainVocabulary` → 400 `INVALID_VOCABULARY_ITEM` para labelKey
   * vazio; 409 `DUPLICATE_VOCABULARY_CODE` para code repetido) — a aba
   * "Vocabulários" mostra o erro no formulário. Não existe DELETE: quem
   * quer tirar um code de circulação usa `active=false` no PATCH.
   */
  addVocabularyItem(
    vocabulary: VocabularyName,
    code: string,
    input: VocabularyItemInput,
  ): Promise<VocabularyItem>;
  /**
   * CFG-06 (admin UI) — `PATCH /api/config/vocabularies/:vocabulary/:code`:
   * edita labelKey/sortOrder/active de um code existente (404 para code
   * desconhecido — o PATCH edita, nunca cria).
   */
  updateVocabularyItem(
    vocabulary: VocabularyName,
    code: string,
    patch: VocabularyItemPatch,
  ): Promise<VocabularyItem>;
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

  // CFG-03 (admin UI) — mesma disciplina do PUT de bands: resposta validada.
  updateTextTemplate = (
    key: string,
    locale: string,
    template: string,
  ): Promise<TextTemplateRecord> =>
    this.client
      .put<TextTemplateRecord>(
        `/api/config/templates/${encodeURIComponent(key)}/${encodeURIComponent(locale)}`,
        { template },
      )
      .then((data) => textTemplateRecordSchema.parse(data));

  // CFG-04 — mesma disciplina de `bands`/`templates`: validado em runtime,
  // não só cast. Os limites decidem o que a matriz DEIXA tentar.
  curationPolicy = (): Promise<CurationPolicy> =>
    this.client
      .request<CurationPolicy>("/api/config/curation-policy")
      .then((data) => curationPolicySchema.parse(data));

  // CFG-04 (admin UI) — resposta do PUT também validada (a política
  // recém-gravada volta para o cache via invalidação; forma errada tem que
  // falhar barulhento aqui, não corromper os limites da matriz).
  updateCurationPolicy = (policy: CurationPolicy): Promise<CurationPolicy> =>
    this.client
      .put<CurationPolicy>("/api/config/curation-policy", policy)
      .then((data) => curationPolicySchema.parse(data));

  // CFG-05 — mesma disciplina de `bands`/`curationPolicy`: validado em
  // runtime, não só cast. Os valores decidem cadência, piso e limiar de LNT.
  settings = (): Promise<AppSettingsResponse> =>
    this.client
      .request<AppSettingsResponse>("/api/config/settings")
      .then((data) => appSettingsResponseSchema.parse(data));

  // CFG-05 (admin UI) — resposta do PUT também validada (o valor
  // recém-gravado volta ao cache via invalidação; forma errada tem que
  // falhar barulhento aqui, não corromper cadência/piso/limiar).
  updateSetting = (key: string, value: AppSettingValue): Promise<AppSettingUpdate> =>
    this.client
      .put<AppSettingUpdate>(`/api/config/settings/${encodeURIComponent(key)}`, { value })
      .then((data) => appSettingPutResponseSchema.parse(data));

  // CFG-06 — mesma disciplina de `bands`/`settings`: validado em runtime,
  // não só cast. Os itens decidem as OPÇÕES dos selects de evidência,
  // trilha e PDI — forma errada tem que falhar barulhento no `useQuery`.
  vocabularies = (): Promise<Vocabularies> =>
    this.client
      .request<Vocabularies>("/api/config/vocabularies")
      .then((data) => vocabulariesResponseSchema.parse(data));

  // CFG-06 (admin UI) — resposta do POST validada (o item recém-criado
  // volta ao cache via invalidação; forma errada tem que falhar barulhento
  // aqui, não corromper as opções dos selects).
  addVocabularyItem = (
    vocabulary: VocabularyName,
    code: string,
    input: VocabularyItemInput,
  ): Promise<VocabularyItem> =>
    this.client
      .post<VocabularyItem>(
        `/api/config/vocabularies/${vocabulary}/${encodeURIComponent(code)}`,
        input,
      )
      .then((data) => vocabularyItemSchema.parse(data));

  // CFG-06 (admin UI) — mesma disciplina do POST acima: resposta validada.
  updateVocabularyItem = (
    vocabulary: VocabularyName,
    code: string,
    patch: VocabularyItemPatch,
  ): Promise<VocabularyItem> =>
    this.client
      .patch<VocabularyItem>(
        `/api/config/vocabularies/${vocabulary}/${encodeURIComponent(code)}`,
        patch,
      )
      .then((data) => vocabularyItemSchema.parse(data));
}
