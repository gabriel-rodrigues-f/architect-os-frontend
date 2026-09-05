import type { QueryClient } from "@tanstack/react-query";

import { stateContextsApi, type AppState } from "./api";

const STATE_CONTEXT_NAMES = [
  "architects",
  "assessments",
  "capabilities",
  "competencies",
  "cycles",
  "teamLevelRules",
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

const CONTEXT_STALE_TIME = 30_000;

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
  teamLevelRules: {
    fetchSlice: () => stateContextsApi.listTeamLevelRules(),
    mergeInto: (state, slice) => ({
      ...state,
      teamLevelRules: slice as AppState["teamLevelRules"],
    }),
    sliceOf: (state) => state.teamLevelRules,
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

/**
 * ADR-0011, fase final — a fatia que a tela NÃO pediu não se lê. Enquanto o
 * blob `/state` existia, uma tela que esquecesse uma fatia caía no vazio em
 * silêncio ("Nenhum arquiteto cadastrado" com o banco cheio). Agora, em
 * desenvolvimento e em teste, ler uma fatia não pedida lança — com o nome da
 * fatia e a instrução. Em produção o vazio continua sendo vazio: uma tela
 * incompleta é defeito, não indisponibilidade.
 */
export class UnrequestedStateContextError extends Error {
  constructor(readonly context: StateContextName) {
    super(
      `A tela leu a fatia "${context}" sem pedi-la — inclua "${context}" no ContextScope da rota.`,
    );
    this.name = "UnrequestedStateContextError";
  }
}

export class UnrequestedSlice {
  private static readonly marks = new WeakSet<object>();

  static readonly strict = import.meta.env.DEV || import.meta.env.MODE === "test";

  static of(context: StateContextName): unknown[] {
    if (!UnrequestedSlice.strict) return [];
    const trap = () => {
      throw new UnrequestedStateContextError(context);
    };
    const slice = new Proxy<unknown[]>([], { get: trap, has: trap, ownKeys: trap });
    UnrequestedSlice.marks.add(slice);
    return slice;
  }

  static is(value: unknown): boolean {
    return typeof value === "object" && value !== null && UnrequestedSlice.marks.has(value);
  }
}

class StateContextCatalog {
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
      // R2-TEC-19 — recuperar o foco da janela não refaz a leitura; quem
      // precisa de dado novo invalida explicitamente (`invalidateAll`).
      refetchOnWindowFocus: false,
    };
  }

  /**
   * Toda escrita que muda contagem, status ou vínculo no servidor invalida
   * TODAS as fatias montadas — é o que a invalidação do blob fazia com uma
   * chave só. A chave-prefixo cobre as fatias recortadas por pessoa também.
   */
  invalidateAll(queryClient: QueryClient): Promise<void> {
    return queryClient.invalidateQueries({ queryKey: ["state-context"] });
  }

  sliceOf(name: StateContextName, state: AppState): unknown {
    return definitions[name].sliceOf(state);
  }

  assemble(
    base: AppState,
    requests: readonly StateContextRequest[],
    slices: readonly unknown[],
  ): AppState {
    const requested = new Set(requests.map((request) => request.name));
    const guarded = STATE_CONTEXT_NAMES.filter(
      (name) => name !== "activeCycle" && !requested.has(name),
    ).reduce((state, name) => definitions[name].mergeInto(state, UnrequestedSlice.of(name)), base);
    return requests.reduce(
      (state, request, index) => definitions[request.name].mergeInto(state, slices[index]),
      guarded,
    );
  }
}

export const stateContextCatalog = new StateContextCatalog();
