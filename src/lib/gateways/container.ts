import { ApiClient } from "../api-client";
import { MetricsTab } from "../platform-metrics";
import { SessionPolicy } from "../session-policy";
import { SupportAccess } from "../support-access";
import { SynapseSignals } from "../synapse-network";
import { HttpAnalyticsGateway, type AnalyticsGateway } from "./analytics.gateway";
import {
  HttpExecutiveDashboardGateway,
  type ExecutiveDashboardGateway,
} from "./executive-dashboard.gateway";
import { HttpProfessionalsGateway, type ProfessionalsGateway } from "./professionals.gateway";
import { HttpAssessmentGateway, type AssessmentGateway } from "./assessment.gateway";
import { HttpAuthGateway, type AuthGateway } from "./auth.gateway";
import { HttpCalibrationGateway, type CalibrationGateway } from "./calibration.gateway";
import { HttpCareerGateway, type CareerGateway } from "./career.gateway";
import { HttpCatalogGateway, type CatalogGateway } from "./catalog.gateway";
import { HttpConfigGateway, type ConfigGateway } from "./config.gateway";
import { HttpCyclesGateway, type CyclesGateway } from "./cycles.gateway";
import { HttpDevelopmentGateway, type DevelopmentGateway } from "./development.gateway";
import { HttpEvolutionGateway, type EvolutionGateway } from "./evolution.gateway";
import { HttpLearningGateway, type LearningGateway } from "./learning.gateway";
import { HttpMentoringGateway, type MentoringGateway } from "./mentoring.gateway";
import { HttpNoticesGateway, type NoticesGateway } from "./notices.gateway";
import {
  HttpPersonAssistantsGateway,
  type PersonAssistantsGateway,
} from "./person-assistants.gateway";
import { HttpReportsGateway, type ReportsGateway } from "./reports.gateway";
import { HttpStateContextsGateway, type StateContextsGateway } from "./state-contexts.gateway";
import { HttpTeamAllocationGateway, type TeamAllocationGateway } from "./team-allocation.gateway";
import { HttpTeamRosterGateway, type TeamRosterGateway } from "./team-roster.gateway";
import {
  HttpTeamTransitionsGateway,
  type TeamTransitionsGateway,
} from "./team-transitions.gateway";
import { HttpTeamsGateway, type TeamsGateway } from "./teams.gateway";
import { HttpTeamTransfersGateway, type TeamTransfersGateway } from "./team-transfers.gateway";
import { HttpWorkAssistantsGateway, type WorkAssistantsGateway } from "./work-assistants.gateway";

interface FrontendConfig {
  baseUrl?: string;
}

export class FrontendContainer {
  readonly sessionPolicy: SessionPolicy;
  /** O passe de suporte desta sessão do navegador ([FA-07]) — apagado ao fechar a sessão. */
  readonly supportAccess: SupportAccess;
  /**
   * O ÚNICO canal da aplicação para a rede de sinapses do fundo (dono,
   * 2026-09-08). A casca (`AppShell`) desenha a rede que o lê. Ninguém
   * DENTRO da aplicação logada pulsa por aqui: a rede fica viva pelo
   * movimento próprio dos nós, sem piscada por resultado. Um por container,
   * nunca por tela.
   */
  readonly synapseSignals: SynapseSignals;
  /**
   * A ABA DAS MÉTRICAS DA PLATAFORMA (dono, 2026-09-08). Mora aqui pela mesma
   * razão dos sinais: quem RESERVA a aba é o clique no menu e quem a NAVEGA é
   * a tela de transição — duas telas, um punho só. Uma por container.
   */
  readonly platformMetricsTab: MetricsTab;
  readonly apiClient: ApiClient;
  readonly analyticsGateway: AnalyticsGateway;
  readonly executiveDashboardGateway: ExecutiveDashboardGateway;
  readonly professionalsGateway: ProfessionalsGateway;
  readonly assessmentGateway: AssessmentGateway;
  readonly authGateway: AuthGateway;
  readonly calibrationGateway: CalibrationGateway;
  readonly careerGateway: CareerGateway;
  readonly catalogGateway: CatalogGateway;
  readonly configGateway: ConfigGateway;
  readonly cyclesGateway: CyclesGateway;
  readonly developmentGateway: DevelopmentGateway;
  readonly evolutionGateway: EvolutionGateway;
  readonly learningGateway: LearningGateway;
  readonly mentoringGateway: MentoringGateway;
  readonly noticesGateway: NoticesGateway;
  readonly personAssistantsGateway: PersonAssistantsGateway;
  readonly reportsGateway: ReportsGateway;
  readonly stateContextsGateway: StateContextsGateway;
  readonly teamAllocationGateway: TeamAllocationGateway;
  readonly teamRosterGateway: TeamRosterGateway;
  readonly teamsGateway: TeamsGateway;
  readonly teamTransitionsGateway: TeamTransitionsGateway;
  readonly teamTransfersGateway: TeamTransfersGateway;
  readonly workAssistantsGateway: WorkAssistantsGateway;

  private constructor(config: FrontendConfig) {
    this.sessionPolicy = new SessionPolicy();
    this.supportAccess = new SupportAccess();
    this.synapseSignals = new SynapseSignals();
    this.platformMetricsTab = new MetricsTab();
    this.apiClient = new ApiClient(
      config.baseUrl,
      (error) => {
        this.sessionPolicy.reviewFailure(error);
        this.supportAccess.reviewFailure(error);
      },
      (resource) => this.supportAccess.headersFor(resource),
    );
    this.analyticsGateway = new HttpAnalyticsGateway(this.apiClient);
    this.executiveDashboardGateway = new HttpExecutiveDashboardGateway(this.apiClient);
    this.professionalsGateway = new HttpProfessionalsGateway(this.apiClient);
    this.assessmentGateway = new HttpAssessmentGateway(this.apiClient);
    this.authGateway = new HttpAuthGateway(this.apiClient);
    this.calibrationGateway = new HttpCalibrationGateway(this.apiClient);
    this.careerGateway = new HttpCareerGateway(this.apiClient);
    this.catalogGateway = new HttpCatalogGateway(this.apiClient);
    this.configGateway = new HttpConfigGateway(this.apiClient);
    this.cyclesGateway = new HttpCyclesGateway(this.apiClient);
    this.developmentGateway = new HttpDevelopmentGateway(this.apiClient);
    this.evolutionGateway = new HttpEvolutionGateway(this.apiClient);
    this.learningGateway = new HttpLearningGateway(this.apiClient);
    this.mentoringGateway = new HttpMentoringGateway(this.apiClient);
    this.noticesGateway = new HttpNoticesGateway(this.apiClient);
    this.personAssistantsGateway = new HttpPersonAssistantsGateway(this.apiClient);
    this.reportsGateway = new HttpReportsGateway(this.apiClient);
    this.stateContextsGateway = new HttpStateContextsGateway(config.baseUrl, (error) =>
      this.sessionPolicy.reviewFailure(error),
    );
    this.teamAllocationGateway = new HttpTeamAllocationGateway(this.apiClient);
    this.teamRosterGateway = new HttpTeamRosterGateway(this.apiClient);
    this.teamsGateway = new HttpTeamsGateway(this.apiClient);
    this.teamTransitionsGateway = new HttpTeamTransitionsGateway(this.apiClient);
    this.teamTransfersGateway = new HttpTeamTransfersGateway(this.apiClient);
    this.workAssistantsGateway = new HttpWorkAssistantsGateway(this.apiClient);
  }

  static create(config: FrontendConfig = {}): FrontendContainer {
    return new FrontendContainer(config);
  }
}

export const defaultContainer = FrontendContainer.create();
