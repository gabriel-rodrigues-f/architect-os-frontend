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

  private architectQuery(filter: ArchitectScopedFilter | undefined) {
    return filter?.architectId ? { params: { query: { architectId: filter.architectId } } } : {};
  }

  listArchitects = (): Promise<Architect[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/architects"),
      architectsResponseSchema,
    ) as Promise<Architect[]>;

  listAssessments = (filter?: ArchitectScopedFilter): Promise<Assessment[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/assessments", this.architectQuery(filter) as never),
      assessmentsResponseSchema,
    ) as Promise<Assessment[]>;

  listCapabilities = (): Promise<Capability[]> =>
    this.reading(() => this.contract.GET("/api/v1/capabilities"), capabilitiesResponseSchema);

  listCompetencies = (): Promise<Competency[]> =>
    this.reading(() => this.contract.GET("/api/v1/competencies"), competenciesResponseSchema);

  listCycles = (): Promise<DevelopmentCycle[]> =>
    this.reading(() => this.contract.GET("/api/v1/cycles"), cyclesResponseSchema);

  activeCycle = (): Promise<{ cycleId: string }> =>
    this.reading(
      () => this.contract.GET("/api/v1/settings/active-cycle"),
      activeCycleResponseSchema,
    );

  listPlans = (filter?: ArchitectScopedFilter): Promise<DevelopmentPlan[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/plans", this.architectQuery(filter)),
      plansResponseSchema,
    ) as Promise<DevelopmentPlan[]>;

  listLearningPaths = (filter?: ArchitectScopedFilter): Promise<LearningPath[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/learning-paths", this.architectQuery(filter)),
      learningPathsResponseSchema,
    ) as Promise<LearningPath[]>;

  listMentoringSessions = (filter?: ArchitectScopedFilter): Promise<MentoringSession[]> =>
    this.reading(
      () =>
        this.contract.GET(
          "/api/v1/mentoring-sessions",
          filter?.architectId ? { params: { query: { menteeId: filter.architectId } } } : {},
        ),
      mentoringSessionsResponseSchema,
    ) as Promise<MentoringSession[]>;

  listEvidences = (filter?: ArchitectScopedFilter): Promise<Evidence[]> =>
    this.reading(
      () => this.contract.GET("/api/v1/evidences", this.architectQuery(filter)),
      evidencesResponseSchema,
    ) as Promise<Evidence[]>;
}
