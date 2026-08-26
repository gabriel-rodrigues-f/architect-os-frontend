import { z } from "zod";

/**
 * CFG-07 (SPEC-OO3-13-HARDCODED-CONFIG.md, A4, §3.2) — o payload de
 * `POST /api/catalog/import`: o MESMO shape de `seed-data/catalog.json` do
 * backend, sem ids (B-32 — a identidade do upsert é o NOME; ids são do
 * servidor) e sem `active` (importar nunca desativa nada).
 *
 * O zod aqui espelha o `catalogImportSchema` do backend
 * (`catalog.schemas.ts`) e valida FORMATO client-side, para o diálogo
 * recusar um JSON malformado ANTES do POST — com preview honesto do que
 * será criado/atualizado. As regras de NEGÓCIO (nomes/siglas duplicados no
 * payload, níveis de carreira conhecidos) continuam no VO
 * `CatalogImportPayload` e no use case do backend (400
 * `CATALOG_IMPORT_INVALID`/`UNKNOWN_CAREER_LEVEL`, 409), que a UI mostra
 * em `role="alert"` — nunca revalidadas aqui.
 */

const level = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const catalogImportPayloadSchema = z.object({
  capabilities: z.array(
    z.object({
      name: z.string().min(1),
      short: z.string().min(1),
      competencies: z.array(
        z.object({
          name: z.string().min(1),
          requirementType: z.enum(["RESTRICTIVE", "NON_RESTRICTIVE"]),
          expected: z.record(z.string().min(1), level),
        }),
      ),
    }),
  ),
});

export type CatalogImportPayload = z.infer<typeof catalogImportPayloadSchema>;

/** O resumo que o backend devolve (`CatalogImportSummary`) — o que de fato foi criado/atualizado. */
export interface CatalogImportSummary {
  capabilitiesCreated: { id: string; name: string }[];
  capabilitiesUpdated: { id: string; name: string }[];
  competenciesCreated: { id: string; name: string; capabilityId: string }[];
  competenciesUpdated: { id: string; name: string; capabilityId: string }[];
}

/** Mesma régua de identidade do upsert do backend (`sameCatalogName`): caixa/espacos nas pontas não diferenciam. */
export const sameCatalogName = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");
