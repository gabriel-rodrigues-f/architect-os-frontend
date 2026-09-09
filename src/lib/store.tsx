import { useQueries, useQuery, type QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { toast } from "sonner";

import { api, type AppState, type CommentInput } from "./api";
import { apiPath } from "./api-path";
import type {
  CapabilityFoundationPayload,
  CompetencyRemovalSummary,
} from "./gateways/catalog.gateway";
import type { TextTemplateRecord } from "./gateways/config.gateway";
import type { LearningPathPatch } from "./gateways/learning.gateway";
import type {
  Professional,
  Assessment,
  CareerLevel,
  Competency,
  Capability,
  DevelopmentCycle,
  DevelopmentPlan,
  DevelopmentPlanItem,
  DevelopmentPlanItemEvent,
  LearningItemProgress,
  LearningPath,
  LearningPathItem,
  Level,
  MentoringSession,
  RoleName,
  TeamLevelRule,
} from "./domain";
import { EffectiveCurationPolicy, type CurationPolicy } from "./curation-policy";
import {
  configurationCatalog,
  RulerConfiguration,
  TeamCareerLevelsQuery,
} from "./configuration-queries";
import { stateContextCatalog, UnrequestedSlice } from "./state-contexts";
import { ReadingRefusal } from "../components/app/ReadingRefusal";
import { ServiceOutageScreen } from "../components/app/ServiceOutageScreen";
import { ApiFailureReading } from "./api-failure-reading";
import { RefusalNumber } from "./refusal-number";
import { ServiceOutage } from "./service-outage";
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
import { ProfessionalRoster, createSelectors } from "./selectors";
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

export function useCareerLevelsByRank(): CareerLevel[] {
  const { data } = useQuery(configurationCatalog.careerLevels.options);
  return [...(data ?? [])].sort((a, b) => a.rank - b.rank);
}

/**
 * Dono (2026-09-08): a estrutura de níveis é do TIME. Toda tela que perguntava
 * "quais níveis existem?" passa a perguntar "quais níveis ESTE time usa?", e
 * esta é a pergunta.
 *
 * Sem time escolhido, a resposta é o catálogo da organização — é o caso do
 * cadastro que ainda não escolheu time e o da tela que fala da organização
 * inteira. A ordem é a que o time declarou (o degrau), não a do `rank`: quem
 * começa no Pleno tem o Pleno em primeiro.
 */
export function useTeamCareerLevels(teamId: string | null): CareerLevel[] {
  const organization = useCareerLevelsByRank();
  const { data } = useQuery({
    ...TeamCareerLevelsQuery.optionsOf(teamId ?? ""),
    enabled: teamId !== null,
  });
  if (teamId === null) return organization;
  return data?.levels ?? [];
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
  professionalsIncludingInactive: Professional[];

  updateProfessional: (
    id: string,
    patch: Partial<Omit<Professional, "id" | "role" | "version">>,
  ) => void;

  transitionCareerLevel: (id: string, toRole: RoleName, reason: string) => Promise<Professional>;

  deactivate: (id: string, reason: string) => Promise<Professional>;

  /** Reativar é o mesmo ato de desativar, de volta: profissional e conta juntos. */
  /** `onConfirmed` roda na resposta 2xx — o aviso de sucesso da mutação otimista mora lá (inventário 2026-09-08, §5.7). */
  reactivateProfessional: (id: string, expectedVersion: number, onConfirmed?: () => void) => void;

  allocateProfessionalToTeam: (
    professionalId: string,
    teamId: string,
    reason: string,
  ) => Promise<Professional>;
  releaseProfessionalFromTeam: (professionalId: string) => Promise<Professional>;

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
  renameCompetency: (id: string, name: string) => Promise<Competency>;
  updateCompetency: (id: string, patch: Partial<Omit<Competency, "id">>) => void;

  removeCompetency: (id: string) => Promise<{ archived: boolean }>;
  removeCompetencies: (competencyIds: string[]) => Promise<CompetencyRemovalSummary>;

  foundCapability: (foundation: CapabilityFoundationPayload) => Promise<Capability>;
  updateCapability: (id: string, patch: Partial<Omit<Capability, "id" | "curation">>) => void;

  removeCapability: (id: string) => Promise<{ archived: boolean; competenciesRemoved: number }>;
  addCycle: (c: DevelopmentCycle) => void;
  updateCycle: (id: string, patch: Partial<Omit<DevelopmentCycle, "id">>) => void;
  removeCycle: (id: string) => void;
  openAssessment: (professionalId: string, cycleId: string) => Promise<Assessment>;
  setAssessmentStatus: (id: string, status: Assessment["status"]) => Promise<Assessment>;
  updateLearningPath: (id: string, patch: LearningPathPatch) => void;
  removeLearningPath: (id: string, onConfirmed?: () => void) => void;
  /** Fatia PRAZOS: inscrever de novo quem estourou o prazo da trilha. */
  renewLearningPathEnrollment: (pathId: string, professionalId: string) => Promise<LearningPath>;
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
  addPlanItem: (professionalId: string, item: DevelopmentPlanItem) => void;

  createPlanItemFromGap: (
    professionalId: string,
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

  removePlanItem: (planId: string, itemId: string, onConfirmed?: () => void) => void;

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

  addMentoringSession: (m: MentoringSession) => Promise<MentoringSession>;

  scheduleMentoringFollowUp: (id: string, nextSession: string | null) => Promise<MentoringSession>;
  updateLearningItemProgress: (
    pathId: string,
    professionalId: string,
    itemId: string,
    progress: number,
  ) => void;

  addLearningPath: (p: LearningPath) => Promise<LearningPath>;
}

const Ctx = createContext<Api | null>(null);

export { Ctx as StoreApiContext };

export const MUTATION_FALLBACK_ERROR_MESSAGE =
  "Não foi possível salvar. A tela voltou ao último estado confirmado pelo servidor.";

export function buildApi(
  state: AppState,
  queryClient: QueryClient,
  cache: MutationCache<AppState>,
): Api {
  const runner = new MutationRunner<AppState>(
    cache,
    (message) => toast.error(message),
    MUTATION_FALLBACK_ERROR_MESSAGE,
  );

  const refreshCurationCounts = <T,>(result: T): T => {
    void stateContextCatalog.invalidateAll(queryClient);
    return result;
  };

  return {
    ...state,
    // A fatia que a tela não pediu passa intocada: ordenar ou filtrar já seria
    // ler (ver `UnrequestedSlice`) — quem lê é a tela, e aí a catraca fala.
    capabilities: UnrequestedSlice.is(state.capabilities)
      ? state.capabilities
      : [...state.capabilities].sort(defaultNameFormatter.byName),

    professionals: UnrequestedSlice.is(state.professionals)
      ? state.professionals
      : ProfessionalRoster.active(state.professionals),
    // O gerente nunca é SUJEITO em tela nenhuma — nem no Time (dono, 2026-09-06).
    professionalsIncludingInactive: UnrequestedSlice.is(state.professionals)
      ? state.professionals
      : ProfessionalRoster.professionals(state.professionals),

    // ONDA 45 — `addProfessional` morreu com `POST /professionals`, a porta legada
    // que criava PROFISSIONAL sem conta. Nenhuma tela a chamava; ela existia
    // como um caminho aberto para produzir alguém que aparece em Time e nunca
    // em Usuários. Quem cadastra pessoa é a admissão, em Usuários.

    updateProfessional: (id, patch) => {
      runner.optimistic(
        (s) => ({
          ...s,
          professionals: s.professionals.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }),
        () => api.updateProfessional(id, patch),
      );
    },

    reactivateProfessional: (id, expectedVersion, onConfirmed) => {
      runner.optimistic(
        (state) => ({
          ...state,
          professionals: state.professionals.map((professional) =>
            professional.id === id ? { ...professional, active: true } : professional,
          ),
        }),
        () => api.reactivate(id, expectedVersion),
        (updated) => (state) => ({
          ...state,
          professionals: state.professionals.map((professional) =>
            professional.id === id ? updated : professional,
          ),
        }),
        onConfirmed,
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
        stateContextCatalog.invalidateAll(queryClient),
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
        invalidations.push(stateContextCatalog.invalidateAll(queryClient));
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
      await stateContextCatalog.invalidateAll(queryClient);
      return summary;
    },

    /**
     * REGRA 18 (dono, 2026-09-09) — a leitura prévia da régua engole o 404
     * porque a régua do nível é exceção nomeada e ali ele quer dizer "ainda
     * não definida": sem régua, o PUT nasce com as listas vazias, que é o
     * certo. Se a rota entrar na troca, engolir a recusa faria este comando
     * SOBRESCREVER a régua com `capabilityIds` e `competencies` vazios — a
     * recusa sumiria da tela e ainda apagaria dado. A assinatura da exceção
     * mora em `RefusalNumber`.
     */
    defineTeamRuleMinimum: (teamId, careerLevelId, minimumQualifiedCapabilities) =>
      runner.command(
        async () => {
          const current = await api.teamRule(teamId, careerLevelId).catch((error: unknown) => {
            if (RefusalNumber.answersAbsenceOn("regua-do-nivel", error)) return undefined;
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
        state.professionals.find((a) => a.id === id)?.version,
        "deste profissional",
        id,
      );
      return runner.command(
        () => api.transitionCareerLevel(id, toRole, reason, expectedVersion),
        (updated) => (s) => ({
          ...s,
          professionals: s.professionals.map((a) => (a.id === id ? updated : a)),
        }),
      );
    },

    deactivate: async (id, reason) => {
      const expectedVersion = expectedVersionOf(
        state.professionals.find((a) => a.id === id)?.version,
        "deste profissional",
        id,
      );
      return runner.command(
        () => api.deactivate(id, reason, expectedVersion),
        (updated) => (s) => ({
          ...s,
          professionals: s.professionals.map((a) => (a.id === id ? updated : a)),
        }),
      );
    },

    allocateProfessionalToTeam: (professionalId, teamId, reason) =>
      runner.command(
        () => api.allocateProfessionalToTeam(professionalId, teamId, reason),
        (allocated) => (state) => ({
          ...state,
          professionals: state.professionals.map((professional) =>
            professional.id === professionalId ? allocated : professional,
          ),
        }),
      ),

    releaseProfessionalFromTeam: (professionalId) =>
      runner.command(
        () => api.releaseProfessionalFromTeam(professionalId),
        (released) => (state) => ({
          ...state,
          professionals: state.professionals.map((professional) =>
            professional.id === professionalId ? released : professional,
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

    renameCompetency: (id, name) =>
      runner
        .guarded(
          () => api.updateCompetency(id, { name }),
          (renamed) => (current) => ({
            ...current,
            competencies: current.competencies.map((competency) =>
              competency.id === id ? renamed : competency,
            ),
          }),
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

    addPlanItem: (professionalId, item) => {
      runner.optimistic(
        (s) => {
          const existing = s.plans.find(
            (p) => p.professionalId === professionalId && p.cycleId === s.activeCycleId,
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
                id: `pdi-${professionalId}-${s.activeCycleId}`,
                professionalId,
                cycleId: s.activeCycleId,
                status: "Draft",
                items: [item],
                version: 1,
              },
            ],
          };
        },
        () => api.addPlanItem(professionalId, state.activeCycleId, item),
      );
    },

    createPlanItemFromGap: (professionalId, item) =>
      runner.command(
        () => api.createPlanItemFromGap(professionalId, item),
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

    removePlanItem: (planId, itemId, onConfirmed) => {
      runner.optimistic(
        (s) => ({
          ...s,
          plans: s.plans.map((p) =>
            p.id !== planId ? p : { ...p, items: p.items.filter((i) => i.id !== itemId) },
          ),
        }),
        () => api.removePlanItem(planId, itemId),
        undefined,
        onConfirmed,
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

    addMentoringSession: (m) =>
      runner.command(
        () => api.createMentoringSession(m),
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

    renewLearningPathEnrollment: (pathId, professionalId) =>
      runner.command(
        () => api.renewLearningPathEnrollment(pathId, professionalId),
        (renewed) => (estado) => ({
          ...estado,
          learningPaths: estado.learningPaths.map((trilha) =>
            trilha.id === pathId ? renewed : trilha,
          ),
        }),
      ),

    updateLearningItemProgress: (pathId, professionalId, itemId, progress) => {
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
                    (e) => e.professionalId === professionalId && e.itemId === itemId,
                  )
                    ? p.progress.map((e) =>
                        e.professionalId === professionalId && e.itemId === itemId
                          ? { ...e, progress, status }
                          : e,
                      )
                    : [...p.progress, { professionalId, itemId, progress, status }],
                },
          ),
        }),
        () => api.patchLearningItemProgress(pathId, professionalId, itemId, progress),
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

    openAssessment: (professionalId, cycleId) =>
      runner.command(
        () => api.openAssessment(professionalId, cycleId),
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

    removeLearningPath: (id, onConfirmed) => {
      runner.optimistic(
        (s) => ({ ...s, learningPaths: s.learningPaths.filter((p) => p.id !== id) }),
        () => api.deleteLearningPath(id),
        undefined,
        onConfirmed,
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

/**
 * ADR-0011, encerrado — o blob `/state` morreu. O provedor não carrega mais
 * estado nenhum: cada rota monta o `<ContextScope>` com as fatias que lê, e é
 * ele quem provê a API do store. O que sobrou aqui é a régua da organização
 * (`/config/*`), que toda tela precisa antes de desenhar.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const ruler = useRulerConfiguration();

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

  return <>{children}</>;
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

/**
 * A LEITURA QUE NÃO VEIO — e o que a tela faz com isso.
 *
 * Dono (2026-09-09): *"um 404 de uma rota derrubou três telas de uma vez"*.
 * Esta peça desenhava a tela de queda, com a corrida de carreira, para
 * QUALQUER falha de consulta — um 404, um 403, um recurso que ainda não
 * existe, tudo virava "o serviço caiu" e apagava a aplicação inteira.
 *
 * A régua é a da `ServiceOutage`, e ela não é sobre a gravidade da falha: é
 * sobre a aplicação ter conseguido FALAR com a casa. Sem resposta, ou a casa
 * dizendo que não consegue responder (5xx), é queda e a tela é a do jogo.
 * 404, 403 e 409 são RESPOSTAS: a casa falou, a falha fica contida no lugar
 * dela e o resto da tela continua de pé.
 */
export function ConnectionError({
  error,
  onRetry,
  resource,
}: {
  error: unknown;
  onRetry: () => void;
  resource: string;
}) {
  if (import.meta.env.DEV) console.error(`[store] falha ao carregar ${resource}:`, error);

  if (!ServiceOutage.isOutage(error)) return <ReadingRefused error={error} onRetry={onRetry} />;

  // Dono (2026-09-06): a tela de indisponibilidade é UMA, com a corrida de carreira.
  return (
    <ServiceOutageScreen
      onRetry={onRetry}
      diagnostics={
        import.meta.env.DEV ? (
          <p className="mt-2 text-xs text-muted-foreground">
            <strong>Dev:</strong> {error instanceof Error ? error.message : "Erro desconhecido"} —
            confira se o backend está no ar (<code>docker compose up -d</code>) e se{" "}
            <code>VITE_API_URL</code> aponta para ele.
          </p>
        ) : undefined
      }
    />
  );
}

/**
 * A casa RESPONDEU e a resposta foi uma recusa. A frase é a da SITUAÇÃO, na
 * língua de quem lê — nunca a que o serviço escreveu, que só existe em pt-BR
 * e, num 404 do próprio backend, é o eco do método e da URL.
 */
function ReadingRefused({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
      <ReadingRefusal
        sentence={t(ApiFailureReading.ofFailure(error).messageKey)}
        onRetry={onRetry}
      />
    </div>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within ContextScope");
  return ctx;
}

/**
 * Os selectors indexam a lista CRUA de propósito: `professionalById` precisa
 * resolver quem foi desativado para a ficha aberta pelo link de `/team`
 * continuar de pé. Quem lista, seleciona, desenha ou conta gente consome
 * `store.professionals` (já ativa) ou `sel.activeProfessionals`.
 */
export function useSelectors() {
  const store = useStore();
  return useMemo(
    () => createSelectors({ ...store, professionals: store.professionalsIncludingInactive }),
    [store],
  );
}
