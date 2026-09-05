import { downloadBlob, type BlobDownload } from "@/lib/download";
import type { CatalogImportPayload } from "@/lib/catalog-import";

/**
 * A amostra que a tela de importação mostra e deixa baixar (dono, 2026-09-05:
 * "um exemplo completo, com capacidades e as competências dentro delas").
 * É o MESMO formato do seed, sem ids: capacidade e competência são casadas por
 * nome na importação. Duas capacidades bastam para mostrar que a lista é uma
 * lista; nomes genéricos de propósito, para ninguém importar a amostra
 * achando que é o catálogo.
 */
export class CatalogImportSample {
  static readonly FILE_NAME = "catalogo-amostra.json";

  static readonly PAYLOAD: CatalogImportPayload = {
    capabilities: [
      {
        name: "Arquitetura de Soluções",
        short: "Soluções",
        competencies: [
          { name: "Desenho de arquitetura de referência" },
          { name: "Decisões de arquitetura (ADR)" },
          { name: "Integração entre sistemas" },
        ],
      },
      {
        name: "Nuvem e Infraestrutura",
        short: "Nuvem",
        competencies: [{ name: "Containers e orquestração" }, { name: "Custo e FinOps" }],
      },
    ],
  };

  static text(): string {
    return `${JSON.stringify(CatalogImportSample.PAYLOAD, null, 2)}\n`;
  }

  static download(save: BlobDownload = downloadBlob): void {
    save(
      new Blob([CatalogImportSample.text()], { type: "application/json" }),
      CatalogImportSample.FILE_NAME,
    );
  }
}
