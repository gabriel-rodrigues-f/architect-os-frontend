import { describe, expect, it, vi } from "vitest";

import { catalogImportPayloadSchema } from "@/lib/catalog-import";
import { CatalogImportSample } from "@/lib/catalog-import-sample";
import { FileText } from "@/lib/file-text";

describe("CatalogImportSample — a amostra que a tela deixa baixar", () => {
  it("é um payload válido para a própria importação, com competências dentro das capacidades", () => {
    const parsed = catalogImportPayloadSchema.safeParse(JSON.parse(CatalogImportSample.text()));
    expect(parsed.success).toBe(true);
    expect(CatalogImportSample.PAYLOAD.capabilities.length).toBeGreaterThan(1);
    for (const capability of CatalogImportSample.PAYLOAD.capabilities) {
      expect(capability.competencies.length).toBeGreaterThan(0);
    }
  });

  it("baixa como JSON com o nome da amostra", async () => {
    const save = vi.fn();
    CatalogImportSample.download(save);
    const [blob, name] = save.mock.calls[0] as [Blob, string];
    expect(name).toBe("catalogo-amostra.json");
    expect(blob.type).toBe("application/json");
    expect(await FileText.of(blob)).toBe(CatalogImportSample.text());
  });
});
