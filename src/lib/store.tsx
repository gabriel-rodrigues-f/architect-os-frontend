import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { toast } from "sonner";

import { api, ApiError, type AppState, type CommentInput } from "./api";
import type {
  Architect,
  Assessment,
  Competency,
  CompetencyCategory,
  DevelopmentCycle,
  DevelopmentPlan,
  DevelopmentPlanItem,
  Evidence,
  LearningItemProgress,
  LearningPath,
  LearningPathItem,
  Level,
  MentoringSession,
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
  addCompetency: (c: Competency) => void;
  updateCompetency: (id: string, patch: Partial<Omit<Competency, "id">>) => void;
  /** Apaga se a competência nunca foi usada; senão arquiva (active=false) — o resultado diz qual dos dois aconteceu. */
  removeCompetency: (id: string) => Promise<{ archived: boolean }>;
  addCategory: (c: CompetencyCategory) => void;
  updateCategory: (id: string, patch: Partial<Omit<CompetencyCategory, "id">>) => void;
  /** Apaga se nenhuma competência do domínio já foi usada; senão arquiva o domínio e as competências dele. */
  removeCategory: (id: string) => Promise<{ archived: boolean; competenciesRemoved: number }>;
  addCycle: (c: DevelopmentCycle) => void;
  updateCycle: (id: string, patch: Partial<Omit<DevelopmentCycle, "id">>) => void;
  removeCycle: (id: string) => void;
  openAssessment: (architectId: string, cycleId: string) => Promise<Assessment>;
  setAssessmentStatus: (id: string, status: Assessment["status"]) => Promise<Assessment>;
  updateLearningPath: (
    id: string,
    patch: Partial<
      Pick<LearningPath, "name" | "description" | "competencyIds" | "assignedTo" | "items">
    >,
  ) => void;
  removeLearningPath: (id: string) => void;
  addLearningPathItem: (pathId: string, item: LearningPathItem) => void;
  removeLearningPathItem: (pathId: string, itemId: string) => void;
  addAssessmentComment: (
    assessmentId: string,
    competencyId: string,
    comment: CommentInput,
  ) => Promise<Assessment>;
  updateAssessmentComment: (
    assessmentId: string,
    competencyId: string,
    commentId: string,
    comment: CommentInput,
  ) => Promise<Assessment>;
  removeAssessmentComment: (
    assessmentId: string,
    competencyId: string,
    commentId: string,
  ) => Promise<Assessment>;
  updateAssessmentItem: (
    assessmentId: string,
    competencyId: string,
    patch: Partial<{
      self: Level;
      leader: Level;
      target: Level;
      final: Level;
    }>,
  ) => void;
  addPlanItem: (architectId: string, item: DevelopmentPlanItem) => void;
  updatePlanItem: (planId: string, itemId: string, patch: Partial<DevelopmentPlanItem>) => void;
  /** Tira o item do PDI — a lacuna dele volta a aparecer como sugestão. */
  removePlanItem: (planId: string, itemId: string) => void;
  /**
   * Sem otimismo, como `setAssessmentStatus`: aprovar/reabrir/concluir o PDI
   * é uma transição de negócio que pode ser negada (dono não aprova nem
   * reabre o próprio plano) — a tela precisa do erro de verdade.
   */
  updatePlanStatus: (planId: string, status: DevelopmentPlan["status"]) => Promise<DevelopmentPlan>;
  /**
   * ENT-PDI-001 — reabertura de PDI concluído. Só o Tech Lead responsável
   * (sem bypass de admin), motivo obrigatório.
   */
  reopenPlan: (planId: string, reason: string) => Promise<DevelopmentPlan>;
  /**
   * Sem otimismo: autor e data são gerados pelo servidor (nunca aceitos do
   * cliente) — a lista de check-ins só reflete o que o servidor confirmou.
   */
  addPlanItemCheckin: (planId: string, itemId: string, text: string) => Promise<DevelopmentPlan>;
  /**
   * Sem otimismo: o servidor gera o id de verdade (nunca mais aceita o `id`
   * do cliente). Ver AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md,
   * IDOR-001.
   */
  addEvidence: (e: Evidence) => Promise<Evidence>;
  /**
   * Sem otimismo: aprovar/rejeitar evidência é decisão do Tech Lead, e a UI só
   * pode dizer "aprovado" depois que o servidor confirmou de verdade — ver
   * AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC L.
   */
  reviewEvidence: (
    id: string,
    review: { status: Evidence["status"]; leaderComment?: string | undefined },
  ) => Promise<void>;
  /** Sem otimismo — mesmo motivo de `addEvidence`. Ver IDOR-002. */
  addMentoringSession: (m: MentoringSession) => Promise<MentoringSession>;
  /** Sem otimismo: agendar follow-up é escrita autorizada (só quem registrou a sessão). */
  scheduleMentoringFollowUp: (id: string, nextSession: string | null) => Promise<MentoringSession>;
  updateLearningItemProgress: (
    pathId: string,
    architectId: string,
    itemId: string,
    progress: number,
  ) => void;
  /** Sem otimismo — mesmo motivo de `addEvidence`. Ver IDOR-001. */
  addLearningPath: (p: LearningPath) => Promise<LearningPath>;
}

const Ctx = createContext<Api | null>(null);

function buildApi(state: AppState, queryClient: QueryClient): Api {
  /** Aplica a mudança no cache local imediatamente (resposta otimista). */
  const local = (fn: (s: AppState) => AppState) => {
    queryClient.setQueryData<AppState>(STATE_QUERY_KEY, (prev) => (prev ? fn(prev) : prev));
  };

  /**
   * Dispara a chamada de escrita. A UI já mudou otimisticamente (`local`)
   * antes desta função ser chamada; em erro, essa mudança otimista não pode
   * ficar mentindo sozinha na tela — revalida a partir do servidor (volta o
   * dado real) e avisa quem clicou, em vez de falhar em silêncio como antes.
   * Ver AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC L.
   */
  const remote = (call: Promise<unknown>) => {
    void call.catch((error: unknown) => {
      if (error instanceof ApiError) console.error(`[api] ${error.status}: ${error.message}`);
      else console.error(error);
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Não foi possível salvar. A tela voltou ao último estado confirmado pelo servidor.",
      );
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

    /**
     * Sem otimismo aqui: o resultado só é conhecido depois que o servidor
     * responde (apagou ou arquivou), então a UI não pode decidir de antemão o
     * que remover da tela. Ver AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-
     * SYNAPSE.md, EPIC C.
     */
    removeCompetency: async (id) => {
      try {
        const result = await api.deleteCompetency(id);
        const archived = result?.archived === true;
        local((s) => ({
          ...s,
          competencies: archived
            ? s.competencies.map((c) => (c.id === id ? { ...c, active: false } : c))
            : s.competencies.filter((c) => c.id !== id),
        }));
        return { archived };
      } catch (error) {
        if (error instanceof ApiError) console.error(`[api] ${error.status}: ${error.message}`);
        else console.error(error);
        void queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY });
        throw error;
      }
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
    /**
     * Excluir o domínio nunca mexe em `assessments`: o backend não altera
     * avaliação histórica quando o catálogo muda (não há FK entre a linha
     * JSONB do item e a competência — a competência pode deixar de existir
     * sem que o registro do que foi perguntado na época mude). Antes, a
     * atualização otimista aqui apagava o item também da tela, na frente do
     * servidor — via de regra corrigido no próximo refetch, mas mostrando
     * por alguns instantes uma avaliação passada com menos itens do que ela
     * realmente tem salvo. Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md,
     * Seção 19.
     */
    removeCategory: async (id) => {
      try {
        const result = await api.deleteCategory(id);
        local((s) => {
          if (result.archived) {
            return {
              ...s,
              categories: s.categories.map((c) => (c.id === id ? { ...c, active: false } : c)),
              competencies: s.competencies.map((c) =>
                c.categoryId === id ? { ...c, active: false } : c,
              ),
            };
          }
          const doomed = new Set(
            s.competencies.filter((c) => c.categoryId === id).map((c) => c.id),
          );
          return {
            ...s,
            categories: s.categories.filter((c) => c.id !== id),
            competencies: s.competencies.filter((c) => c.categoryId !== id),
            learningPaths: s.learningPaths.map((p) => ({
              ...p,
              competencyIds: p.competencyIds.filter((cid) => !doomed.has(cid)),
            })),
          };
        });
        return result;
      } catch (error) {
        if (error instanceof ApiError) console.error(`[api] ${error.status}: ${error.message}`);
        else console.error(error);
        void queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY });
        throw error;
      }
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

    /**
     * Sem resposta otimista: o id e a data de salvamento nascem no servidor, e
     * exibir uma data chutada pelo navegador seria mentira até a resposta voltar.
     * Vale para as três operações do par de comentários.
     */
    addAssessmentComment: async (assessmentId, competencyId, comment) => {
      const updated = await api.addAssessmentComment(assessmentId, competencyId, comment);
      local((s) => ({
        ...s,
        assessments: s.assessments.map((a) => (a.id === updated.id ? updated : a)),
      }));
      return updated;
    },

    updateAssessmentComment: async (assessmentId, competencyId, commentId, comment) => {
      const updated = await api.updateAssessmentComment(
        assessmentId,
        competencyId,
        commentId,
        comment,
      );
      local((s) => ({
        ...s,
        assessments: s.assessments.map((a) => (a.id === updated.id ? updated : a)),
      }));
      return updated;
    },

    removeAssessmentComment: async (assessmentId, competencyId, commentId) => {
      const updated = await api.deleteAssessmentComment(assessmentId, competencyId, commentId);
      local((s) => ({
        ...s,
        assessments: s.assessments.map((a) => (a.id === updated.id ? updated : a)),
      }));
      return updated;
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
              version: 1,
            },
          ],
        };
      });
      remote(api.addPlanItem(architectId, state.activeCycleId, item));
    },

    updatePlanItem: (planId, itemId, patch) => {
      // `expectedVersion` vem do estado que a tela está mostrando agora —
      // concorrência otimista (ENT-DATA-012): se outra pessoa já escreveu
      // neste item, o servidor recusa com 409 e `remote()` revalida.
      const expectedVersion =
        state.plans.find((p) => p.id === planId)?.items.find((i) => i.id === itemId)?.version ?? 1;
      local((s) => ({
        ...s,
        plans: s.plans.map((p) =>
          p.id !== planId
            ? p
            : { ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) },
        ),
      }));
      remote(api.patchPlanItem(planId, itemId, patch, expectedVersion));
    },

    removePlanItem: (planId, itemId) => {
      local((s) => ({
        ...s,
        plans: s.plans.map((p) =>
          p.id !== planId ? p : { ...p, items: p.items.filter((i) => i.id !== itemId) },
        ),
      }));
      remote(api.removePlanItem(planId, itemId));
    },

    updatePlanStatus: async (planId, status) => {
      const expectedVersion = state.plans.find((p) => p.id === planId)?.version ?? 1;
      const updated = await api.updatePlanStatus(planId, status, expectedVersion);
      local((s) => ({
        ...s,
        plans: s.plans.map((p) => (p.id === planId ? updated : p)),
      }));
      return updated;
    },

    /**
     * Reabertura de PDI concluído (ENT-PDI-001) — comando dedicado, sem
     * otimismo: exige motivo e só o Tech Lead responsável, então a tela
     * precisa do erro de verdade se a autorização ou o motivo falharem.
     */
    reopenPlan: async (planId, reason) => {
      const expectedVersion = state.plans.find((p) => p.id === planId)?.version ?? 1;
      const updated = await api.reopenPlan(planId, reason, expectedVersion);
      local((s) => ({
        ...s,
        plans: s.plans.map((p) => (p.id === planId ? updated : p)),
      }));
      return updated;
    },

    addPlanItemCheckin: async (planId, itemId, text) => {
      const updated = await api.addPlanItemCheckin(planId, itemId, text);
      local((s) => ({
        ...s,
        plans: s.plans.map((p) => (p.id === planId ? updated : p)),
      }));
      return updated;
    },

    /**
     * Sem otimismo: o servidor gera o id de verdade (nunca mais o `id`
     * enviado pelo cliente — ver AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-
     * 08-19.md, IDOR-001). Inserir a evidência localmente com um id
     * inventado antes da resposta deixaria o item com um id que nunca vai
     * bater com o do servidor, permanentemente, até o próximo refresh.
     */
    addEvidence: async (e) => {
      const created = await api.createEvidence(e);
      local((s) => ({ ...s, evidences: [created, ...s.evidences] }));
      return created;
    },

    reviewEvidence: async (id, review) => {
      const updated = await api.reviewEvidence(id, review);
      local((s) => ({
        ...s,
        evidences: s.evidences.map((e) => (e.id === id ? updated : e)),
      }));
    },

    /** Sem otimismo — mesmo motivo de `addEvidence`: o id de verdade só existe depois da resposta. */
    addMentoringSession: async (m) => {
      const created = await api.createMentoringSession(m);
      local((s) => ({ ...s, mentoringSessions: [created, ...s.mentoringSessions] }));
      return created;
    },

    scheduleMentoringFollowUp: async (id, nextSession) => {
      const updated = await api.scheduleMentoringFollowUp(id, nextSession);
      local((s) => ({
        ...s,
        mentoringSessions: s.mentoringSessions.map((m) => (m.id === id ? updated : m)),
      }));
      return updated;
    },

    /**
     * Trilha nova entra no topo da lista, igual à ordenação do servidor.
     * Sem otimismo — mesmo motivo de `addEvidence`: o id de verdade só
     * existe depois da resposta.
     */
    addLearningPath: async (p) => {
      const created = await api.createLearningPath(p);
      local((s) => ({ ...s, learningPaths: [created, ...s.learningPaths] }));
      return created;
    },

    /** Progresso é por pessoa: só a entrada de (architectId, itemId) muda, nunca o item inteiro. */
    updateLearningItemProgress: (pathId, architectId, itemId, progress) => {
      const status: LearningItemProgress["status"] =
        progress >= 100 ? "Completed" : progress > 0 ? "In Progress" : "Not Started";
      local((s) => ({
        ...s,
        learningPaths: s.learningPaths.map((p) =>
          p.id !== pathId
            ? p
            : {
                ...p,
                progress: p.progress.some(
                  (e) => e.architectId === architectId && e.itemId === itemId,
                )
                  ? p.progress.map((e) =>
                      e.architectId === architectId && e.itemId === itemId
                        ? { ...e, progress, status }
                        : e,
                    )
                  : [...p.progress, { architectId, itemId, progress, status }],
              },
        ),
      }));
      remote(api.patchLearningItemProgress(pathId, architectId, itemId, progress));
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

    /*
      Awaitable, e não otimista: enviar para revisão, concluir ou reabrir é
      uma transição de negócio que pode ser negada (quem não é Tech Lead não
      finaliza nem reabre) — a tela precisa do erro de verdade para mostrar,
      não só reverter em silêncio depois de já ter pintado o novo status na
      hora do clique.
    */
    setAssessmentStatus: async (id, status) => {
      const updated = await api.setAssessmentStatus(id, status);
      local((s) => ({
        ...s,
        assessments: s.assessments.map((a) => (a.id === id ? updated : a)),
      }));
      return updated;
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
