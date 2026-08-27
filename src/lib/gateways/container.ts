import { ApiClient } from "../api-client";
import { HttpArchitectsGateway, type ArchitectsGateway } from "./architects.gateway";
import { HttpAssessmentGateway, type AssessmentGateway } from "./assessment.gateway";
import { HttpAuthGateway, type AuthGateway } from "./auth.gateway";
import { HttpCareerGateway, type CareerGateway } from "./career.gateway";
import { HttpCatalogGateway, type CatalogGateway } from "./catalog.gateway";
import { HttpConfigGateway, type ConfigGateway } from "./config.gateway";
import { HttpCyclesGateway, type CyclesGateway } from "./cycles.gateway";
import { HttpDevelopmentGateway, type DevelopmentGateway } from "./development.gateway";
import { HttpEvidenceGateway, type EvidenceGateway } from "./evidence.gateway";
import { HttpEvolutionGateway, type EvolutionGateway } from "./evolution.gateway";
import { HttpLearningGateway, type LearningGateway } from "./learning.gateway";
import { HttpMentoringGateway, type MentoringGateway } from "./mentoring.gateway";
import { HttpReportsGateway, type ReportsGateway } from "./reports.gateway";

interface FrontendConfig {
  baseUrl?: string;
}

export class FrontendContainer {
  readonly apiClient: ApiClient;
  readonly architectsGateway: ArchitectsGateway;
  readonly assessmentGateway: AssessmentGateway;
  readonly authGateway: AuthGateway;
  readonly careerGateway: CareerGateway;
  readonly catalogGateway: CatalogGateway;
  readonly configGateway: ConfigGateway;
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
    this.configGateway = new HttpConfigGateway(this.apiClient);
    this.cyclesGateway = new HttpCyclesGateway(this.apiClient);
    this.developmentGateway = new HttpDevelopmentGateway(this.apiClient);
    this.evidenceGateway = new HttpEvidenceGateway(this.apiClient);
    this.evolutionGateway = new HttpEvolutionGateway(this.apiClient);
    this.learningGateway = new HttpLearningGateway(this.apiClient);
    this.mentoringGateway = new HttpMentoringGateway(this.apiClient);
    this.reportsGateway = new HttpReportsGateway(this.apiClient);
  }

  static create(config: FrontendConfig = {}): FrontendContainer {
    return new FrontendContainer(config);
  }
}

export const defaultContainer = FrontendContainer.create();
