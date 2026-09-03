import type { Capability, Competency } from "../domain";
import type { ApiClient } from "../api-client";
import { ApiError } from "../api-errors";
import { catalogImportSummarySchema } from "../api-schemas";
import type { CatalogImportPayload, CatalogImportSummary } from "../catalog-import";

/**
 * Onda 37 (backend ADR-0085) — o corpo do ato de fundar a capacidade. A
 * criação de capacidade VAZIA deixou de existir no contrato: `competencies`
 * é obrigatório e o serviço recusa fora do intervalo da política.
 */
export interface CapabilityFoundationPayload {
  name: string;
  active: boolean;
  competencies: { name: string }[];
}

export interface CatalogGateway {
  foundCapability(foundation: CapabilityFoundationPayload): Promise<Capability>;
  updateCapability(
    id: string,
    patch_: Partial<Omit<Capability, "id" | "curation">>,
  ): Promise<Capability>;
  deleteCapability(id: string): Promise<{ archived: boolean; competenciesRemoved: number }>;
  createCompetency(competency: Omit<Competency, "id">): Promise<Competency>;
  updateCompetency(id: string, patch_: Partial<Omit<Competency, "id">>): Promise<Competency>;
  deleteCompetency(id: string): Promise<{ archived: boolean } | undefined>;
  removeCompetencies(competencyIds: string[]): Promise<CompetencyRemovalSummary>;

  importCatalog(payload: CatalogImportPayload): Promise<CatalogImportSummary>;
}

export class HttpCatalogGateway implements CatalogGateway {
  constructor(private readonly client: ApiClient) {}

  foundCapability = (foundation: CapabilityFoundationPayload): Promise<Capability> =>
    this.client.post<Capability>("/capabilities", foundation);

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

  removeCompetencies = (competencyIds: string[]): Promise<CompetencyRemovalSummary> =>
    this.client.post<CompetencyRemovalSummary>("/competencies/bulk-removal", { competencyIds });

  importCatalog = (payload: CatalogImportPayload): Promise<CatalogImportSummary> =>
    this.client
      .post<CatalogImportSummary>("/catalog/import", payload)
      .then((data) => catalogImportSummarySchema.parse(data));
}

export type CompetencyRemovalOutcomeKind = "removed" | "archived";

export interface AffectedRecords {
  assessments: number;
  planItems: number;
  evidences: number;
  learningItems: number;
  teamRuleRequirements: number;
}

export interface CompetencyRemovalOutcome {
  competencyId: string;
  outcome: CompetencyRemovalOutcomeKind;
  affected: AffectedRecords;
}

export interface CompetencyRemovalSummary {
  outcomes: CompetencyRemovalOutcome[];
}

export class CompetencyRemovalRefusal {
  static readonly MAX_PER_REMOVAL = 200;

  static emptySelection(): ApiError {
    return new ApiError(
      "Selecione ao menos uma competência para excluir.",
      400,
      undefined,
      "VALIDATION_ERROR",
    );
  }

  static tooMany(): ApiError {
    return new ApiError(
      `A remoção em massa aceita até ${CompetencyRemovalRefusal.MAX_PER_REMOVAL} competências.`,
      400,
      undefined,
      "VALIDATION_ERROR",
    );
  }

  static competencyNotFound(id: string): ApiError {
    return new ApiError(`Competência "${id}" não encontrada`, 404, undefined, "NOT_FOUND");
  }
}

export class InMemoryCompetencyRemoval implements Pick<CatalogGateway, "removeCompetencies"> {
  private readonly known: Set<string>;
  readonly removalsMade: string[][] = [];

  constructor(
    competencies: readonly Pick<Competency, "id">[],
    private readonly inUse: ReadonlyMap<string, AffectedRecords> = new Map(),
  ) {
    this.known = new Set(competencies.map((competency) => competency.id));
  }

  removeCompetencies = (competencyIds: string[]): Promise<CompetencyRemovalSummary> => {
    if (competencyIds.length === 0) {
      return Promise.reject(CompetencyRemovalRefusal.emptySelection());
    }
    if (competencyIds.length > CompetencyRemovalRefusal.MAX_PER_REMOVAL) {
      return Promise.reject(CompetencyRemovalRefusal.tooMany());
    }
    const unknown = competencyIds.find((id) => !this.known.has(id));
    if (unknown !== undefined) {
      return Promise.reject(CompetencyRemovalRefusal.competencyNotFound(unknown));
    }
    this.removalsMade.push([...competencyIds]);
    return Promise.resolve({
      outcomes: competencyIds.map((competencyId) => {
        const affected = this.inUse.get(competencyId);
        const held = affected !== undefined && Object.values(affected).some((count) => count > 0);
        return {
          competencyId,
          outcome: held ? "archived" : "removed",
          affected: affected ?? InMemoryCompetencyRemoval.nothing(),
        };
      }),
    });
  };

  private static nothing(): AffectedRecords {
    return {
      assessments: 0,
      planItems: 0,
      evidences: 0,
      learningItems: 0,
      teamRuleRequirements: 0,
    };
  }
}
