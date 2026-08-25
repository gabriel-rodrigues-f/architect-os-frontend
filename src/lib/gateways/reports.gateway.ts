import type { EvolutionFilters } from "../domain";
import type { ApiClient } from "../api-client";

/**
 * OO-FE-02 — gateway do contexto "relatórios". Já era um objeto separado
 * (`reportsApi`) antes desta migração; ganha o mesmo formato interface +
 * `Http*` dos demais gateways por consistência (métodos como arrow
 * functions de campo — ver `cycles.gateway.ts`).
 *
 * Fase 10.6 — só individual: o relatório é "o que esta pessoa está vendo na
 * tela de Evolução dela", mesmo escopo de `evolutionGateway.architect`. Time
 * inteiro em PDF não foi pedido nem construído no backend (que renderizador
 * de tabela/gráfico faria sentido pra dezenas de pessoas de uma vez é uma
 * decisão de produto em aberto, não um detalhe de implementação).
 */
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
