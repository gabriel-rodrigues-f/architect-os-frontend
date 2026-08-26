import {
  catalogImportPayloadSchema,
  sameCatalogName,
  type CatalogImportPayload,
} from "../catalog-import";
import type { Capability, Competency } from "../domain";

/** Uma linha do preview — o que o import FARIA com cada capacidade do payload. */
export interface CatalogImportPreviewCapability {
  name: string;
  /** `create` quando nenhum nome atual casa (case-insensitive, trim) — a régua do upsert do backend. */
  action: "create" | "update";
  competenciesToCreate: string[];
  competenciesToUpdate: string[];
}

export interface CatalogImportPreview {
  capabilities: CatalogImportPreviewCapability[];
  capabilitiesToCreate: number;
  capabilitiesToUpdate: number;
  competenciesToCreate: number;
  competenciesToUpdate: number;
}

/**
 * CFG-07 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.2) — ViewModel do diálogo
 * "Importar catálogo" da matriz, na régua da casa (payload/validação em
 * classe testável, render na tela). A tela só liga o textarea/upload a
 * `withText` e o botão de importar a `payload()`.
 *
 * O que valida AQUI (antes do POST): JSON parseável e o SHAPE do payload
 * (zod espelhando o `catalogImportSchema` do backend). O que NÃO valida, de
 * propósito: unicidade de nomes/siglas no payload e níveis de carreira
 * conhecidos — negócio do VO/use case do backend (400 com code estável, que
 * o diálogo mostra em `role="alert"`).
 *
 * `preview()` conta POR NOME contra o estado ATUAL da matriz (a mesma
 * identidade do upsert — `sameCatalogName`): o admin vê o que será criado e
 * o que será atualizado ANTES de enviar. É um preview honesto, não uma
 * simulação do servidor: o resultado de verdade é o `CatalogImportSummary`
 * da resposta.
 *
 * Imutável de propósito (cada edição devolve um editor novo) — encaixa em
 * `useState` sem `useEffect` de sincronização.
 */
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
    // Vazio é shape válido para o zod, mas o backend recusa (`Importação
    // vazia`) — melhor recusar aqui, antes do POST, com mensagem própria.
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

  /** O corpo do POST — `null` enquanto o texto não é um payload válido. */
  payload(): CatalogImportPayload | null {
    return this.parsed;
  }

  /** O diff por nome contra a matriz atual — `null` enquanto não há payload válido. */
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
