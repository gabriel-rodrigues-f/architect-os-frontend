import { ApiClient } from "../api-client";
import { SessionPolicy } from "../session-policy";
import { HttpAnalyticsGateway, type AnalyticsGateway } from "./analytics.gateway";
import { HttpArchitectsGateway, type ArchitectsGateway } from "./architects.gateway";
import { HttpAssessmentGateway, type AssessmentGateway } from "./assessment.gateway";
import { HttpAuthGateway, type AuthGateway } from "./auth.gateway";
import { HttpCalibrationGateway, type CalibrationGateway } from "./calibration.gateway";
import { HttpCareerGateway, type CareerGateway } from "./career.gateway";
import { HttpCatalogGateway, type CatalogGateway } from "./catalog.gateway";
import { HttpConfigGateway, type ConfigGateway } from "./config.gateway";
import { HttpCyclesGateway, type CyclesGateway } from "./cycles.gateway";
import { HttpDevelopmentGateway, type DevelopmentGateway } from "./development.gateway";
import { HttpEvidenceGateway, type EvidenceGateway } from "./evidence.gateway";
import { HttpEvolutionGateway, type EvolutionGateway } from "./evolution.gateway";
import { HttpLearningGateway, type LearningGateway } from "./learning.gateway";
import { HttpMentoringGateway, type MentoringGateway } from "./mentoring.gateway";
import { HttpNoticesGateway, type NoticesGateway } from "./notices.gateway";
import { HttpReportsGateway, type ReportsGateway } from "./reports.gateway";
import { HttpStateContextsGateway, type StateContextsGateway } from "./state-contexts.gateway";
import { HttpTeamRosterGateway, type TeamRosterGateway } from "./team-roster.gateway";
import { HttpTeamsGateway, type TeamsGateway } from "./teams.gateway";

interface FrontendConfig {
  baseUrl?: string;
}

export class FrontendContainer {
  readonly sessionPolicy: SessionPolicy;
  readonly apiClient: ApiClient;
  readonly analyticsGateway: AnalyticsGateway;
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
  readonly teamRosterGateway: TeamRosterGateway;
  readonly teamsGateway: TeamsGateway;

  private constructor(config: FrontendConfig) {
    this.sessionPolicy = new SessionPolicy();
    this.apiClient = new ApiClient(config.baseUrl, (error) =>
      this.sessionPolicy.reviewFailure(error),
    );
    this.analyticsGateway = new HttpAnalyticsGateway(this.apiClient);
    this.architectsGateway = new HttpArchitectsGateway(this.apiClient);
    this.assessmentGateway = new HttpAssessmentGateway(this.apiClient);
    this.authGateway = new HttpAuthGateway(this.apiClient);
    this.calibrationGateway = new HttpCalibrationGateway(this.apiClient);
    this.careerGateway = new HttpCareerGateway(this.apiClient);
    this.catalogGateway = new HttpCatalogGateway(this.apiClient);
    this.configGateway = new HttpConfigGateway(this.apiClient);
    this.cyclesGateway = new HttpCyclesGateway(this.apiClient);
    this.developmentGateway = new HttpDevelopmentGateway(this.apiClient);
    this.evidenceGateway = new HttpEvidenceGateway(this.apiClient);
    this.evolutionGateway = new HttpEvolutionGateway(this.apiClient);
    this.learningGateway = new HttpLearningGateway(this.apiClient);
    this.mentoringGateway = new HttpMentoringGateway(this.apiClient);
    this.noticesGateway = new HttpNoticesGateway(this.apiClient);
    this.reportsGateway = new HttpReportsGateway(this.apiClient);
    this.stateContextsGateway = new HttpStateContextsGateway(config.baseUrl, (error) =>
      this.sessionPolicy.reviewFailure(error),
    );
    this.teamRosterGateway = new HttpTeamRosterGateway(this.apiClient);
    this.teamsGateway = new HttpTeamsGateway(this.apiClient);
  }

  static create(config: FrontendConfig = {}): FrontendContainer {
    return new FrontendContainer(config);
  }
}

export const defaultContainer = FrontendContainer.create();
