import createClient from "openapi-fetch";
import type { z } from "zod";

import type { paths } from "../api-contract.gen";
import {
  API_URL,
  apiFailureOf,
  asSuccessEnvelope,
  networkUnavailableError,
  type ApiErrorBody,
  type ApiFailureInterceptor,
} from "../api-client";
import {
  activeCycleResponseSchema,
  professionalsResponseSchema,
  assessmentsResponseSchema,
  capabilitiesResponseSchema,
  competenciesResponseSchema,
  cyclesResponseSchema,
  evidencesResponseSchema,
  learningPathsResponseSchema,
  mentoringSessionsResponseSchema,
  plansResponseSchema,
  teamLevelRulesResponseSchema,
} from "../api-schemas";
import type {
  Professional,
  Assessment,
  Capability,
  Competency,
  DevelopmentCycle,
  DevelopmentPlan,
  Evidence,
  LearningPath,
  MentoringSession,
  TeamLevelRule,
} from "../domain";

export interface ProfessionalScopedFilter {
  professionalId?: string | undefined;
}

export interface StateContextsGateway {
  listProfessionals(): Promise<Professional[]>;
  listAssessments(filter?: ProfessionalScopedFilter): Promise<Assessment[]>;
  listCapabilities(): Promise<Capability[]>;
  listCompetencies(): Promise<Competency[]>;
  listCycles(): Promise<DevelopmentCycle[]>;
  listTeamLevelRules(): Promise<TeamLevelRule[]>;
  activeCycle(): Promise<{ cycleId: string }>;
  listPlans(filter?: ProfessionalScopedFilter): Promise<DevelopmentPlan[]>;
  listLearningPaths(filter?: ProfessionalScopedFilter): Promise<LearningPath[]>;
  listMentoringSessions(filter?: ProfessionalScopedFilter): Promise<MentoringSession[]>;
  listEvidences(filter?: ProfessionalScopedFilter): Promise<Evidence[]>;
}

interface ContractResult {
  data?: unknown;
  error?: unknown;
  response: Response;
}

export class HttpStateContextsGateway implements StateContextsGateway {
  private readonly contract: ReturnType<typeof createClient<paths>>;

  constructor(
    baseUrl: string = API_URL,
    private readonly interceptFailure: ApiFailureInterceptor = () => {},
  ) {
    this.contract = createClient<paths>({
      baseUrl,
      credentials: "include",
      fetch: (input) => globalThis.fetch(input),
    });
  }

  private async reading<Schema extends z.ZodTypeAny>(
    call: () => Promise<ContractResult>,
    schema: Schema,
  ): Promise<z.infer<Schema>> {
    let result: ContractResult;
    try {
      result = await call();
    } catch (cause) {
      const failure = networkUnavailableError(cause);
      this.interceptFailure(failure);
      throw failure;
    }
    if (!result.response.ok) {
      const failure = apiFailureOf(
        (result.error ?? null) as ApiErrorBody | null,
        result.response.status,
      );
      this.interceptFailure(failure);
      throw failure;
    }
    const body = result.data;
    const envelope = asSuccessEnvelope(body);
    return schema.parse(envelope ? envelope.data : body) as z.infer<Schema>;
  }

  private professionalQuery(filter: ProfessionalScopedFilter | undefined) {
    return filter?.professionalId
      ? { params: { query: { professionalId: filter.professionalId } } }
      : {};
  }

  listProfessionals = (): Promise<Professional[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/professionals"),
      professionalsResponseSchema,
    ) as Promise<Professional[]>;

  listAssessments = (filter?: ProfessionalScopedFilter): Promise<Assessment[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/assessments", this.professionalQuery(filter) as never),
      assessmentsResponseSchema,
    ) as Promise<Assessment[]>;

  listCapabilities = (): Promise<Capability[]> =>
    this.reading(() => this.contract.GET("/api/v1/capabilities"), capabilitiesResponseSchema);

  listCompetencies = (): Promise<Competency[]> =>
    this.reading(() => this.contract.GET("/api/v1/competencies"), competenciesResponseSchema);

  listCycles = (): Promise<DevelopmentCycle[]> =>
    this.reading(() => this.contract.GET("/api/v1/cycles"), cyclesResponseSchema);

  listTeamLevelRules = (): Promise<TeamLevelRule[]> =>
    this.reading(() => this.contract.GET("/api/v1/team-rules"), teamLevelRulesResponseSchema);

  activeCycle = (): Promise<{ cycleId: string }> =>
    this.reading(
      () => this.contract.GET("/api/v1/settings/active-cycle"),
      activeCycleResponseSchema,
    );

  listPlans = (filter?: ProfessionalScopedFilter): Promise<DevelopmentPlan[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/plans", this.professionalQuery(filter)),
      plansResponseSchema,
    ) as Promise<DevelopmentPlan[]>;

  listLearningPaths = (filter?: ProfessionalScopedFilter): Promise<LearningPath[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/learning-paths", this.professionalQuery(filter)),
      learningPathsResponseSchema,
    ) as Promise<LearningPath[]>;

  listMentoringSessions = (filter?: ProfessionalScopedFilter): Promise<MentoringSession[]> =>
    this.reading(
      () =>
        this.contract.GET(
          "/api/v1/mentoring-sessions",
          filter?.professionalId ? { params: { query: { menteeId: filter.professionalId } } } : {},
        ),
      mentoringSessionsResponseSchema,
    ) as Promise<MentoringSession[]>;

  listEvidences = (filter?: ProfessionalScopedFilter): Promise<Evidence[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/evidences", this.professionalQuery(filter)),
      evidencesResponseSchema,
    ) as Promise<Evidence[]>;
}
