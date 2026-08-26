import { ApiClient } from "../api-client";
import { HttpArchitectsGateway, type ArchitectsGateway } from "./architects.gateway";
import { HttpAssessmentGateway, type AssessmentGateway } from "./assessment.gateway";
import { HttpAuthGateway, type AuthGateway } from "./auth.gateway";
import { HttpCareerGateway, type CareerGateway } from "./career.gateway";
import { HttpCatalogGateway, type CatalogGateway } from "./catalog.gateway";
import { HttpCyclesGateway, type CyclesGateway } from "./cycles.gateway";
import { HttpDevelopmentGateway, type DevelopmentGateway } from "./development.gateway";
import { HttpEvidenceGateway, type EvidenceGateway } from "./evidence.gateway";
import { HttpEvolutionGateway, type EvolutionGateway } from "./evolution.gateway";
import { HttpLearningGateway, type LearningGateway } from "./learning.gateway";
import { HttpMentoringGateway, type MentoringGateway } from "./mentoring.gateway";
import { HttpReportsGateway, type ReportsGateway } from "./reports.gateway";

/** Config aceita por {@link FrontendContainer.create}. Hoje só repassa o que `ApiClient` já aceitava como parâmetro solto (`api-client.ts`); `baseUrl` continua opcional porque `ApiClient` já sabe resolver `VITE_API_URL` sozinho quando omitido. */
export interface FrontendConfig {
  baseUrl?: string;
}

/**
 * OO2-07 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 54-56) — sucessor do composition root em consts soltas que existia
 * aqui (histórico do OO-FE-02 abaixo). Continua sendo o único lugar (fora de
 * teste) que dá `new` no `ApiClient` e nos gateways — mesma regra do
 * `container.ts` do backend (Anexo F.3, "DI manual, explícita no
 * container") —, mas agora como CLASSE com construtor privado + fábrica
 * estática, para três ganhos que os consts soltos não davam:
 *
 * 1. Um teste pode montar um `FrontendContainer` próprio (`.create({ baseUrl:
 *    "http://outro-host" })`) sem tocar no singleton do app nem precisar
 *    reatribuir um monte de export individual.
 * 2. Mockar UM gateway isolado vira "construa um objeto com a mesma forma de
 *    `FrontendContainer` e troque um campo", em vez de precisar de
 *    `vi.mock()` num módulo inteiro de consts.
 * 3. Configuração por ambiente (ex.: front apontando para um backend
 *    diferente em preview/e2e) tem um parâmetro de verdade (`FrontendConfig`)
 *    em vez de variável de ambiente lida direto dentro de cada gateway.
 *
 * `defaultContainer` abaixo preserva o comportamento de antes: construído
 * uma vez, na carga deste módulo, exatamente como `defaultApiClient` era —
 * é o que permite `api.ts` continuar um módulo comum (não um hook) que só
 * desestrutura os gateways do container no top-level, sem precisar existir
 * dentro de uma árvore React para funcionar (`store.tsx` e todo teste
 * existente contam com isso).
 *
 * `DependencyProvider` (`../dependencies.tsx`) é quem expõe este mesmo
 * `defaultContainer` via Context React para consumidores futuros — nenhuma
 * tela desta leva passou a consumir gateway via Context ainda (isso é
 * OO2-08, ViewModels por tela); esta PR só constrói o container + o
 * Provider e prova que nada quebrou por baixo do `api.ts`.
 */
export class FrontendContainer {
  readonly apiClient: ApiClient;
  readonly architectsGateway: ArchitectsGateway;
  readonly assessmentGateway: AssessmentGateway;
  readonly authGateway: AuthGateway;
  readonly careerGateway: CareerGateway;
  readonly catalogGateway: CatalogGateway;
  readonly cyclesGateway: CyclesGateway;
  readonly developmentGateway: DevelopmentGateway;
  readonly evidenceGateway: EvidenceGateway;
  readonly evolutionGateway: EvolutionGateway;
  readonly learningGateway: LearningGateway;
  readonly mentoringGateway: MentoringGateway;
  readonly reportsGateway: ReportsGateway;

  private constructor(config: FrontendConfig) {
    this.apiClient = new ApiClient(config.baseUrl);
    this.architectsGateway = new HttpArchitectsGateway(this.apiClient);
    this.assessmentGateway = new HttpAssessmentGateway(this.apiClient);
    this.authGateway = new HttpAuthGateway(this.apiClient);
    this.careerGateway = new HttpCareerGateway(this.apiClient);
    this.catalogGateway = new HttpCatalogGateway(this.apiClient);
    this.cyclesGateway = new HttpCyclesGateway(this.apiClient);
    this.developmentGateway = new HttpDevelopmentGateway(this.apiClient);
    this.evidenceGateway = new HttpEvidenceGateway(this.apiClient);
    this.evolutionGateway = new HttpEvolutionGateway(this.apiClient);
    this.learningGateway = new HttpLearningGateway(this.apiClient);
    this.mentoringGateway = new HttpMentoringGateway(this.apiClient);
    this.reportsGateway = new HttpReportsGateway(this.apiClient);
  }

  /** Único jeito de montar um `FrontendContainer` — construtor é privado de propósito, para deixar claro que "criar" é sempre passar por esta fábrica (mesmo hoje sem lógica extra além do construtor). */
  static create(config: FrontendConfig = {}): FrontendContainer {
    return new FrontendContainer(config);
  }
}

/**
 * Instância única do processo, mesma vida útil do antigo `defaultApiClient`
 * + consts de gateway. `api.ts` desestrutura os gateways daqui;
 * `DependencyProvider` usa esta mesma instância como valor padrão do
 * Context, então uma tela que hoje lê `api.ts` e uma tela futura que ler
 * `useContainer()` enxergam os MESMOS gateways (mesmo `ApiClient`, mesmo
 * `unauthorizedHandler` registrado por `auth.tsx`) — não duas árvores de
 * objeto paralelas.
 */
export const defaultContainer = FrontendContainer.create();
