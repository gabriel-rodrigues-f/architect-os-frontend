import type { Capability, Competency } from "../domain";
import type { ApiClient } from "../api-client";
import { catalogImportSummarySchema } from "../api-schemas";
import type { CatalogImportPayload, CatalogImportSummary } from "../catalog-import";

/**
 * OO-FE-02 — gateway do contexto "catálogo" (capacidades/competências). Ver
 * `cycles.gateway.ts` para a explicação do padrão interface + `Http*` e do
 * porquê dos métodos serem arrow functions de campo (spread-safe na
 * fachada `api.ts`).
 */
export interface CatalogGateway {
  /**
   * ORIENTACAO-BLOCO-2-UX-POR-TELA — `short` é opcional: o backend gera
   * automaticamente a partir de `name` (com resolução de colisão) quando o
   * campo não vem no corpo.
   */
  createCapability(
    capability: Omit<Capability, "id" | "curation" | "short"> & { short?: string },
  ): Promise<Capability>;
  updateCapability(
    id: string,
    patch_: Partial<Omit<Capability, "id" | "curation">>,
  ): Promise<Capability>;
  deleteCapability(id: string): Promise<{ archived: boolean; competenciesRemoved: number }>;
  createCompetency(competency: Omit<Competency, "id">): Promise<Competency>;
  updateCompetency(id: string, patch_: Partial<Omit<Competency, "id">>): Promise<Competency>;
  deleteCompetency(id: string): Promise<{ archived: boolean } | undefined>;
  swapCompetencyRequirement(
    id: string,
    withCompetencyId: string,
  ): Promise<{ a: Competency; b: Competency }>;
  /**
   * CFG-07 — `POST /api/catalog/import`: UPSERT-por-nome aditivo e
   * idempotente do catálogo inteiro (mesmo shape do seed, sem ids).
   * Admin-only; validação de negócio no backend (400
   * `CATALOG_IMPORT_INVALID`/`UNKNOWN_CAREER_LEVEL`) — o diálogo da matriz
   * mostra o erro em `role="alert"`.
   */
  importCatalog(payload: CatalogImportPayload): Promise<CatalogImportSummary>;
}

export class HttpCatalogGateway implements CatalogGateway {
  constructor(private readonly client: ApiClient) {}

  /** `curation` nunca vem do cliente — é sempre calculado pelo servidor a partir das competências. B-32: `id` idem — gerado no servidor. */
  createCapability = (
    capability: Omit<Capability, "id" | "curation" | "short"> & { short?: string },
  ): Promise<Capability> => this.client.post<Capability>("/api/capabilities", capability);

  updateCapability = (
    id: string,
    patch_: Partial<Omit<Capability, "id" | "curation">>,
  ): Promise<Capability> => this.client.patch<Capability>(`/api/capabilities/${id}`, patch_);

  /** `archived: true` quando a capacidade já tinha histórico e foi arquivada em vez de apagada. */
  deleteCapability = (id: string): Promise<{ archived: boolean; competenciesRemoved: number }> =>
    this.client.del<{ archived: boolean; competenciesRemoved: number }>(`/api/capabilities/${id}`);

  /** B-32 — id é sempre gerado no servidor; nunca aceito do cliente (evita colisão de slug). */
  createCompetency = (competency: Omit<Competency, "id">): Promise<Competency> =>
    this.client.post<Competency>("/api/competencies", competency);

  updateCompetency = (id: string, patch_: Partial<Omit<Competency, "id">>): Promise<Competency> =>
    this.client.patch<Competency>(`/api/competencies/${id}`, patch_);

  /** `undefined` (204) = apagada de verdade; `{archived:true}` (200) = arquivada por já ter histórico. */
  deleteCompetency = (id: string): Promise<{ archived: boolean } | undefined> =>
    this.client.del<{ archived: boolean } | undefined>(`/api/competencies/${id}`);

  /**
   * ORIENTACAO-NONA-RODADA — troca RESTRICTIVE ↔ NON_RESTRICTIVE entre duas
   * competências da mesma capacidade, numa transação só. Único jeito de
   * mudar o tipo de uma quando os dois lados já estão em 3/3 (READY) — um
   * `PATCH` comum é sempre recusado nesse caso, porque o destino já está no
   * teto.
   */
  swapCompetencyRequirement = (
    id: string,
    withCompetencyId: string,
  ): Promise<{ a: Competency; b: Competency }> =>
    this.client.post<{ a: Competency; b: Competency }>(`/api/competencies/${id}/swap-requirement`, {
      withCompetencyId,
    });

  // CFG-07 — resposta validada em runtime (mesma disciplina R2-TEC-19 do
  // `config.gateway`): o resumo alimenta o toast e o diff exibido; forma
  // errada tem que falhar barulhento aqui.
  importCatalog = (payload: CatalogImportPayload): Promise<CatalogImportSummary> =>
    this.client
      .post<CatalogImportSummary>("/api/catalog/import", payload)
      .then((data) => catalogImportSummarySchema.parse(data));
}
