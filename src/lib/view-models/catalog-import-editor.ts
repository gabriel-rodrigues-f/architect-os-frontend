import {
  catalogImportPayloadSchema,
  sameCatalogName,
  type CatalogImportPayload,
} from "../catalog-import";
import type { Capability, Competency } from "../domain";

interface CatalogImportPreviewCapability {
  name: string;

  action: "create" | "update";
  competenciesToCreate: string[];
  competenciesToUpdate: string[];
}

interface CatalogImportPreview {
  capabilities: CatalogImportPreviewCapability[];
  capabilitiesToCreate: number;
  capabilitiesToUpdate: number;
  competenciesToCreate: number;
  competenciesToUpdate: number;
}

export class CatalogImportEditor {
  private constructor(
    private readonly currentCapabilities: readonly Pick<Capability, "id" | "name">[],
    private readonly currentCompetencies: readonly Pick<Competency, "name" | "capabilityId">[],
    readonly text: string,
    private readonly parsed: CatalogImportPayload | null,
    readonly errorKey:
      | "matrix.import.error.invalidJson"
      | "matrix.import.error.invalidShape"
      | "matrix.import.error.empty"
      | null,
  ) {}

  static from(
    capabilities: readonly Pick<Capability, "id" | "name">[],
    competencies: readonly Pick<Competency, "name" | "capabilityId">[],
  ): CatalogImportEditor {
    return new CatalogImportEditor(capabilities, competencies, "", null, null);
  }

  withText(text: string): CatalogImportEditor {
    if (text.trim().length === 0) {
      return new CatalogImportEditor(
        this.currentCapabilities,
        this.currentCompetencies,
        text,
        null,
        null,
      );
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return new CatalogImportEditor(
        this.currentCapabilities,
        this.currentCompetencies,
        text,
        null,
        "matrix.import.error.invalidJson",
      );
    }
    const result = catalogImportPayloadSchema.safeParse(json);
    if (!result.success) {
      return new CatalogImportEditor(
        this.currentCapabilities,
        this.currentCompetencies,
        text,
        null,
        "matrix.import.error.invalidShape",
      );
    }

    if (result.data.capabilities.length === 0) {
      return new CatalogImportEditor(
        this.currentCapabilities,
        this.currentCompetencies,
        text,
        null,
        "matrix.import.error.empty",
      );
    }
    return new CatalogImportEditor(
      this.currentCapabilities,
      this.currentCompetencies,
      text,
      result.data,
      null,
    );
  }

  get isValid(): boolean {
    return this.parsed !== null;
  }

  payload(): CatalogImportPayload | null {
    return this.parsed;
  }

  preview(): CatalogImportPreview | null {
    if (!this.parsed) return null;
    const capabilities = this.parsed.capabilities.map(
      (capability): CatalogImportPreviewCapability => {
        const existing = this.currentCapabilities.find((current) =>
          sameCatalogName(current.name, capability.name),
        );
        const existingCompetencyNames = existing
          ? this.currentCompetencies
              .filter((competency) => competency.capabilityId === existing.id)
              .map((competency) => competency.name)
          : [];
        const competenciesToCreate: string[] = [];
        const competenciesToUpdate: string[] = [];
        for (const competency of capability.competencies) {
          const matches = existingCompetencyNames.some((name) =>
            sameCatalogName(name, competency.name),
          );
          (matches ? competenciesToUpdate : competenciesToCreate).push(competency.name);
        }
        return {
          name: capability.name,
          action: existing ? "update" : "create",
          competenciesToCreate,
          competenciesToUpdate,
        };
      },
    );
    return {
      capabilities,
      capabilitiesToCreate: capabilities.filter((c) => c.action === "create").length,
      capabilitiesToUpdate: capabilities.filter((c) => c.action === "update").length,
      competenciesToCreate: capabilities.reduce((n, c) => n + c.competenciesToCreate.length, 0),
      competenciesToUpdate: capabilities.reduce((n, c) => n + c.competenciesToUpdate.length, 0),
    };
  }
}
