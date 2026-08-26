import type { EvolutionFilters } from "../domain";
import type { ApiClient } from "../api-client";

export interface ReportsGateway {
  exportEvolutionPdf(
    architectId: string,
    filters: EvolutionFilters,
  ): Promise<{ blob: Blob; filename: string }>;
}

export class HttpReportsGateway implements ReportsGateway {
  constructor(private readonly client: ApiClient) {}

  exportEvolutionPdf = (
    architectId: string,
    filters: EvolutionFilters,
  ): Promise<{ blob: Blob; filename: string }> =>
    this.client.requestBlob("/api/reports/evolution/pdf", { architectId, ...filters });
}
