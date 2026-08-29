import { z } from "zod";

export const catalogImportPayloadSchema = z.object({
  capabilities: z.array(
    z.object({
      name: z.string().min(1),
      short: z.string().min(1),
      competencies: z.array(
        z.object({
          name: z.string().min(1),
        }),
      ),
    }),
  ),
});

export type CatalogImportPayload = z.infer<typeof catalogImportPayloadSchema>;

export interface CatalogImportSummary {
  capabilitiesCreated: { id: string; name: string }[];
  capabilitiesUpdated: { id: string; name: string }[];
  competenciesCreated: { id: string; name: string; capabilityId: string }[];
  competenciesUpdated: { id: string; name: string; capabilityId: string }[];
}

export const sameCatalogName = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");
