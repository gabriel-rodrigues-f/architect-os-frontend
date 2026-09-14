import { useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";

import { api, type AppState } from "./api";
import { CycleActivation, type CycleSelectionState } from "./cycle-activation";
import { CyclePreference } from "./cycle-preference";
import { useAuth } from "./auth";
import { useI18n } from "./i18n";
import type { DevelopmentCycle } from "./domain";
import type { MutationCache } from "./mutation-runner";
import { MutationRunner } from "./mutation-runner";
import { MutationRefusal } from "./refusal-phrase";
import { emptyState } from "./selectors";
import {
  stateContextCatalog,
  type StateContextName,
  type StateContextRequest,
} from "./state-contexts";
import { buildApi, ConnectionError, LoadingState, StoreApiContext } from "./store";

export type ContextScopeRequest = StateContextName | StateContextRequest;

/**
 * As fatias que `useSelectors` INDEXA no construtor (`Selectors` em
 * `selectors.ts`): toda tela que usa seletores pede pelo menos estas — pedir
 * menos é ler fatia não pedida (a catraca de `state-contexts.ts` lança).
 */
export const SELECTOR_CONTEXTS: readonly ContextScopeRequest[] = [
  "professionals",
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
  static careerFileOf(professionalId: string): readonly ContextScopeRequest[] {
    return [
      "professionals",
      "capabilities",
      "competencies",
      "cycles",
      "activeCycle",
      { name: "assessments", professionalId },
      { name: "plans", professionalId },
      { name: "mentoringSessions", professionalId },
      { name: "learningPaths", professionalId },
    ];
  }

  static normalize(request: ContextScopeRequest): StateContextRequest {
    return typeof request === "string" ? { name: request } : request;
  }

  /** O estado da tela, com o ciclo em foco resolvido pela escolha da pessoa. */
  static withCycleInFocus(
    state: AppState,
    requests: readonly StateContextRequest[],
    chosen: string | null,
  ): AppState {
    const requested = new Set(requests.map((request) => request.name));
    if (!requested.has("activeCycle")) return state;
    const knownCycleIds = requested.has("cycles")
      ? state.cycles.map((cycle) => cycle.id)
      : undefined;
    return {
      ...state,
      activeCycleId: CyclePreference.resolve(chosen, state.activeCycleId, knownCycleIds),
    };
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

/**
 * A ESCOLHA DE CICLO DA PESSOA, guardada por conta neste navegador (dono,
 * 2026-09-10 — "essa mudança deve valer apenas para o seu perfil"). Mora numa
 * consulta do React Query, e não num `useState`, para que TODAS as telas que
 * leem o ciclo em foco mudem juntas quando o rodapé muda: o rodapé escreve
 * na consulta, e o `ContextScope` de cada tela a lê.
 */
export function useCyclePreference(): { chosen: string | null; choose: (cycleId: string) => void } {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryKey = ["cycle-preference", userId] as const;
  const preference = useMemo(
    () => (userId === null ? null : CyclePreference.forBrowser({ id: userId })),
    [userId],
  );
  const query = useQuery({
    queryKey,
    queryFn: () => preference?.read() ?? "",
    staleTime: Infinity,
    enabled: typeof window !== "undefined",
  });
  const chosen = query.data ?? null;
  return {
    chosen: chosen === "" ? null : chosen,
    choose: (cycleId) => {
      preference?.write(cycleId);
      queryClient.setQueryData(queryKey, cycleId);
    },
  };
}

export function ContextScope({
  contexts,
  children,
}: {
  contexts: readonly ContextScopeRequest[];
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { chosen } = useCyclePreference();
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
      : ContextScopes.withCycleInFocus(
          stateContextCatalog.assemble(
            emptyState,
            requests,
            results.map((result) => result.data),
          ),
          requests,
          chosen,
        );

  const revision = [...results.map((result) => result.dataUpdatedAt), chosen].join("|");
  const contextsKey = requests.map((request) => JSON.stringify(request)).join("|");
  const value = useMemo(
    () =>
      state === null
        ? null
        : buildApi(state, queryClient, new ContextScopeCache(requests, queryClient), (failure) =>
            MutationRefusal.sentenceOf(failure, t),
          ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `revision`/`contextsKey` resumem `state`/`requests`, cujas identidades mudam a cada render.
    [revision, contextsKey, pending, queryClient, t],
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

/** O que o rodapé lê e escreve: o ciclo em foco DA PESSOA, e a lista para escolher. */
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

/**
 * O rodapé: cada perfil escolhe o ciclo que enxerga, e a escolha é dele
 * (dono, 2026-09-10). Nada vai ao servidor — ativar ciclo é `useCycleActivation`.
 */
export function useCycleSelection(): CycleSelection {
  const cyclesQuery = useQuery(stateContextCatalog.queryOptionsOf(CYCLES_REQUEST));
  const activeQuery = useQuery(stateContextCatalog.queryOptionsOf(ACTIVE_CYCLE_REQUEST));
  const { chosen, choose } = useCyclePreference();
  const cycles = (cyclesQuery.data as DevelopmentCycle[] | undefined) ?? [];
  const organizationActiveCycleId =
    (activeQuery.data as { cycleId: string } | undefined)?.cycleId ?? "";

  return {
    cycles,
    activeCycleId: CyclePreference.resolve(
      chosen,
      organizationActiveCycleId,
      cyclesQuery.data === undefined ? undefined : cycles.map((cycle) => cycle.id),
    ),
    setActiveCycle: choose,
  };
}

/**
 * ATIVAR um ciclo é escrita da ORGANIZAÇÃO — fecha o que estava ativo, para
 * todo mundo. Vive em Modelo de Carreira → Ciclos de Avaliação → *Ativar*, e
 * só quem opera o sistema chega lá. É outro gesto, com outro nome e outro
 * lugar que o seletor do rodapé (dono, 2026-09-10).
 */
export function useCycleActivation(): (cycleId: string) => void {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const runner = useMemo(
    () =>
      new MutationRunner<CycleSelectionState>(
        new CycleSelectionCache(queryClient),
        (message) => toast.error(message),
        (failure) => MutationRefusal.sentenceOf(failure, t),
      ),
    [queryClient, t],
  );
  return (cycleId) => {
    const activation = CycleActivation.of(cycleId);
    runner.optimistic(
      (state) => activation.appliedTo(state),
      () => api.setActiveCycle(cycleId),
    );
  };
}
