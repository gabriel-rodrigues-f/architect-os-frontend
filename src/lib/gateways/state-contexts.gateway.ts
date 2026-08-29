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
  architectsResponseSchema,
  assessmentsResponseSchema,
  capabilitiesResponseSchema,
  competenciesResponseSchema,
  cyclesResponseSchema,
  evidencesResponseSchema,
  learningPathsResponseSchema,
  mentoringSessionsResponseSchema,
  plansResponseSchema,
} from "../api-schemas";
import type {
  Architect,
  Assessment,
  Capability,
  Competency,
  DevelopmentCycle,
  DevelopmentPlan,
  Evidence,
  LearningPath,
  MentoringSession,
} from "../domain";

export interface ArchitectScopedFilter {
  architectId?: string | undefined;
}

export interface StateContextsGateway {
  listArchitects(): Promise<Architect[]>;
  listAssessments(filter?: ArchitectScopedFilter): Promise<Assessment[]>;
  listCapabilities(): Promise<Capability[]>;
  listCompetencies(): Promise<Competency[]>;
  listCycles(): Promise<DevelopmentCycle[]>;
  activeCycle(): Promise<{ cycleId: string }>;
  listPlans(filter?: ArchitectScopedFilter): Promise<DevelopmentPlan[]>;
  listLearningPaths(filter?: ArchitectScopedFilter): Promise<LearningPath[]>;
  listMentoringSessions(filter?: ArchitectScopedFilter): Promise<MentoringSession[]>;
  listEvidences(filter?: ArchitectScopedFilter): Promise<Evidence[]>;
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
    fallbackMessage: string,
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
        fallbackMessage,
      );
      this.interceptFailure(failure);
      throw failure;
    }
    const body = result.data;
    const envelope = asSuccessEnvelope(body);
    return schema.parse(envelope ? envelope.data : body) as z.infer<Schema>;
  }

  private architectQuery(filter: ArchitectScopedFilter | undefined) {
    return filter?.architectId ? { params: { query: { architectId: filter.architectId } } } : {};
  }

  listArchitects = (): Promise<Architect[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/architects"),
      architectsResponseSchema,
      "GET /api/v1/architects falhou",
    ) as Promise<Architect[]>;

  listAssessments = (filter?: ArchitectScopedFilter): Promise<Assessment[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/assessments", this.architectQuery(filter) as never),
      assessmentsResponseSchema,
      "GET /api/v1/assessments falhou",
    ) as Promise<Assessment[]>;

  listCapabilities = (): Promise<Capability[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/capabilities"),
      capabilitiesResponseSchema,
      "GET /api/v1/capabilities falhou",
    );

  listCompetencies = (): Promise<Competency[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/competencies"),
      competenciesResponseSchema,
      "GET /api/v1/competencies falhou",
    );

  listCycles = (): Promise<DevelopmentCycle[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/cycles"),
      cyclesResponseSchema,
      "GET /api/v1/cycles falhou",
    );

  activeCycle = (): Promise<{ cycleId: string }> =>
    this.reading(
      () => this.contract.GET("/api/v1/settings/active-cycle"),
      activeCycleResponseSchema,
      "GET /api/v1/settings/active-cycle falhou",
    );

  listPlans = (filter?: ArchitectScopedFilter): Promise<DevelopmentPlan[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/plans", this.architectQuery(filter)),
      plansResponseSchema,
      "GET /api/v1/plans falhou",
    ) as Promise<DevelopmentPlan[]>;

  listLearningPaths = (filter?: ArchitectScopedFilter): Promise<LearningPath[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/learning-paths", this.architectQuery(filter)),
      learningPathsResponseSchema,
      "GET /api/v1/learning-paths falhou",
    ) as Promise<LearningPath[]>;

  listMentoringSessions = (filter?: ArchitectScopedFilter): Promise<MentoringSession[]> =>
    this.reading(
      () =>
        this.contract.GET(
          "/api/v1/mentoring-sessions",
          filter?.architectId ? { params: { query: { menteeId: filter.architectId } } } : {},
        ),
      mentoringSessionsResponseSchema,
      "GET /api/v1/mentoring-sessions falhou",
    ) as Promise<MentoringSession[]>;

  listEvidences = (filter?: ArchitectScopedFilter): Promise<Evidence[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/evidences", this.architectQuery(filter)),
      evidencesResponseSchema,
      "GET /api/v1/evidences falhou",
    ) as Promise<Evidence[]>;
}
