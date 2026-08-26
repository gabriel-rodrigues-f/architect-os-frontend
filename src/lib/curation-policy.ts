/**
 * CFG-04 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.1 tabela 2 / B4) — os três
 * limites de composição do catálogo (máximo de competências ativas por
 * capacidade e a divisão restritivas/não restritivas) deixaram de ser
 * literais no código: a autoridade é a tabela `catalog_curation_policy` do
 * backend, servida por `GET /api/config/curation-policy`
 * (`ConfigGateway.curationPolicy`). Este módulo é o lado do frontend dessa
 * fatia, no MESMO formato de `scoring-bands.ts` (CFG-02) e
 * `text-templates.ts` (CFG-03):
 *
 * - o TIPO espelha o domínio do backend
 *   (`backend/src/modules/config/domain/catalog-curation-policy.ts`,
 *   `CatalogCurationLimits` — a forma plana que circula por HTTP);
 * - `DEFAULT_CURATION_POLICY` é o ÚNICO lugar onde os números antigos
 *   (6, 3+3) sobrevivem, como fallback byte-idêntico ao seed da migration
 *   (`20260826020000000_catalog-curation-policy.sql`, espelhado em
 *   `DEFAULT_CATALOG_CURATION_LIMITS` no backend) — enquanto a consulta não
 *   resolve (ou falha), tudo se comporta exatamente como antes, sem flash;
 * - quem quer a política EFETIVA (servidor com fallback) usa
 *   `useCurationPolicy` (`store.tsx`); o export `DEFAULT_CURATION_POLICY`
 *   existe para código não-React e para preservar o comportamento default
 *   (mesma divisão de `defaultGapSeverityRuler`/`defaultObjectiveFromGap`).
 *
 * O front nunca REVALIDA a política (soma fecha, inteiros positivos — isso
 * é o VO `CatalogCurationPolicy` do backend) nem recalcula
 * `curation.status`: os limites aqui são só apresentação (esconder botão,
 * desabilitar option), mesmo racional de `UiAuthorizationPolicy`.
 */

/** Espelho de `CatalogCurationLimits` do backend — a forma servida por `GET /api/config/curation-policy`. */
export interface CurationPolicy {
  maxActiveCompetencies: number;
  requiredRestrictive: number;
  requiredNonRestrictive: number;
}

/**
 * O fallback único — espelho EXATO do seed da migration do backend (que por
 * sua vez espelha os literais `>= 6`/`>= 3` que o código tinha antes da
 * fatia). Se o seed mudar lá, este arquivo muda junto; os testes de
 * fallback denunciam qualquer divergência de comportamento.
 */
export const DEFAULT_CURATION_POLICY: CurationPolicy = {
  maxActiveCompetencies: 6,
  requiredRestrictive: 3,
  requiredNonRestrictive: 3,
};

/**
 * Política efetiva = servidor quando carregada, default enquanto não (mesmo
 * espírito de `withDefaultScoringBands`/`withDefaultTextTemplates` — sem
 * flash: com o seed default o comportamento é byte-idêntico ao hardcoded).
 */
export const withDefaultCurationPolicy = (loaded?: CurationPolicy): CurationPolicy =>
  loaded ?? DEFAULT_CURATION_POLICY;
