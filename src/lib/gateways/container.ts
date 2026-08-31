import { ApiClient } from "../api-client";
import { EffectiveCurationPolicy, type CurationPolicy } from "../curation-policy";
import {
  EffectiveOperationalSettings,
  type AppSettingsResponse,
  type OperationalSettings,
} from "../operational-settings";
import { ScoringRuler, type ServedScoringBands } from "../scoring-bands";
import { SessionPolicy } from "../session-policy";
import { TextTemplateRenderer, type ServedTextTemplates } from "../text-templates";
import { VocabularyCatalog, type Vocabularies } from "../vocabularies";
import { HttpArchitectsGateway, type ArchitectsGateway } from "./architects.gateway";
import { HttpAssessmentGateway, type AssessmentGateway } from "./assessment.gateway";
import { HttpAuthGateway, type AuthGateway } from "./auth.gateway";
import { InMemoryCalibrationGateway, type CalibrationGateway } from "./calibration.gateway";
import { HttpCareerGateway, type CareerGateway } from "./career.gateway";
import { HttpCatalogGateway, type CatalogGateway } from "./catalog.gateway";
import { HttpConfigGateway, type ConfigGateway } from "./config.gateway";
import { HttpCyclesGateway, type CyclesGateway } from "./cycles.gateway";
import { HttpDevelopmentGateway, type DevelopmentGateway } from "./development.gateway";
import { HttpEvidenceGateway, type EvidenceGateway } from "./evidence.gateway";
import { HttpEvolutionGateway, type EvolutionGateway } from "./evolution.gateway";
import { HttpLearningGateway, type LearningGateway } from "./learning.gateway";
import { HttpMentoringGateway, type MentoringGateway } from "./mentoring.gateway";
import { InMemoryNoticesGateway, type NoticesGateway } from "./notices.gateway";
import { HttpReportsGateway, type ReportsGateway } from "./reports.gateway";
import { HttpStateContextsGateway, type StateContextsGateway } from "./state-contexts.gateway";
import { HttpTeamsGateway, type TeamsGateway } from "./teams.gateway";

interface FrontendConfig {
  baseUrl?: string;
}

export class AppConfiguration {
  scoringRuler(served?: ServedScoringBands): ScoringRuler {
    return ScoringRuler.fromLoaded(served);
  }

  textTemplates(served?: ServedTextTemplates): TextTemplateRenderer {
    return TextTemplateRenderer.fromLoaded(served);
  }

  vocabularies(served?: Partial<Vocabularies>): VocabularyCatalog {
    return VocabularyCatalog.fromLoaded(served);
  }

  operationalSettings(served?: AppSettingsResponse): OperationalSettings {
    return EffectiveOperationalSettings.resolve(served);
  }

  curationPolicy(served?: CurationPolicy): CurationPolicy {
    return EffectiveCurationPolicy.resolve(served);
  }
}

export class FrontendContainer {
  readonly sessionPolicy: SessionPolicy;
  readonly configuration: AppConfiguration;
  readonly apiClient: ApiClient;
  readonly architectsGateway: ArchitectsGateway;
  readonly assessmentGateway: AssessmentGateway;
  readonly authGateway: AuthGateway;
  readonly calibrationGateway: CalibrationGateway;
  readonly careerGateway: CareerGateway;
  readonly catalogGateway: CatalogGateway;
  readonly configGateway: ConfigGateway;
  readonly cyclesGateway: CyclesGateway;
  readonly developmentGateway: DevelopmentGateway;
  readonly evidenceGateway: EvidenceGateway;
  readonly evolutionGateway: EvolutionGateway;
  readonly learningGateway: LearningGateway;
  readonly mentoringGateway: MentoringGateway;
  readonly noticesGateway: NoticesGateway;
  readonly reportsGateway: ReportsGateway;
  readonly stateContextsGateway: StateContextsGateway;
  readonly teamsGateway: TeamsGateway;

  private constructor(config: FrontendConfig) {
    this.sessionPolicy = new SessionPolicy();
    this.configuration = new AppConfiguration();
    this.apiClient = new ApiClient(config.baseUrl, (error) =>
      this.sessionPolicy.reviewFailure(error),
    );
    this.architectsGateway = new HttpArchitectsGateway(this.apiClient);
    this.assessmentGateway = new HttpAssessmentGateway(this.apiClient);
    this.authGateway = new HttpAuthGateway(this.apiClient);
    this.calibrationGateway = new InMemoryCalibrationGateway();
    this.careerGateway = new HttpCareerGateway(this.apiClient);
    this.catalogGateway = new HttpCatalogGateway(this.apiClient);
    this.configGateway = new HttpConfigGateway(this.apiClient);
    this.cyclesGateway = new HttpCyclesGateway(this.apiClient);
    this.developmentGateway = new HttpDevelopmentGateway(this.apiClient);
    this.evidenceGateway = new HttpEvidenceGateway(this.apiClient);
    this.evolutionGateway = new HttpEvolutionGateway(this.apiClient);
    this.learningGateway = new HttpLearningGateway(this.apiClient);
    this.mentoringGateway = new HttpMentoringGateway(this.apiClient);
    this.noticesGateway = new InMemoryNoticesGateway(() => this.authGateway.me());
    this.reportsGateway = new HttpReportsGateway(this.apiClient);
    this.stateContextsGateway = new HttpStateContextsGateway(config.baseUrl, (error) =>
      this.sessionPolicy.reviewFailure(error),
    );
    this.teamsGateway = new HttpTeamsGateway(this.apiClient);
  }

  static create(config: FrontendConfig = {}): FrontendContainer {
    return new FrontendContainer(config);
  }
}

export const defaultContainer = FrontendContainer.create();
