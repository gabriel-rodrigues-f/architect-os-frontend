import { useQueries, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { toast } from "sonner";

import { api, ApiError, type AppState, type CommentInput } from "./api";
import { apiPath } from "./api-path";
import type {
  CapabilityFoundationPayload,
  CompetencyRemovalSummary,
} from "./gateways/catalog.gateway";
import type { TextTemplateRecord } from "./gateways/config.gateway";
import type {
  Architect,
  Assessment,
  CareerLevel,
  Competency,
  Capability,
  DevelopmentCycle,
  DevelopmentPlan,
  DevelopmentPlanItem,
  DevelopmentPlanItemEvent,
  Evidence,
  LearningItemProgress,
  LearningPath,
  LearningPathItem,
  Level,
  MentoringSession,
  ProficiencyUpdate,
  TeamLevelRule,
} from "./domain";
import { EffectiveCurationPolicy, type CurationPolicy } from "./curation-policy";
import { configurationCatalog, RulerConfiguration } from "./configuration-queries";
import { appStateQuery, STATE_QUERY_KEY } from "./session-query";
import {
  EffectiveOperationalSettings,
  type AppSettingValue,
  type OperationalSettings,
} from "./operational-settings";
import { useI18n } from "./i18n";
import { MutationRunner, type MutationCache } from "./mutation-runner";
import { expectedVersionOf, UnknownExpectedVersionError } from "./optimistic-lock";
import {
  ScoringRuler,
  type GapSeverityRuler,
  type ScoringBand,
  type ScoringBands,
  type ScoringScale,
} from "./scoring-bands";
import { createSelectors, emptyState } from "./selectors";
import type { VocabularyItemInput, VocabularyItemPatch } from "./gateways/config.gateway";
import type { CatalogImportPayload, CatalogImportSummary } from "./catalog-import";
import {
  VocabularyCatalog,
  type Vocabularies,
  type VocabularyItem,
  type VocabularyName,
} from "./vocabularies";
import { defaultNameFormatter } from "./text";
import {
  TextTemplateRenderer,
  type RenderObjectiveFromGap,
  type TextTemplates,
} from "./text-templates";

export { STATE_QUERY_KEY };

export function useCareerLevelsByRank(): CareerLevel[] {
  const { data } = useQuery(configurationCatalog.careerLevels.options);
  return [...(data ?? [])].sort((a, b) => a.rank - b.rank);
}

export function useScoringRuler(): ScoringRuler {
  const { data } = useQuery(configurationCatalog.scoringBands.options);
  return useMemo(() => ScoringRuler.fromLoaded(data), [data]);
}

export function useScoringBands(): ScoringBands {
  return useScoringRuler().scales;
}

export function useGapSeverityRuler(): GapSeverityRuler {
  const ruler = useScoringRuler();
  return useMemo(() => ruler.gapSeverity, [ruler]);
}

export function useTextTemplates(): TextTemplates {
  const { data } = useQuery(configurationCatalog.textTemplates.options);
  return useMemo(() => TextTemplateRenderer.resolve(data), [data]);
}

export function useCurationPolicy(): CurationPolicy {
  const { data } = useQuery(configurationCatalog.curationPolicy.options);
  return useMemo(() => EffectiveCurationPolicy.resolve(data), [data]);
}

export function useOperationalSettings(): OperationalSettings {
  const { data } = useQuery(configurationCatalog.operationalSettings.options);
  return useMemo(() => EffectiveOperationalSettings.resolve(data), [data]);
}

export function useVocabularies(): Vocabularies {
  const { data } = useQuery(configurationCatalog.vocabularies.options);
  return useMemo(() => VocabularyCatalog.resolve(data), [data]);
}

export function useVocabulary(name: VocabularyName): {
  items: VocabularyItem[];
  options: VocabularyItem[];
  label: (code: string) => string;
} {
  const vocabularies = useVocabularies();
  const { t } = useI18n();
  return useMemo(() => {
    const vocabulary = VocabularyCatalog.over(vocabularies).named(name);
    const translate = (labelKey: string): string | undefined => {
      const text = t(labelKey as Parameters<typeof t>[0]);
      return text === labelKey ? undefined : text;
    };
    return {
      items: vocabulary.items,
      options: vocabulary.activeOptions,
      label: (code: string) => vocabulary.labelOf(code, translate),
    };
  }, [vocabularies, name, t]);
}

export function useObjectiveFromGap(): RenderObjectiveFromGap {
  const templates = useTextTemplates();
  const { locale } = useI18n();
  return useMemo(
    () => TextTemplateRenderer.over(templates, locale).objectiveFromGap,
    [templates, locale],
  );
}

export interface Api extends AppState {
  addArchitect: (a: Omit<Architect, "id" | "version">) => Promise<Architect>;
  updateArchitect: (id: string, patch: Partial<Omit<Architect, "id" | "role" | "version">>) => void;

  transitionCareerLevel: (
    id: string,
    toRole: Architect["role"],
    reason: string,
  ) => Promise<Architect>;

  deactivate: (id: string, reason: string) => Promise<Architect>;

  allocateArchitectToTeam: (
    architectId: string,
    teamId: string,
    reason: string,
  ) => Promise<Architect>;
  releaseArchitectFromTeam: (architectId: string) => Promise<Architect>;

  defineTeamRuleMinimum: (
    teamId: string,
    careerLevelId: string,
    minimumQualifiedCapabilities: number,
  ) => Promise<TeamLevelRule>;

  updateScoringBands: (scale: ScoringScale, bands: ScoringBand[]) => Promise<ScoringBand[]>;

  updateTextTemplate: (
    key: string,
    locale: string,
    template: string,
  ) => Promise<TextTemplateRecord>;

  updateCurationPolicy: (policy: CurationPolicy) => Promise<CurationPolicy>;

  updateAppSetting: (
    key: string,
    value: AppSettingValue,
  ) => Promise<{ key: string; value: AppSettingValue }>;

  addVocabularyItem: (
    vocabulary: VocabularyName,
    code: string,
    input: VocabularyItemInput,
  ) => Promise<VocabularyItem>;

  updateVocabularyItem: (
    vocabulary: VocabularyName,
    code: string,
    patch: VocabularyItemPatch,
  ) => Promise<VocabularyItem>;

  importCatalog: (payload: CatalogImportPayload) => Promise<CatalogImportSummary>;

  addCompetency: (c: Omit<Competency, "id">) => Promise<Competency>;
  updateCompetency: (id: string, patch: Partial<Omit<Competency, "id">>) => void;

  removeCompetency: (id: string) => Promise<{ archived: boolean }>;
  removeCompetencies: (competencyIds: string[]) => Promise<CompetencyRemovalSummary>;

  foundCapability: (foundation: CapabilityFoundationPayload) => Promise<Capability>;
  updateCapability: (id: string, patch: Partial<Omit<Capability, "id" | "curation">>) => void;

  removeCapability: (id: string) => Promise<{ archived: boolean; competenciesRemoved: number }>;
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

  createPlanItemFromGap: (
    architectId: string,
    item: {
      id: string;
      assessmentId: string;
      competencyId: string;
      objective: string;
      actionType: DevelopmentPlanItem["actionType"];
      actionPlan: string;
      startDate: string;
      targetDate: string;
      owner: string;
      dedicationHoursPerWeek?: number | null;
    },
  ) => Promise<DevelopmentPlan>;
  updatePlanItem: (planId: string, itemId: string, patch: Partial<DevelopmentPlanItem>) => void;

  removePlanItem: (planId: string, itemId: string) => void;

  reschedulePlanItem: (
    planId: string,
    itemId: string,
    targetDate: string,
    reason: string,
  ) => Promise<DevelopmentPlan>;

  planItemEvents: (planId: string, itemId: string) => Promise<DevelopmentPlanItemEvent[]>;

  updatePlanStatus: (planId: string, status: DevelopmentPlan["status"]) => Promise<DevelopmentPlan>;

  reopenPlan: (planId: string, reason: string) => Promise<DevelopmentPlan>;

  addPlanItemCheckin: (planId: string, itemId: string, text: string) => Promise<DevelopmentPlan>;

  addEvidence: (e: Evidence) => Promise<Evidence>;

  reviewEvidence: (
    id: string,
    review: { status: Evidence["status"]; leaderComment?: string | undefined },
  ) => Promise<void>;

  resubmitEvidence: (id: string, patch: { description?: string; url?: string }) => Promise<void>;

  addMentoringSession: (
    m: MentoringSession,
    proficiencyUpdates?: ProficiencyUpdate[],
  ) => Promise<MentoringSession>;

  scheduleMentoringFollowUp: (id: string, nextSession: string | null) => Promise<MentoringSession>;
  updateLearningItemProgress: (
    pathId: string,
    architectId: string,
    itemId: string,
    progress: number,
  ) => void;

  addLearningPath: (p: LearningPath) => Promise<LearningPath>;
}

const Ctx = createContext<Api | null>(null);

export { Ctx as StoreApiContext };

export const MUTATION_FALLBACK_ERROR_MESSAGE =
  "Não foi possível salvar. A tela voltou ao último estado confirmado pelo servidor.";

function blobMutationCache(queryClient: QueryClient): MutationCache<AppState> {
  return {
    update: (fn) =>
      queryClient.setQueryData<AppState>(STATE_QUERY_KEY, (prev) => (prev ? fn(prev) : prev)),
    invalidate: () => void queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY }),
  };
}

export function buildApi(
  state: AppState,
  queryClient: QueryClient,
  cache: MutationCache<AppState> = blobMutationCache(queryClient),
): Api {
  const runner = new MutationRunner<AppState>(
    cache,
    (message) => toast.error(message),
    MUTATION_FALLBACK_ERROR_MESSAGE,
  );

  const refreshCurationCounts = <T,>(result: T): T => {
    void queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY });
    return result;
  };

  return {
    ...state,
    capabilities: [...state.capabilities].sort(defaultNameFormatter.byName),

    addArchitect: (a) =>
      runner.command(
        () => api.createArchitect(a),
        (created) => (s) => ({ ...s, architects: [...s.architects, created] }),
      ),

    updateArchitect: (id, patch) => {
      runner.optimistic(
        (s) => ({
          ...s,
          architects: s.architects.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }),
        () => api.updateArchitect(id, patch),
      );
    },

    updateScoringBands: async (scale, bands) => {
      const updated = await api.updateScoringBands(scale, bands);
      await queryClient.invalidateQueries({ queryKey: configurationCatalog.scoringBands.queryKey });
      return updated;
    },

    updateTextTemplate: async (key, locale, template) => {
      const updated = await api.updateTextTemplate(key, locale, template);
      await queryClient.invalidateQueries({
        queryKey: configurationCatalog.textTemplates.queryKey,
      });
      return updated;
    },

    updateCurationPolicy: async (policy) => {
      const updated = await api.updateCurationPolicy(policy);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: configurationCatalog.curationPolicy.queryKey }),
        queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY }),
      ]);
      return updated;
    },

    updateAppSetting: async (key, value) => {
      const updated = await api.updateSetting(key, value);
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: configurationCatalog.operationalSettings.queryKey,
        }),
      ];
      if (key === "cycle.cadence")
        invalidations.push(queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY }));
      await Promise.all(invalidations);
      return updated;
    },

    addVocabularyItem: async (vocabulary, code, input) => {
      const created = await api.addVocabularyItem(vocabulary, code, input);
      await queryClient.invalidateQueries({ queryKey: configurationCatalog.vocabularies.queryKey });
      return created;
    },

    updateVocabularyItem: async (vocabulary, code, patch) => {
      const updated = await api.updateVocabularyItem(vocabulary, code, patch);
      await queryClient.invalidateQueries({ queryKey: configurationCatalog.vocabularies.queryKey });
      return updated;
    },

    importCatalog: async (payload) => {
      const summary = await api.importCatalog(payload);
      await queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY });
      return summary;
    },

    defineTeamRuleMinimum: (teamId, careerLevelId, minimumQualifiedCapabilities) =>
      runner.command(
        async () => {
          const current = await api.teamRule(teamId, careerLevelId).catch((error: unknown) => {
            if (error instanceof ApiError && error.status === 404) return undefined;
            throw error;
          });
          return api.defineTeamRule(teamId, careerLevelId, {
            minimumQualifiedCapabilities,
            capabilityIds: current?.capabilityIds ?? [],
            competencies: current?.competencies ?? [],
          });
        },
        (updated) => (s) => {
          const summary: TeamLevelRule = {
            id: updated.id,
            teamId: updated.teamId,
            careerLevelId: updated.careerLevelId,
            minimumQualifiedCapabilities: updated.minimumQualifiedCapabilities,
          };
          const exists = s.teamLevelRules.some((rule) => rule.id === summary.id);
          return {
            ...s,
            teamLevelRules: exists
              ? s.teamLevelRules.map((rule) => (rule.id === summary.id ? summary : rule))
              : [...s.teamLevelRules, summary],
          };
        },
      ),

    transitionCareerLevel: async (id, toRole, reason) => {
      const expectedVersion = expectedVersionOf(
        state.architects.find((a) => a.id === id)?.version,
        "deste profissional",
        id,
      );
      return runner.command(
        () => api.transitionCareerLevel(id, toRole, reason, expectedVersion),
        (updated) => (s) => ({
          ...s,
          architects: s.architects.map((a) => (a.id === id ? updated : a)),
        }),
      );
    },

    deactivate: async (id, reason) => {
      const expectedVersion = expectedVersionOf(
        state.architects.find((a) => a.id === id)?.version,
        "deste profissional",
        id,
      );
      return runner.command(
        () => api.deactivate(id, reason, expectedVersion),
        (updated) => (s) => ({
          ...s,
          architects: s.architects.map((a) => (a.id === id ? updated : a)),
        }),
      );
    },

    allocateArchitectToTeam: (architectId, teamId, reason) =>
      runner.command(
        () => api.allocateArchitectToTeam(architectId, teamId, reason),
        (allocated) => (state) => ({
          ...state,
          architects: state.architects.map((architect) =>
            architect.id === architectId ? allocated : architect,
          ),
        }),
      ),

    releaseArchitectFromTeam: (architectId) =>
      runner.command(
        () => api.releaseArchitectFromTeam(architectId),
        (released) => (state) => ({
          ...state,
          architects: state.architects.map((architect) =>
            architect.id === architectId ? released : architect,
          ),
        }),
      ),

    addCompetency: (c) =>
      runner
        .command(
          () => api.createCompetency(c),
          (created) => (s) => ({ ...s, competencies: [...s.competencies, created] }),
        )
        .then(refreshCurationCounts),

    updateCompetency: (id, patch) => {
      runner.optimistic(
        (s) => ({
          ...s,
          competencies: s.competencies.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }),
        () => api.updateCompetency(id, patch).then(refreshCurationCounts),
      );
    },

    removeCompetency: (id) =>
      runner
        .guarded(
          async () => ({ archived: (await api.deleteCompetency(id))?.archived === true }),
          ({ archived }) =>
            (s) => ({
              ...s,
              competencies: archived
                ? s.competencies.map((c) => (c.id === id ? { ...c, active: false } : c))
                : s.competencies.filter((c) => c.id !== id),
            }),
        )
        .then(refreshCurationCounts),

    removeCompetencies: (competencyIds) =>
      runner
        .guarded(
          () => api.removeCompetencies(competencyIds),
          ({ outcomes }) =>
            (state) => {
              const removed = new Set(
                outcomes
                  .filter((outcome) => outcome.outcome === "removed")
                  .map((outcome) => outcome.competencyId),
              );
              const archived = new Set(
                outcomes
                  .filter((outcome) => outcome.outcome === "archived")
                  .map((outcome) => outcome.competencyId),
              );
              return {
                ...state,
                competencies: state.competencies
                  .filter((competency) => !removed.has(competency.id))
                  .map((competency) =>
                    archived.has(competency.id) ? { ...competency, active: false } : competency,
                  ),
                learningPaths: state.learningPaths.map((learningPath) => ({
                  ...learningPath,
                  competencyIds: learningPath.competencyIds.filter(
                    (competencyId) => !removed.has(competencyId),
                  ),
                })),
              };
            },
        )
        .then(refreshCurationCounts),

    foundCapability: (foundation) =>
      runner
        .command(
          () => api.foundCapability(foundation),
          (created) => (s) => ({
            ...s,
            capabilities: [...s.capabilities, created].sort(defaultNameFormatter.byName),
          }),
        )
        .then(refreshCurationCounts),

    updateCapability: (id, patch) => {
      runner.optimistic(
        (s) => ({
          ...s,
          capabilities: s.capabilities
            .map((c) => (c.id === id ? { ...c, ...patch } : c))
            .sort(defaultNameFormatter.byName),
        }),
        () => api.updateCapability(id, patch).then(refreshCurationCounts),
        (updated) => (s) => ({
          ...s,
          capabilities: s.capabilities
            .map((c) => (c.id === id ? updated : c))
            .sort(defaultNameFormatter.byName),
        }),
      );
    },

    removeCapability: (id) =>
      runner
        .guarded(
          () => api.deleteCapability(id),
          (result) => (s) => {
            if (result.archived) {
              return {
                ...s,
                capabilities: s.capabilities.map((c) =>
                  c.id === id ? { ...c, active: false } : c,
                ),
                competencies: s.competencies.map((c) =>
                  c.capabilityId === id ? { ...c, active: false } : c,
                ),
              };
            }
            const doomed = new Set(
              s.competencies.filter((c) => c.capabilityId === id).map((c) => c.id),
            );
            return {
              ...s,
              capabilities: s.capabilities.filter((c) => c.id !== id),
              competencies: s.competencies.filter((c) => c.capabilityId !== id),
              learningPaths: s.learningPaths.map((p) => ({
                ...p,
                competencyIds: p.competencyIds.filter((cid) => !doomed.has(cid)),
              })),
            };
          },
        )
        .then(refreshCurationCounts),

    updateAssessmentItem: (assessmentId, competencyId, patch) => {
      const knownVersion = state.assessments
        .find((a) => a.id === assessmentId)
        ?.items.find((i) => i.competencyId === competencyId)?.version;
      if (knownVersion === undefined) {
        runner.refuse(new UnknownExpectedVersionError("deste item da avaliação", competencyId));
        return;
      }
      const expectedVersion = knownVersion;
      runner.optimistic(
        (s) => ({
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
        }),
        () => api.patchAssessmentItem(assessmentId, competencyId, patch, expectedVersion),
        (updated) => (s) => ({
          ...s,
          assessments: s.assessments.map((a) => (a.id === updated.id ? updated : a)),
        }),
      );
    },

    addAssessmentComment: (assessmentId, competencyId, comment) =>
      runner.command(
        () => api.addAssessmentComment(assessmentId, competencyId, comment),
        (updated) => (s) => ({
          ...s,
          assessments: s.assessments.map((a) => (a.id === updated.id ? updated : a)),
        }),
      ),

    updateAssessmentComment: (assessmentId, competencyId, commentId, comment) =>
      runner.command(
        () => api.updateAssessmentComment(assessmentId, competencyId, commentId, comment),
        (updated) => (s) => ({
          ...s,
          assessments: s.assessments.map((a) => (a.id === updated.id ? updated : a)),
        }),
      ),

    removeAssessmentComment: (assessmentId, competencyId, commentId) =>
      runner.command(
        () => api.deleteAssessmentComment(assessmentId, competencyId, commentId),
        (updated) => (s) => ({
          ...s,
          assessments: s.assessments.map((a) => (a.id === updated.id ? updated : a)),
        }),
      ),

    addPlanItem: (architectId, item) => {
      runner.optimistic(
        (s) => {
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
        },
        () => api.addPlanItem(architectId, state.activeCycleId, item),
      );
    },

    createPlanItemFromGap: (architectId, item) =>
      runner.command(
        () => api.createPlanItemFromGap(architectId, item),
        (updated) => (s) => ({
          ...s,
          plans: s.plans.some((p) => p.id === updated.id)
            ? s.plans.map((p) => (p.id === updated.id ? updated : p))
            : [...s.plans, updated],
        }),
      ),

    updatePlanItem: (planId, itemId, patch) => {
      const knownVersion = state.plans
        .find((p) => p.id === planId)
        ?.items.find((i) => i.id === itemId)?.version;
      if (knownVersion === undefined) {
        runner.refuse(new UnknownExpectedVersionError("deste item do plano", itemId));
        return;
      }
      const expectedVersion = knownVersion;

      runner.optimistic(
        (s) => ({
          ...s,
          plans: s.plans.map((p) =>
            p.id !== planId
              ? p
              : { ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) },
          ),
        }),
        () => api.patchPlanItem(planId, itemId, patch, expectedVersion),
        (updated) => (s) => ({ ...s, plans: s.plans.map((p) => (p.id === planId ? updated : p)) }),
      );
    },

    removePlanItem: (planId, itemId) => {
      runner.optimistic(
        (s) => ({
          ...s,
          plans: s.plans.map((p) =>
            p.id !== planId ? p : { ...p, items: p.items.filter((i) => i.id !== itemId) },
          ),
        }),
        () => api.removePlanItem(planId, itemId),
      );
    },

    reschedulePlanItem: async (planId, itemId, targetDate, reason) => {
      const expectedVersion = expectedVersionOf(
        state.plans.find((p) => p.id === planId)?.items.find((i) => i.id === itemId)?.version,
        "deste item do plano",
        itemId,
      );
      return runner.command(
        () => api.reschedulePlanItem(planId, itemId, targetDate, reason, expectedVersion),
        (updated) => (s) => ({
          ...s,
          plans: s.plans.map((p) => (p.id === planId ? updated : p)),
        }),
      );
    },

    planItemEvents: (planId, itemId) => api.planItemEvents(planId, itemId),

    updatePlanStatus: async (planId, status) => {
      const expectedVersion = expectedVersionOf(
        state.plans.find((p) => p.id === planId)?.version,
        "deste plano",
        planId,
      );
      return runner.command(
        () => api.updatePlanStatus(planId, status, expectedVersion),
        (updated) => (s) => ({
          ...s,
          plans: s.plans.map((p) => (p.id === planId ? updated : p)),
        }),
      );
    },

    reopenPlan: async (planId, reason) => {
      const expectedVersion = expectedVersionOf(
        state.plans.find((p) => p.id === planId)?.version,
        "deste plano",
        planId,
      );
      return runner.command(
        () => api.reopenPlan(planId, reason, expectedVersion),
        (updated) => (s) => ({
          ...s,
          plans: s.plans.map((p) => (p.id === planId ? updated : p)),
        }),
      );
    },

    addPlanItemCheckin: (planId, itemId, text) =>
      runner.command(
        () => api.addPlanItemCheckin(planId, itemId, text),
        (updated) => (s) => ({
          ...s,
          plans: s.plans.map((p) => (p.id === planId ? updated : p)),
        }),
      ),

    addEvidence: (e) =>
      runner.command(
        () => api.createEvidence(e),
        (created) => (s) => ({ ...s, evidences: [created, ...s.evidences] }),
      ),

    reviewEvidence: async (id, review) => {
      await runner.command(
        () => api.reviewEvidence(id, review),
        (updated) => (s) => ({
          ...s,
          evidences: s.evidences.map((e) => (e.id === id ? updated : e)),
        }),
      );
    },

    resubmitEvidence: async (id, patch) => {
      await runner.command(
        () => api.resubmitEvidence(id, patch),
        (updated) => (s) => ({
          ...s,
          evidences: s.evidences.map((e) => (e.id === id ? updated : e)),
        }),
      );
    },

    addMentoringSession: (m, proficiencyUpdates = []) =>
      runner.command(
        () => api.createMentoringSession(m, proficiencyUpdates),
        (created) => (s) => ({ ...s, mentoringSessions: [created, ...s.mentoringSessions] }),
      ),

    scheduleMentoringFollowUp: (id, nextSession) =>
      runner.command(
        () => api.scheduleMentoringFollowUp(id, nextSession),
        (updated) => (s) => ({
          ...s,
          mentoringSessions: s.mentoringSessions.map((m) => (m.id === id ? updated : m)),
        }),
      ),

    addLearningPath: (p) =>
      runner.command(
        () => api.createLearningPath(p),
        (created) => (s) => ({ ...s, learningPaths: [created, ...s.learningPaths] }),
      ),

    updateLearningItemProgress: (pathId, architectId, itemId, progress) => {
      const status: LearningItemProgress["status"] =
        progress >= 100 ? "Completed" : progress > 0 ? "In Progress" : "Not Started";
      runner.optimistic(
        (s) => ({
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
        }),
        () => api.patchLearningItemProgress(pathId, architectId, itemId, progress),
      );
    },

    addCycle: (c) => {
      runner.optimistic(
        (s) => ({
          ...s,
          cycles: [...s.cycles, c].sort((x, y) => (x.start < y.start ? -1 : 1)),
        }),
        () => api.createCycle(c),
      );
    },

    updateCycle: (id, patch) => {
      runner.optimistic(
        (s) => ({ ...s, cycles: s.cycles.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),
        () => api.updateCycle(id, patch),
      );
    },

    removeCycle: (id) => {
      runner.optimistic(
        (s) => ({ ...s, cycles: s.cycles.filter((c) => c.id !== id) }),
        () => api.deleteCycle(id),
      );
    },

    openAssessment: (architectId, cycleId) =>
      runner.command(
        () => api.openAssessment(architectId, cycleId),
        (assessment) => (s) => ({
          ...s,
          assessments: s.assessments.some((a) => a.id === assessment.id)
            ? s.assessments.map((a) => (a.id === assessment.id ? assessment : a))
            : [...s.assessments, assessment],
        }),
      ),

    setAssessmentStatus: async (id, status) => {
      const expectedVersion = expectedVersionOf(
        state.assessments.find((a) => a.id === id)?.version,
        "desta avaliação",
        id,
      );
      return runner.command(
        () => api.setAssessmentStatus(id, status, expectedVersion),
        (updated) => (s) => ({
          ...s,
          assessments: s.assessments.map((a) => (a.id === id ? updated : a)),
        }),
      );
    },

    updateLearningPath: (id, patch) => {
      runner.optimistic(
        (s) => ({
          ...s,
          learningPaths: s.learningPaths.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }),
        () => api.updateLearningPath(id, patch),
      );
    },

    removeLearningPath: (id) => {
      runner.optimistic(
        (s) => ({ ...s, learningPaths: s.learningPaths.filter((p) => p.id !== id) }),
        () => api.deleteLearningPath(id),
      );
    },

    addLearningPathItem: (pathId, item) => {
      runner.optimistic(
        (s) => ({
          ...s,
          learningPaths: s.learningPaths.map((p) =>
            p.id === pathId ? { ...p, items: [...p.items, item] } : p,
          ),
        }),
        () => api.addLearningItem(pathId, item),
      );
    },

    removeLearningPathItem: (pathId, itemId) => {
      runner.optimistic(
        (s) => ({
          ...s,
          learningPaths: s.learningPaths.map((p) =>
            p.id === pathId ? { ...p, items: p.items.filter((i) => i.id !== itemId) } : p,
          ),
        }),
        () => api.removeLearningItem(pathId, itemId),
      );
    },
  };
}

export function useRulerConfiguration(): RulerConfiguration {
  const loads = useQueries({
    queries: configurationCatalog.rulers.map((configuration) => configuration.options),
  });
  return new RulerConfiguration(loads);
}

export type StoreProviderMode = "blob" | "contexts";

export function StoreProvider({
  children,
  mode = "blob",
}: {
  children: ReactNode;
  mode?: StoreProviderMode;
}) {
  const queryClient = useQueryClient();

  const { data, isPending, isError, error, refetch } = useQuery({
    ...appStateQuery,

    enabled: typeof window !== "undefined" && mode === "blob",

    refetchOnWindowFocus: false,
  });

  const state = data ?? emptyState;
  const value = useMemo(() => buildApi(state, queryClient), [state, queryClient]);
  const ruler = useRulerConfiguration();

  if (mode === "blob") {
    if (isError)
      return (
        <ConnectionError
          error={error}
          onRetry={() => void refetch()}
          resource={apiPath("/state")}
        />
      );
    if (isPending || !data) return <LoadingState />;
  }

  const unavailableRuler = ruler.unavailable;
  if (unavailableRuler)
    return (
      <ConnectionError
        error={unavailableRuler.error}
        onRetry={() => void unavailableRuler.refetch()}
        resource={apiPath("/config")}
      />
    );
  if (ruler.stillLoading) return <LoadingState />;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function LoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Carregando dados do time…</p>
      </div>
    </div>
  );
}

export function ConnectionError({
  error,
  onRetry,
  resource,
}: {
  error: unknown;
  onRetry: () => void;
  resource: string;
}) {
  const rawMessage = error instanceof Error ? error.message : "Erro desconhecido";
  if (import.meta.env.DEV) console.error(`[store] falha ao carregar ${resource}:`, error);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Não foi possível acessar o serviço
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente novamente em instantes. Se o problema continuar, contate o suporte.
        </p>
        {import.meta.env.DEV && (
          <p className="mt-2 text-xs text-muted-foreground">
            <strong>Dev:</strong> {rawMessage} — confira se o backend está no ar (
            <code>docker compose up -d</code>) e se <code>VITE_API_URL</code> aponta para ele.
          </p>
        )}
        <button
          onClick={onRetry}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Recarregar
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

export function useSelectors() {
  const store = useStore();
  return useMemo(() => createSelectors(store), [store]);
}
