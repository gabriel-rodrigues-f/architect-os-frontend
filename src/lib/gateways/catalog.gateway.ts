import type { Capability, Competency } from "../domain";
import type { ApiClient } from "../api-client";
import { catalogImportSummarySchema } from "../api-schemas";
import type { CatalogImportPayload, CatalogImportSummary } from "../catalog-import";

export interface CatalogGateway {
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

  importCatalog(payload: CatalogImportPayload): Promise<CatalogImportSummary>;
}

export class HttpCatalogGateway implements CatalogGateway {
  constructor(private readonly client: ApiClient) {}

  createCapability = (
    capability: Omit<Capability, "id" | "curation" | "short"> & { short?: string },
  ): Promise<Capability> => this.client.post<Capability>("/capabilities", capability);

  updateCapability = (
    id: string,
    patch_: Partial<Omit<Capability, "id" | "curation">>,
  ): Promise<Capability> => this.client.patch<Capability>(`/capabilities/${id}`, patch_);

  deleteCapability = (id: string): Promise<{ archived: boolean; competenciesRemoved: number }> =>
    this.client.del<{ archived: boolean; competenciesRemoved: number }>(`/capabilities/${id}`);

  createCompetency = (competency: Omit<Competency, "id">): Promise<Competency> =>
    this.client.post<Competency>("/competencies", competency);

  updateCompetency = (id: string, patch_: Partial<Omit<Competency, "id">>): Promise<Competency> =>
    this.client.patch<Competency>(`/competencies/${id}`, patch_);

  deleteCompetency = (id: string): Promise<{ archived: boolean } | undefined> =>
    this.client.del<{ archived: boolean } | undefined>(`/competencies/${id}`);

  swapCompetencyRequirement = (
    id: string,
    withCompetencyId: string,
  ): Promise<{ a: Competency; b: Competency }> =>
    this.client.post<{ a: Competency; b: Competency }>(`/competencies/${id}/swap-requirement`, {
      withCompetencyId,
    });

  importCatalog = (payload: CatalogImportPayload): Promise<CatalogImportSummary> =>
    this.client
      .post<CatalogImportSummary>("/catalog/import", payload)
      .then((data) => catalogImportSummarySchema.parse(data));
}
