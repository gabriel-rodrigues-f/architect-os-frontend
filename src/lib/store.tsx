import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { api, ApiError, type AppState, type DevelopmentPhilosophy } from "./api";
import type {
  Architect,
  Assessment,
  Certification,
  Competency,
  CompetencyCategory,
  DevelopmentCycle,
  DevelopmentPlanItem,
  Evidence,
  LearningPath,
  LearningPathItem,
  Level,
  MentoringSession,
  Swot,
} from "./domain";
import { createSelectors, emptyState } from "./selectors";
import { byName } from "./text";

export const STATE_QUERY_KEY = ["app-state"] as const;

/**
 * A store deixou de guardar dados: o estado agora vive no backend (Postgres,
 * com cache em Redis). Este provider mantém a mesma API que as rotas já usavam
 * — leitura direta dos arrays e mutações imperativas — mas por trás cada
 * mutação atualiza o cache do React Query na hora (para a UI não travar em
 * sliders e selects) e envia a alteração para a API. Se a chamada falhar, o
 * snapshot é revalidado e a UI volta para a verdade do servidor.
 */
interface Api extends AppState {
  setActiveCycle: (id: string) => void;
  addArchitect: (a: Architect) => void;
  updateArchitect: (id: string, patch: Partial<Omit<Architect, "id">>) => void;
  removeArchitect: (id: string) => void;
  addCompetency: (c: Competency) => void;
  updateCompetency: (id: string, patch: Partial<Omit<Competency, "id">>) => void;
  removeCompetency: (id: string) => void;
  addCategory: (c: CompetencyCategory) => void;
  updateCategory: (id: string, patch: Partial<Omit<CompetencyCategory, "id">>) => void;
  removeCategory: (id: string) => void;
  addCycle: (c: DevelopmentCycle) => void;
  updateCycle: (id: string, patch: Partial<Omit<DevelopmentCycle, "id">>) => void;
  removeCycle: (id: string) => void;
  openAssessment: (architectId: string, cycleId: string) => Promise<Assessment>;
  setAssessmentStatus: (id: string, status: Assessment["status"]) => void;
  savePhilosophy: (philosophy: DevelopmentPhilosophy) => void;
  updateLearningPath: (
    id: string,
    patch: Partial<
      Pick<LearningPath, "name" | "description" | "competencyIds" | "assignedTo" | "items">
    >,
  ) => void;
  removeLearningPath: (id: string) => void;
  addLearningPathItem: (pathId: string, item: LearningPathItem) => void;
  removeLearningPathItem: (pathId: string, itemId: string) => void;
  updateAssessmentItem: (
    assessmentId: string,
    competencyId: string,
    patch: Partial<{
      self: Level;
      leader: Level;
      target: Level;
      final: Level;
      selfComment: string;
      leaderComment: string;
    }>,
  ) => void;
  updateSwot: (
    architectId: string,
    cycleId: string,
    patch: Partial<Omit<Swot, "architectId" | "cycleId">>,
  ) => void;
  addPlanItem: (architectId: string, item: DevelopmentPlanItem) => void;
  updatePlanItem: (planId: string, itemId: string, patch: Partial<DevelopmentPlanItem>) => void;
  addEvidence: (e: Evidence) => void;
  addCertification: (c: Certification) => void;
  addMentoringSession: (m: MentoringSession) => void;
  updateLearningItem: (pathId: string, itemId: string, progress: number) => void;
  addLearningPath: (p: LearningPath) => void;
  updateKeyResult: (okrId: string, krId: string, progress: number) => void;
  moveNineBox: (
    architectId: string,
    performance: Architect["performance"],
    potential: Architect["potential"],
  ) => void;
}

const Ctx = createContext<Api | null>(null);

function buildApi(state: AppState, queryClient: QueryClient): Api {
  /** Aplica a mudança no cache local imediatamente (resposta otimista). */
  const local = (fn: (s: AppState) => AppState) => {
    queryClient.setQueryData<AppState>(STATE_QUERY_KEY, (prev) => (prev ? fn(prev) : prev));
  };

  /** Dispara a chamada de escrita; em erro, revalida a partir do servidor. */
  const remote = (call: Promise<unknown>) => {
    void call.catch((error: unknown) => {
      if (error instanceof ApiError) console.error(`[api] ${error.status}: ${error.message}`);
      else console.error(error);
      void queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY });
    });
  };

  return {
    ...state,
    categories: [...state.categories].sort(byName),

    setActiveCycle: (id) => {
      local((s) => ({ ...s, activeCycleId: id }));
      remote(api.setActiveCycle(id));
    },

    addArchitect: (a) => {
      local((s) => ({ ...s, architects: [...s.architects, a] }));
      remote(api.createArchitect(a));
    },

    updateArchitect: (id, patch) => {
      local((s) => ({
        ...s,
        architects: s.architects.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }));
      remote(api.updateArchitect(id, patch));
    },

    /** Remover o arquiteto tira junto tudo que dependia dele (cascade no banco). */
    removeArchitect: (id) => {
      local((s) => ({
        ...s,
        architects: s.architects.filter((a) => a.id !== id),
        assessments: s.assessments.filter((a) => a.architectId !== id),
        plans: s.plans.filter((p) => p.architectId !== id),
        okrs: s.okrs.filter((o) => o.architectId !== id),
        swots: s.swots.filter((w) => w.architectId !== id),
        evidences: s.evidences.filter((e) => e.architectId !== id),
        certifications: s.certifications.filter((c) => c.architectId !== id),
        mentoringSessions: s.mentoringSessions.filter((m) => m.menteeId !== id),
        learningPaths: s.learningPaths.map((p) => ({
          ...p,
          assignedTo: p.assignedTo.filter((aid) => aid !== id),
        })),
      }));
      remote(api.deleteArchitect(id));
    },

    addCompetency: (c) => {
      local((s) => ({ ...s, competencies: [...s.competencies, c] }));
      remote(api.createCompetency(c));
    },

    updateCompetency: (id, patch) => {
      local((s) => ({
        ...s,
        competencies: s.competencies.map((c) =>
          c.id === id
            ? { ...c, ...patch, expected: { ...c.expected, ...(patch.expected ?? {}) } }
            : c,
        ),
      }));
      remote(api.updateCompetency(id, patch));
    },

    removeCompetency: (id) => {
      local((s) => ({ ...s, competencies: s.competencies.filter((c) => c.id !== id) }));
      remote(api.deleteCompetency(id));
    },

    addCategory: (c) => {
      local((s) => ({ ...s, categories: [...s.categories, c].sort(byName) }));
      remote(api.createCategory(c));
    },

    updateCategory: (id, patch) => {
      local((s) => ({
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)).sort(byName),
      }));
      remote(api.updateCategory(id, patch));
    },

    /** Excluir o domínio remove junto as competências que pertenciam a ele. */
    removeCategory: (id) => {
      local((s) => {
        const doomed = new Set(s.competencies.filter((c) => c.categoryId === id).map((c) => c.id));
        return {
          ...s,
          categories: s.categories.filter((c) => c.id !== id),
          competencies: s.competencies.filter((c) => c.categoryId !== id),
          assessments: s.assessments.map((a) => ({
            ...a,
            items: a.items.filter((i) => !doomed.has(i.competencyId)),
          })),
          learningPaths: s.learningPaths.map((p) => ({
            ...p,
            competencyIds: p.competencyIds.filter((cid) => !doomed.has(cid)),
          })),
          architects: s.architects.map((a) => ({
            ...a,
            strongDomain: a.strongDomain === id ? "" : a.strongDomain,
            gapDomain: a.gapDomain === id ? "" : a.gapDomain,
          })),
        };
      });
      remote(api.deleteCategory(id));
    },

    updateAssessmentItem: (assessmentId, competencyId, patch) => {
      local((s) => ({
        ...s,
        assessments: s.assessments.map((a) =>
          a.id !== assessmentId
            ? a
            : {
                ...a,
                items: a.items.map((it) =>
                  it.competencyId === competencyId ? { ...it, ...patch } : it,
                ),
              },
        ),
      }));
      remote(api.patchAssessmentItem(assessmentId, competencyId, patch));
    },

    updateSwot: (architectId, cycleId, patch) => {
      local((s) => {
        const exists = s.swots.some((w) => w.architectId === architectId && w.cycleId === cycleId);
        const base: Swot = {
          architectId,
          cycleId,
          strengths: [],
          weaknesses: [],
          opportunities: [],
          threats: [],
        };
        return {
          ...s,
          swots: exists
            ? s.swots.map((w) =>
                w.architectId === architectId && w.cycleId === cycleId ? { ...w, ...patch } : w,
              )
            : [...s.swots, { ...base, ...patch }],
        };
      });
      remote(api.putSwot(architectId, cycleId, patch));
    },

    addPlanItem: (architectId, item) => {
      local((s) => {
        const existing = s.plans.find(
          (p) => p.architectId === architectId && p.cycleId === s.activeCycleId,
        );
        if (existing) {
          return {
            ...s,
            plans: s.plans.map((p) =>
              p.id === existing.id ? { ...p, items: [...p.items, item] } : p,
            ),
          };
        }
        return {
          ...s,
          plans: [
            ...s.plans,
            {
              id: `pdi-${architectId}-${s.activeCycleId}`,
              architectId,
              cycleId: s.activeCycleId,
              status: "Draft",
              items: [item],
            },
          ],
        };
      });
      remote(api.addPlanItem(architectId, state.activeCycleId, item));
    },

    updatePlanItem: (planId, itemId, patch) => {
      local((s) => ({
        ...s,
        plans: s.plans.map((p) =>
          p.id !== planId
            ? p
            : { ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) },
        ),
      }));
      remote(api.patchPlanItem(planId, itemId, patch));
    },

    addEvidence: (e) => {
      local((s) => ({ ...s, evidences: [e, ...s.evidences] }));
      remote(api.createEvidence(e));
    },

    addCertification: (c) => {
      local((s) => ({ ...s, certifications: [c, ...s.certifications] }));
      remote(api.createCertification(c));
    },

    addMentoringSession: (m) => {
      local((s) => ({ ...s, mentoringSessions: [m, ...s.mentoringSessions] }));
      remote(api.createMentoringSession(m));
    },

    /** Trilha nova entra no topo da lista, igual à ordenação do servidor. */
    addLearningPath: (p) => {
      local((s) => ({ ...s, learningPaths: [p, ...s.learningPaths] }));
      remote(api.createLearningPath(p));
    },

    updateLearningItem: (pathId, itemId, progress) => {
      local((s) => ({
        ...s,
        learningPaths: s.learningPaths.map((p) =>
          p.id !== pathId
            ? p
            : {
                ...p,
                items: p.items.map((i) =>
                  i.id === itemId
                    ? {
                        ...i,
                        progress,
                        status:
                          progress >= 100
                            ? "Completed"
                            : progress > 0
                              ? "In Progress"
                              : "Not Started",
                      }
                    : i,
                ),
              },
        ),
      }));
      remote(api.patchLearningItem(pathId, itemId, progress));
    },

    updateKeyResult: (okrId, krId, progress) => {
      local((s) => ({
        ...s,
        okrs: s.okrs.map((o) =>
          o.id !== okrId
            ? o
            : {
                ...o,
                keyResults: o.keyResults.map((k) => (k.id === krId ? { ...k, progress } : k)),
              },
        ),
      }));
      remote(api.patchKeyResult(okrId, krId, progress));
    },

    addCycle: (c) => {
      local((s) => ({
        ...s,
        cycles: [...s.cycles, c].sort((x, y) => (x.start < y.start ? -1 : 1)),
      }));
      remote(api.createCycle(c));
    },

    updateCycle: (id, patch) => {
      local((s) => ({ ...s, cycles: s.cycles.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
      remote(api.updateCycle(id, patch));
    },

    removeCycle: (id) => {
      local((s) => ({ ...s, cycles: s.cycles.filter((c) => c.id !== id) }));
      remote(api.deleteCycle(id));
    },

    /**
     * Abrir assessment devolve o registro criado pelo servidor (uma linha por
     * competência), por isso esta é a única operação assíncrona da store.
     */
    openAssessment: async (architectId, cycleId) => {
      const assessment = await api.openAssessment(architectId, cycleId);
      local((s) => ({
        ...s,
        assessments: s.assessments.some((a) => a.id === assessment.id)
          ? s.assessments.map((a) => (a.id === assessment.id ? assessment : a))
          : [...s.assessments, assessment],
      }));
      return assessment;
    },

    setAssessmentStatus: (id, status) => {
      local((s) => ({
        ...s,
        assessments: s.assessments.map((a) => (a.id === id ? { ...a, status } : a)),
      }));
      remote(api.setAssessmentStatus(id, status));
    },

    savePhilosophy: (philosophy) => {
      local((s) => ({ ...s, philosophy }));
      remote(api.savePhilosophy(philosophy));
    },

    updateLearningPath: (id, patch) => {
      local((s) => ({
        ...s,
        learningPaths: s.learningPaths.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
      remote(api.updateLearningPath(id, patch));
    },

    removeLearningPath: (id) => {
      local((s) => ({ ...s, learningPaths: s.learningPaths.filter((p) => p.id !== id) }));
      remote(api.deleteLearningPath(id));
    },

    addLearningPathItem: (pathId, item) => {
      local((s) => ({
        ...s,
        learningPaths: s.learningPaths.map((p) =>
          p.id === pathId ? { ...p, items: [...p.items, item] } : p,
        ),
      }));
      remote(api.addLearningItem(pathId, item));
    },

    removeLearningPathItem: (pathId, itemId) => {
      local((s) => ({
        ...s,
        learningPaths: s.learningPaths.map((p) =>
          p.id === pathId ? { ...p, items: p.items.filter((i) => i.id !== itemId) } : p,
        ),
      }));
      remote(api.removeLearningItem(pathId, itemId));
    },

    moveNineBox: (architectId, performance, potential) => {
      local((s) => ({
        ...s,
        architects: s.architects.map((a) =>
          a.id === architectId ? { ...a, performance, potential } : a,
        ),
      }));
      remote(api.moveNineBox(architectId, performance, potential));
    },
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: STATE_QUERY_KEY,
    queryFn: api.getState,
    staleTime: 30_000,
    retry: 1,
    // Só busca no browser: o SSR renderiza o estado de carregamento e a
    // hidratação dispara a chamada real, sem exigir a API durante o build.
    enabled: typeof window !== "undefined",
  });

  const state = data ?? emptyState;
  const value = useMemo(() => buildApi(state, queryClient), [state, queryClient]);

  if (isError) return <ConnectionError error={error} onRetry={() => void refetch()} />;
  if (isPending || !data) return <LoadingState />;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Carregando dados do time…</p>
      </div>
    </div>
  );
}

function ConnectionError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Não foi possível carregar os dados
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Verifique se o backend está no ar (<code>docker compose up -d</code>) e se
          <code className="mx-1">VITE_API_URL</code>
          aponta para ele.
        </p>
        <button
          onClick={onRetry}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

/* ---------- selectors / derived helpers ---------- */

export function useSelectors() {
  const s = useStore();
  return useMemo(() => createSelectors(s), [s]);
}
