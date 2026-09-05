import { useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";

import { api, type AppState } from "./api";
import { CycleActivation, type CycleSelectionState } from "./cycle-activation";
import type { DevelopmentCycle } from "./domain";
import type { MutationCache } from "./mutation-runner";
import { MutationRunner } from "./mutation-runner";
import { emptyState } from "./selectors";
import {
  stateContextCatalog,
  type StateContextName,
  type StateContextRequest,
} from "./state-contexts";
import {
  buildApi,
  ConnectionError,
  LoadingState,
  MUTATION_FALLBACK_ERROR_MESSAGE,
  StoreApiContext,
} from "./store";

export type ContextScopeRequest = StateContextName | StateContextRequest;

/**
 * As fatias que `useSelectors` INDEXA no construtor (`Selectors` em
 * `selectors.ts`): toda tela que usa seletores pede pelo menos estas — pedir
 * menos é ler fatia não pedida (a catraca de `state-contexts.ts` lança).
 */
export const SELECTOR_CONTEXTS: readonly ContextScopeRequest[] = [
  "architects",
  "assessments",
  "capabilities",
  "competencies",
  "plans",
  "activeCycle",
];

/**
 * A ficha de carreira (perfil, evolução, roadmap, declaração) lê a pessoa
 * inteira e os catálogos; o que é POR PESSOA vem recortado pelo servidor.
 * Estava copiada no perfil; virou uma só quando as outras três abas foram
 * estranguladas.
 */
export class ContextScopes {
  static careerFileOf(architectId: string): readonly ContextScopeRequest[] {
    return [
      "architects",
      "capabilities",
      "competencies",
      "cycles",
      "activeCycle",
      { name: "assessments", architectId },
      { name: "plans", architectId },
      { name: "evidences", architectId },
      { name: "mentoringSessions", architectId },
      { name: "learningPaths", architectId },
    ];
  }

  static normalize(request: ContextScopeRequest): StateContextRequest {
    return typeof request === "string" ? { name: request } : request;
  }
}

class ContextScopeCache implements MutationCache<AppState> {
  constructor(
    private readonly requests: readonly StateContextRequest[],
    private readonly queryClient: QueryClient,
  ) {}

  update(mutate: (state: AppState) => AppState): void {
    const slices = this.requests.map((request) =>
      this.queryClient.getQueryData(stateContextCatalog.queryKeyOf(request)),
    );
    if (slices.some((slice) => slice === undefined)) {
      this.invalidate();
      return;
    }
    const next = mutate(stateContextCatalog.assemble(emptyState, this.requests, slices));
    for (const request of this.requests) {
      this.queryClient.setQueryData(
        stateContextCatalog.queryKeyOf(request),
        stateContextCatalog.sliceOf(request.name, next),
      );
    }
  }

  invalidate(): void {
    void stateContextCatalog.invalidateAll(this.queryClient);
  }
}

export function ContextScope({
  contexts,
  children,
}: {
  contexts: readonly ContextScopeRequest[];
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const requests = contexts.map(ContextScopes.normalize);
  const results = useQueries({
    queries: requests.map((request) => stateContextCatalog.queryOptionsOf(request)),
  });

  const failedIndex = results.findIndex((result) => result.isError);
  const failed = results[failedIndex];
  const failedRequest = requests[failedIndex];
  const pending = results.some((result) => result.isPending);
  const state =
    pending || failed
      ? null
      : stateContextCatalog.assemble(
          emptyState,
          requests,
          results.map((result) => result.data),
        );

  const revision = results.map((result) => result.dataUpdatedAt).join("|");
  const contextsKey = requests.map((request) => JSON.stringify(request)).join("|");
  const value = useMemo(
    () =>
      state === null
        ? null
        : buildApi(state, queryClient, new ContextScopeCache(requests, queryClient)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `revision`/`contextsKey` resumem `state`/`requests`, cujas identidades mudam a cada render.
    [revision, contextsKey, pending, queryClient],
  );

  if (failed && failedRequest)
    return (
      <ConnectionError
        error={failed.error}
        onRetry={() => void failed.refetch()}
        resource={failedRequest.name}
      />
    );
  if (value === null) return <LoadingState />;

  return <StoreApiContext.Provider value={value}>{children}</StoreApiContext.Provider>;
}

export interface CycleSelection {
  cycles: DevelopmentCycle[];
  activeCycleId: string;
  setActiveCycle: (cycleId: string) => void;
}

const CYCLES_REQUEST: StateContextRequest = { name: "cycles" };
const ACTIVE_CYCLE_REQUEST: StateContextRequest = { name: "activeCycle" };

class CycleSelectionCache implements MutationCache<CycleSelectionState> {
  private readonly cyclesKey = stateContextCatalog.queryKeyOf(CYCLES_REQUEST);
  private readonly activeCycleKey = stateContextCatalog.queryKeyOf(ACTIVE_CYCLE_REQUEST);

  constructor(private readonly queryClient: QueryClient) {}

  update(mutate: (state: CycleSelectionState) => CycleSelectionState): void {
    const cycles = this.queryClient.getQueryData<DevelopmentCycle[]>(this.cyclesKey);
    const active = this.queryClient.getQueryData<{ cycleId: string }>(this.activeCycleKey);
    if (cycles === undefined || active === undefined) {
      this.invalidateSlices();
      return;
    }
    const next = mutate({ cycles, activeCycleId: active.cycleId });
    this.queryClient.setQueryData(this.cyclesKey, next.cycles);
    this.queryClient.setQueryData(this.activeCycleKey, { cycleId: next.activeCycleId });
  }

  invalidate(): void {
    this.invalidateSlices();
  }

  private invalidateSlices(): void {
    void this.queryClient.invalidateQueries({ queryKey: this.cyclesKey });
    void this.queryClient.invalidateQueries({ queryKey: this.activeCycleKey });
  }
}

export function useCycleSelection(): CycleSelection {
  const queryClient = useQueryClient();
  const cyclesQuery = useQuery(stateContextCatalog.queryOptionsOf(CYCLES_REQUEST));
  const activeQuery = useQuery(stateContextCatalog.queryOptionsOf(ACTIVE_CYCLE_REQUEST));

  const runner = useMemo(
    () =>
      new MutationRunner<CycleSelectionState>(
        new CycleSelectionCache(queryClient),
        (message) => toast.error(message),
        MUTATION_FALLBACK_ERROR_MESSAGE,
      ),
    [queryClient],
  );

  return {
    cycles: (cyclesQuery.data as DevelopmentCycle[] | undefined) ?? [],
    activeCycleId: (activeQuery.data as { cycleId: string } | undefined)?.cycleId ?? "",
    setActiveCycle: (cycleId) => {
      const activation = CycleActivation.of(cycleId);
      runner.optimistic(
        (state) => activation.appliedTo(state),
        () => api.setActiveCycle(cycleId),
      );
    },
  };
}
