import { useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";

import { api, type AppState } from "./api";
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
  STATE_QUERY_KEY,
  StoreApiContext,
} from "./store";

export type ContextScopeRequest = StateContextName | StateContextRequest;

const normalizeRequest = (request: ContextScopeRequest): StateContextRequest =>
  typeof request === "string" ? { name: request } : request;

class ContextScopeCache implements MutationCache<AppState> {
  constructor(
    private readonly requests: readonly StateContextRequest[],
    private readonly queryClient: QueryClient,
  ) {}

  update(mutate: (state: AppState) => AppState): void {
    this.queryClient.setQueryData<AppState>(STATE_QUERY_KEY, (prev) =>
      prev ? mutate(prev) : prev,
    );
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
    void this.queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY });
    for (const request of this.requests) {
      void this.queryClient.invalidateQueries({
        queryKey: stateContextCatalog.queryKeyOf(request),
      });
    }
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
  const requests = contexts.map(normalizeRequest);
  const results = useQueries({
    queries: requests.map((request) => stateContextCatalog.queryOptionsOf(request)),
  });

  const failed = results.find((result) => result.isError);
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

  if (failed) return <ConnectionError error={failed.error} onRetry={() => void failed.refetch()} />;
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

export function useCycleSelection(): CycleSelection {
  const queryClient = useQueryClient();
  const cyclesQuery = useQuery(stateContextCatalog.queryOptionsOf(CYCLES_REQUEST));
  const activeQuery = useQuery(stateContextCatalog.queryOptionsOf(ACTIVE_CYCLE_REQUEST));

  const runner = useMemo(
    () =>
      new MutationRunner<string>(
        {
          update: (mutate) => {
            queryClient.setQueryData<{ cycleId: string }>(
              stateContextCatalog.queryKeyOf(ACTIVE_CYCLE_REQUEST),
              (prev) => ({ cycleId: mutate(prev?.cycleId ?? "") }),
            );
            queryClient.setQueryData<AppState>(STATE_QUERY_KEY, (prev) =>
              prev ? { ...prev, activeCycleId: mutate(prev.activeCycleId) } : prev,
            );
          },
          invalidate: () => {
            void queryClient.invalidateQueries({
              queryKey: stateContextCatalog.queryKeyOf(ACTIVE_CYCLE_REQUEST),
            });
            void queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY });
          },
        },
        (message) => toast.error(message),
        MUTATION_FALLBACK_ERROR_MESSAGE,
      ),
    [queryClient],
  );

  return {
    cycles: (cyclesQuery.data as DevelopmentCycle[] | undefined) ?? [],
    activeCycleId: (activeQuery.data as { cycleId: string } | undefined)?.cycleId ?? "",
    setActiveCycle: (cycleId) => {
      runner.optimistic(
        () => cycleId,
        () => api.setActiveCycle(cycleId),
      );
    },
  };
}
