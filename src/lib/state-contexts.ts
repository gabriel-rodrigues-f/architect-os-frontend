import { stateContextsApi, type AppState } from "./api";

export const STATE_CONTEXT_NAMES = [
  "architects",
  "assessments",
  "capabilities",
  "competencies",
  "cycles",
  "activeCycle",
  "plans",
  "learningPaths",
  "mentoringSessions",
  "evidences",
] as const;

export type StateContextName = (typeof STATE_CONTEXT_NAMES)[number];

export interface StateContextRequest {
  name: StateContextName;
  architectId?: string | undefined;
}

export const CONTEXT_STALE_TIME = 30_000;

interface StateContextDefinition {
  fetchSlice: (filter: { architectId?: string | undefined }) => Promise<unknown>;
  mergeInto: (state: AppState, slice: unknown) => AppState;
  sliceOf: (state: AppState) => unknown;
}

const definitions: Record<StateContextName, StateContextDefinition> = {
  architects: {
    fetchSlice: () => stateContextsApi.listArchitects(),
    mergeInto: (state, slice) => ({ ...state, architects: slice as AppState["architects"] }),
    sliceOf: (state) => state.architects,
  },
  assessments: {
    fetchSlice: (filter) => stateContextsApi.listAssessments(filter),
    mergeInto: (state, slice) => ({ ...state, assessments: slice as AppState["assessments"] }),
    sliceOf: (state) => state.assessments,
  },
  capabilities: {
    fetchSlice: () => stateContextsApi.listCapabilities(),
    mergeInto: (state, slice) => ({ ...state, capabilities: slice as AppState["capabilities"] }),
    sliceOf: (state) => state.capabilities,
  },
  competencies: {
    fetchSlice: () => stateContextsApi.listCompetencies(),
    mergeInto: (state, slice) => ({ ...state, competencies: slice as AppState["competencies"] }),
    sliceOf: (state) => state.competencies,
  },
  cycles: {
    fetchSlice: () => stateContextsApi.listCycles(),
    mergeInto: (state, slice) => ({ ...state, cycles: slice as AppState["cycles"] }),
    sliceOf: (state) => state.cycles,
  },
  activeCycle: {
    fetchSlice: () => stateContextsApi.activeCycle(),
    mergeInto: (state, slice) => ({
      ...state,
      activeCycleId: (slice as { cycleId: string }).cycleId,
    }),
    sliceOf: (state) => ({ cycleId: state.activeCycleId }),
  },
  plans: {
    fetchSlice: (filter) => stateContextsApi.listPlans(filter),
    mergeInto: (state, slice) => ({ ...state, plans: slice as AppState["plans"] }),
    sliceOf: (state) => state.plans,
  },
  learningPaths: {
    fetchSlice: (filter) => stateContextsApi.listLearningPaths(filter),
    mergeInto: (state, slice) => ({ ...state, learningPaths: slice as AppState["learningPaths"] }),
    sliceOf: (state) => state.learningPaths,
  },
  mentoringSessions: {
    fetchSlice: (filter) => stateContextsApi.listMentoringSessions(filter),
    mergeInto: (state, slice) => ({
      ...state,
      mentoringSessions: slice as AppState["mentoringSessions"],
    }),
    sliceOf: (state) => state.mentoringSessions,
  },
  evidences: {
    fetchSlice: (filter) => stateContextsApi.listEvidences(filter),
    mergeInto: (state, slice) => ({ ...state, evidences: slice as AppState["evidences"] }),
    sliceOf: (state) => state.evidences,
  },
};

export class StateContextCatalog {
  queryKeyOf(request: StateContextRequest): readonly unknown[] {
    return request.architectId
      ? (["state-context", request.name, { architectId: request.architectId }] as const)
      : (["state-context", request.name] as const);
  }

  queryOptionsOf(request: StateContextRequest) {
    const definition = definitions[request.name];
    return {
      queryKey: this.queryKeyOf(request),
      queryFn: () => definition.fetchSlice({ architectId: request.architectId }),
      staleTime: CONTEXT_STALE_TIME,
      retry: 1,
      enabled: typeof window !== "undefined",
    };
  }

  sliceOf(name: StateContextName, state: AppState): unknown {
    return definitions[name].sliceOf(state);
  }

  assemble(
    base: AppState,
    requests: readonly StateContextRequest[],
    slices: readonly unknown[],
  ): AppState {
    return requests.reduce(
      (state, request, index) => definitions[request.name].mergeInto(state, slices[index]),
      base,
    );
  }
}

export const stateContextCatalog = new StateContextCatalog();

export class StranglerLedger {
  private readonly exactPaths: ReadonlySet<string>;
  private readonly patterns: readonly RegExp[];

  constructor(exactPaths: readonly string[], patterns: readonly RegExp[]) {
    this.exactPaths = new Set(exactPaths);
    this.patterns = patterns;
  }

  isStrangled(pathname: string): boolean {
    const normalized =
      pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
    if (this.exactPaths.has(normalized)) return true;
    return this.patterns.some((pattern) => pattern.test(normalized));
  }
}

export const defaultStranglerLedger = new StranglerLedger(
  ["/", "/team"],
  [/^\/architects\/[^/]+$/],
);
