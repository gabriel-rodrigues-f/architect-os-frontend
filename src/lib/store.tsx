import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { toast } from "sonner";

import { api, type AppState, type CommentInput } from "./api";
import type { TextTemplateRecord } from "./gateways/config.gateway";
import type {
  Architect,
  Assessment,
  CareerLevel,
  CareerLevelPolicy,
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
} from "./domain";
import { withDefaultCurationPolicy, type CurationPolicy } from "./curation-policy";
import { useI18n } from "./i18n";
import { MutationRunner } from "./mutation-runner";
import {
  gapSeverityRulerFrom,
  withDefaultScoringBands,
  type GapSeverityRuler,
  type ScoringBand,
  type ScoringBands,
  type ScoringScale,
} from "./scoring-bands";
import { createSelectors, emptyState } from "./selectors";
import { defaultNameFormatter } from "./text";
import {
  objectiveFromGapRenderer,
  withDefaultTextTemplates,
  type RenderObjectiveFromGap,
  type TextTemplates,
} from "./text-templates";

export const STATE_QUERY_KEY = ["app-state"] as const;

/**
 * B-24 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, ADR-0011) —
 * primeira coleção migrada do agregador `/api/state` para o endpoint por
 * contexto já existente (`GET /api/career-levels`, nunca consumido até
 * aqui): busca própria, com cache/isolamento de falha independentes do
 * resto do estado — o próprio ponto do estrangulamento (Strangler Fig),
 * não um atalho de implementação. Mesmo padrão já usado pela tela de
 * Evolução (`architects.$architectId.evolution.tsx`, Rodada 10, `useQuery`
 * direto no componente, sem passar pelo `Api` agregado abaixo).
 */
export const CAREER_LEVELS_QUERY_KEY = ["career-levels"] as const;
export function useCareerLevelsByRank(): CareerLevel[] {
  const { data } = useQuery({ queryKey: CAREER_LEVELS_QUERY_KEY, queryFn: api.careerLevels });
  return [...(data ?? [])].sort((a, b) => a.rank - b.rank);
}

/**
 * CFG-02 — as réguas numéricas (`scoring_bands`) entram no ciclo de dados
 * pelo MESMO padrão de `careerLevels` acima: `useQuery` próprio, endpoint
 * por contexto (`GET /api/config/bands`), cache e isolamento de falha
 * independentes do resto do estado. Enquanto a consulta não resolve (ou se
 * falhar), `withDefaultScoringBands` completa com o default byte-idêntico
 * ao seed — comportamento igual ao hardcoded antigo, sem flash de UI.
 */
export const SCORING_BANDS_QUERY_KEY = ["config-bands"] as const;
export function useScoringBands(): ScoringBands {
  const { data } = useQuery({ queryKey: SCORING_BANDS_QUERY_KEY, queryFn: api.bands });
  return useMemo(() => withDefaultScoringBands(data), [data]);
}

/** A régua de gap EFETIVA (servidor com fallback) já na forma dos consumidores (OO3-11i). */
export function useGapSeverityRuler(): GapSeverityRuler {
  const bands = useScoringBands();
  return useMemo(() => gapSeverityRulerFrom(bands.GAP_SEVERITY), [bands]);
}

/**
 * CFG-03 — os templates de texto de domínio (`text_templates`) entram pelo
 * MESMO padrão de `useScoringBands` acima: `useQuery` próprio, endpoint por
 * contexto (`GET /api/config/templates`), cache e isolamento de falha
 * independentes do resto do estado. Enquanto a consulta não resolve (ou se
 * falhar), `withDefaultTextTemplates` completa com o default byte-idêntico
 * ao seed — comportamento igual ao hardcoded antigo.
 */
export const TEXT_TEMPLATES_QUERY_KEY = ["config-templates"] as const;
export function useTextTemplates(): TextTemplates {
  const { data } = useQuery({ queryKey: TEXT_TEMPLATES_QUERY_KEY, queryFn: api.templates });
  return useMemo(() => withDefaultTextTemplates(data), [data]);
}

/**
 * CFG-04 — a política de curadoria do catálogo (`catalog_curation_policy`)
 * entra pelo MESMO padrão de `useScoringBands`/`useTextTemplates` acima:
 * `useQuery` próprio, endpoint por contexto
 * (`GET /api/config/curation-policy`), cache e isolamento de falha
 * independentes do resto do estado. Enquanto a consulta não resolve (ou se
 * falhar), `withDefaultCurationPolicy` responde com o default 6/3+3
 * byte-idêntico ao seed — comportamento igual ao hardcoded antigo, sem
 * flash. É o que o hook adaptador da matriz injeta no
 * `CompetencyMatrixViewModel` (mesmo padrão de `useObjectiveFromGap` com o
 * `DevelopmentPlansViewModel`).
 */
export const CURATION_POLICY_QUERY_KEY = ["config-curation-policy"] as const;
export function useCurationPolicy(): CurationPolicy {
  const { data } = useQuery({ queryKey: CURATION_POLICY_QUERY_KEY, queryFn: api.curationPolicy });
  return useMemo(() => withDefaultCurationPolicy(data), [data]);
}

/**
 * O renderer EFETIVO do objetivo de PDI a partir de gap: template do
 * servidor (com fallback) no locale ATIVO do app — quem decide pt/en é o
 * mecanismo i18n existente (`useI18n().locale`), não uma escolha nova. É o
 * que o hook adaptador da tela injeta no `DevelopmentPlansViewModel`
 * (mesmo padrão de `useDashboardPresenter` com `criticalThreshold`).
 */
export function useObjectiveFromGap(): RenderObjectiveFromGap {
  const templates = useTextTemplates();
  const { locale } = useI18n();
  return useMemo(() => objectiveFromGapRenderer(templates, locale), [templates, locale]);
}

/**
 * A store deixou de guardar dados: o estado agora vive no backend (Postgres,
 * com cache em Redis). Este provider mantém a mesma API que as rotas já usavam
 * — leitura direta dos arrays e mutações imperativas — mas por trás cada
 * mutação atualiza o cache do React Query na hora (para a UI não travar em
 * sliders e selects) e envia a alteração para a API. Se a chamada falhar, o
 * snapshot é revalidado e a UI volta para a verdade do servidor.
 *
 * OO3-10 — exportada de propósito: as interfaces de serviço dos ViewModels
 * (`TeamRosterService`, `DevelopmentPlanService`, `CatalogService`, ...)
 * derivam daqui via `Pick<Api, ...>` em vez de recopiar assinaturas à mão —
 * qualquer divergência entre o que o ViewModel espera e o que `useStore()`
 * entrega vira erro de compilação neste arquivo, não um drift silencioso.
 */
export interface Api extends AppState {
  setActiveCycle: (id: string) => void;
  /** B-32 — id é gerado no servidor; sem otimismo (a UI só conhece o id real depois da resposta). */
  addArchitect: (a: Omit<Architect, "id" | "version">) => Promise<Architect>;
  updateArchitect: (id: string, patch: Partial<Omit<Architect, "id" | "role" | "version">>) => void;
  /**
   * ENT-CAR-017 — comando dedicado, sem otimismo: exige motivo e concorrência
   * otimista, mesmo motivo de `reopenPlan` (a tela precisa do erro de
   * verdade se a versão estiver desatualizada).
   */
  transitionCareerLevel: (
    id: string,
    toRole: Architect["role"],
    reason: string,
  ) => Promise<Architect>;
  /**
   * R2-UX-08/OO-03 — mesma forma de `transitionCareerLevel`: comando
   * dedicado, sem otimismo, exige motivo e concorrência otimista. O PATCH
   * antigo (`updateArchitect(id, { active: false })`) o backend passou a
   * recusar com 400 — a tela precisa do erro de verdade num 409 (alguém
   * mais mudou o cadastro desde que o diálogo abriu).
   */
  deactivate: (id: string, reason: string) => Promise<Architect>;
  /**
   * ORIENTACAO-NONA-RODADA, Seção 16 (ENT-09-009) — Política de Progressão.
   * Sem otimismo: só admin altera, e a tela de configuração precisa do
   * erro de verdade (ex.: abaixo do piso global de 3) para mostrar.
   */
  updateCareerLevelPolicy: (
    careerLevelId: string,
    minimumQualifiedCapabilities: number,
  ) => Promise<CareerLevelPolicy>;
  /**
   * CFG-02 (admin UI) — recalibra a régua de UMA escala de `scoring_bands`.
   * Sem otimismo (só admin altera, e a aba "Réguas e limiares" precisa do
   * 400 `INVALID_SCORING_BANDS` de verdade para mostrar no formulário); ao
   * sucesso invalida a query de bands (`SCORING_BANDS_QUERY_KEY`) — badges
   * e derivadores passam a responder pela régua nova.
   */
  updateScoringBands: (scale: ScoringScale, bands: ScoringBand[]) => Promise<ScoringBand[]>;
  /**
   * CFG-03 (admin UI) — edita o texto de UM template de domínio
   * (key/locale). Sem otimismo (mesmo racional de `updateScoringBands`); ao
   * sucesso invalida `TEXT_TEMPLATES_QUERY_KEY` — o objetivo de PDI gerado
   * passa a usar o texto novo.
   */
  updateTextTemplate: (
    key: string,
    locale: string,
    template: string,
  ) => Promise<TextTemplateRecord>;
  /**
   * CFG-04 (admin UI) — substitui a política de curadoria do catálogo. Sem
   * otimismo (mesmo racional de `updateScoringBands`; a aba "Catálogo"
   * precisa do 400 `INVALID_CATALOG_CURATION_POLICY` de verdade); ao
   * sucesso invalida `CURATION_POLICY_QUERY_KEY` E `STATE_QUERY_KEY` — o
   * backend já invalidou o cache dele (`NS.capabilities`), mas
   * `curation.status` das capacidades chega ao front pelo snapshot de
   * `/api/state`: sem refetch o admin continuaria vendo os badges
   * READY/REQUIRES_CURATION calculados com a política antiga.
   */
  updateCurationPolicy: (policy: CurationPolicy) => Promise<CurationPolicy>;
  /** B-32 — id é gerado no servidor; sem otimismo. */
  addCompetency: (c: Omit<Competency, "id">) => Promise<Competency>;
  updateCompetency: (id: string, patch: Partial<Omit<Competency, "id">>) => void;
  /** Apaga se a competência nunca foi usada; senão arquiva (active=false) — o resultado diz qual dos dois aconteceu. */
  removeCompetency: (id: string) => Promise<{ archived: boolean }>;
  /**
   * Troca RESTRICTIVE ↔ NON_RESTRICTIVE entre duas competências da mesma
   * capacidade — único jeito de sair de 3/3 (READY) sem passar por um
   * `PATCH` recusado. Ver `api.swapCompetencyRequirement`.
   */
  swapCompetencyRequirement: (id: string, withCompetencyId: string) => Promise<void>;
  /**
   * `curation` nunca vem do cliente — é sempre calculado pelo servidor a
   * partir das competências. B-32: `id` idem — sem otimismo.
   *
   * ORIENTACAO-BLOCO-2-UX-POR-TELA — `short` é opcional aqui (era
   * obrigatório): a dona do produto pediu para nunca mais digitar a sigla
   * manualmente, então o diálogo "Nova capacidade" parou de coletá-la — o
   * backend gera automaticamente a partir de `name`, com resolução de
   * colisão, quando o campo não vem no corpo.
   */
  addCapability: (
    c: Omit<Capability, "id" | "curation" | "short"> & { short?: string },
  ) => Promise<Capability>;
  updateCapability: (id: string, patch: Partial<Omit<Capability, "id" | "curation">>) => void;
  /** Apaga se nenhuma competência da capacidade já foi usada; senão arquiva a capacidade e as competências dela. */
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
  /**
   * ORIENTACAO-NONA-RODADA, Seção 4/11/30 (ENT-09-001/006) — único caminho
   * para criar um item de PDI a partir de um GAP oficial. O tipo do payload
   * nem tem `currentLevel`/`targetLevel`/`priority`: o servidor deriva os
   * três do assessment referenciado por `assessmentId`. Sem otimismo — o
   * servidor pode recusar (capacidade não confirmada, gap <= 0, MASTERY
   * sem próximo nível), e a tela precisa do erro de verdade, não de um item
   * que "aparece" na tela e depois some quando a chamada falhar.
   */
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
  /** Tira o item do PDI — a lacuna dele volta a aparecer como sugestão. */
  removePlanItem: (planId: string, itemId: string) => void;
  /**
   * Seção 14 (ENT-09-010) — reprogramar prazo depois de `Approved` é um
   * comando dedicado (motivo obrigatório), não um PATCH do campo. Sem
   * otimismo: a tela precisa saber se o servidor recusou (409 de versão,
   * 400 sem motivo) antes de mostrar o novo prazo como salvo.
   */
  reschedulePlanItem: (
    planId: string,
    itemId: string,
    targetDate: string,
    reason: string,
  ) => Promise<DevelopmentPlan>;
  /** Histórico append-only de reprogramações de um item. */
  planItemEvents: (planId: string, itemId: string) => Promise<DevelopmentPlanItemEvent[]>;
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
  /**
   * ENT-EVD-002 — reenvio depois de "Needs Improvement", fechando o loop de
   * feedback. Sem otimismo — mesmo motivo de `reviewEvidence`.
   */
  resubmitEvidence: (id: string, patch: { description?: string; url?: string }) => Promise<void>;
  /** Sem otimismo — mesmo motivo de `addEvidence`. Ver IDOR-002. */
  addMentoringSession: (
    m: MentoringSession,
    proficiencyUpdates?: ProficiencyUpdate[],
  ) => Promise<MentoringSession>;
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
  /**
   * OO3-09 (Fase OO-3) — o antigo par `local(fn)`/`remote(call, onReconcile)`
   * repetido em cada método virou o `MutationRunner` genérico
   * (`mutation-runner.ts`), que carrega o ciclo otimista inteiro (local →
   * remoto → reconciliação → rollback/erro) e o racional de B-09 ("409
   * espúrios") e do EPIC L (nunca falhar em silêncio). Aqui fica só a
   * fiação com o React Query e o toast — o runner não conhece nenhum dos dois.
   */
  const runner = new MutationRunner<AppState>(
    {
      update: (fn) =>
        queryClient.setQueryData<AppState>(STATE_QUERY_KEY, (prev) => (prev ? fn(prev) : prev)),
      invalidate: () => void queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY }),
    },
    (message) => toast.error(message),
    "Não foi possível salvar. A tela voltou ao último estado confirmado pelo servidor.",
  );

  return {
    ...state,
    capabilities: [...state.capabilities].sort(defaultNameFormatter.byName),

    setActiveCycle: (id) => {
      runner.optimistic(
        (s) => ({ ...s, activeCycleId: id }),
        () => api.setActiveCycle(id),
      );
    },

    /**
     * B-32 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, §41) — id
     * agora é gerado no servidor, então a tela não pode adivinhá-lo antes
     * da resposta chegar (o mesmo motivo de `addLearningPath`/`addEvidence`
     * não terem otimismo): navegar para `/architects/:id` ou atribuir o
     * registro recém-criado a algo antes da resposta real usaria um id que
     * nunca vai existir.
     */
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

    /**
     * CFG-02 (admin UI) — fora do `MutationRunner` de propósito: a régua não
     * vive no snapshot de `/api/state` (é a query própria
     * `SCORING_BANDS_QUERY_KEY`), então não há estado agregado para
     * reconciliar — o ciclo é PUT → invalidação da query de bands. O erro
     * sobe CRU para o call site (`useAsyncSubmit` da tela mostra a mensagem
     * do 400 de contiguidade).
     */
    updateScoringBands: async (scale, bands) => {
      const updated = await api.updateScoringBands(scale, bands);
      await queryClient.invalidateQueries({ queryKey: SCORING_BANDS_QUERY_KEY });
      return updated;
    },

    /** CFG-03 (admin UI) — mesmo formato de `updateScoringBands` acima, para a query de templates. */
    updateTextTemplate: async (key, locale, template) => {
      const updated = await api.updateTextTemplate(key, locale, template);
      await queryClient.invalidateQueries({ queryKey: TEXT_TEMPLATES_QUERY_KEY });
      return updated;
    },

    /**
     * CFG-04 (admin UI) — mesmo formato de `updateScoringBands` acima, com
     * uma invalidação a mais: além da query da política, o snapshot de
     * `/api/state` (`STATE_QUERY_KEY`), porque `curation.status` de cada
     * capacidade é derivado no servidor SOB a política — o refetch é o que
     * faz o admin VER o recomputo (o backend já invalidou `NS.capabilities`
     * no `UnitOfWork` do PUT).
     */
    updateCurationPolicy: async (policy) => {
      const updated = await api.updateCurationPolicy(policy);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CURATION_POLICY_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY }),
      ]);
      return updated;
    },

    updateCareerLevelPolicy: (careerLevelId, minimumQualifiedCapabilities) =>
      runner.command(
        () => api.updateCareerLevelPolicy(careerLevelId, minimumQualifiedCapabilities),
        (updated) => (s) => ({
          ...s,
          careerLevelPolicies: s.careerLevelPolicies.map((p) =>
            p.careerLevelId === careerLevelId ? updated : p,
          ),
        }),
      ),

    transitionCareerLevel: (id, toRole, reason) => {
      const expectedVersion = state.architects.find((a) => a.id === id)?.version ?? 1;
      return runner.command(
        () => api.transitionCareerLevel(id, toRole, reason, expectedVersion),
        (updated) => (s) => ({
          ...s,
          architects: s.architects.map((a) => (a.id === id ? updated : a)),
        }),
      );
    },

    /** R2-UX-08/OO-03 — mesmo formato de `transitionCareerLevel` acima. */
    deactivate: (id, reason) => {
      const expectedVersion = state.architects.find((a) => a.id === id)?.version ?? 1;
      return runner.command(
        () => api.deactivate(id, reason, expectedVersion),
        (updated) => (s) => ({
          ...s,
          architects: s.architects.map((a) => (a.id === id ? updated : a)),
        }),
      );
    },

    /** B-32 — id gerado no servidor; sem otimismo (ver `addArchitect`). */
    addCompetency: (c) =>
      runner.command(
        () => api.createCompetency(c),
        (created) => (s) => ({ ...s, competencies: [...s.competencies, created] }),
      ),

    updateCompetency: (id, patch) => {
      runner.optimistic(
        (s) => ({
          ...s,
          competencies: s.competencies.map((c) =>
            c.id === id
              ? { ...c, ...patch, expected: { ...c.expected, ...(patch.expected ?? {}) } }
              : c,
          ),
        }),
        () => api.updateCompetency(id, patch),
      );
    },

    /**
     * Sem otimismo aqui (`guarded`): o resultado só é conhecido depois que o
     * servidor responde (apagou ou arquivou), então a UI não pode decidir de
     * antemão o que remover da tela. Ver AUDITORIA-TERCEIRA-RODADA-
     * RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC C.
     */
    removeCompetency: (id) =>
      runner.guarded(
        async () => ({ archived: (await api.deleteCompetency(id))?.archived === true }),
        ({ archived }) =>
          (s) => ({
            ...s,
            competencies: archived
              ? s.competencies.map((c) => (c.id === id ? { ...c, active: false } : c))
              : s.competencies.filter((c) => c.id !== id),
          }),
      ),

    /**
     * Sem otimismo, mesma razão de `removeCompetency`: as duas competências
     * só mudam de tipo se o servidor confirmar a troca das duas juntas — a
     * UI não pode adivinhar isso antes.
     */
    swapCompetencyRequirement: async (id, withCompetencyId) => {
      await runner.guarded(
        () => api.swapCompetencyRequirement(id, withCompetencyId),
        ({ a, b }) =>
          (s) => ({
            ...s,
            competencies: s.competencies.map((c) => {
              if (c.id === a.id) return a;
              if (c.id === b.id) return b;
              return c;
            }),
          }),
      );
    },

    /**
     * B-32 — id gerado no servidor; sem otimismo (ver `addArchitect`). A
     * resposta já traz `curation` computada de verdade (0 competências →
     * REQUIRES_CURATION) — nada a reconstruir no cliente.
     */
    addCapability: (c) =>
      runner.command(
        () => api.createCapability(c),
        (created) => (s) => ({
          ...s,
          capabilities: [...s.capabilities, created].sort(defaultNameFormatter.byName),
        }),
      ),

    updateCapability: (id, patch) => {
      // ORIENTACAO-BLOCO-2-UX-POR-TELA — mesmo racional de B-09
      // (`updatePlanItem`, abaixo): desde que `short` deixou de vir do
      // formulário e passou a ser gerado/regenerado pelo servidor quando o
      // patch muda `name` sem mandar `short`, o palpite otimista (que só
      // aplica os campos que o cliente de fato mandou) não tem como prever
      // o novo `short` — sem reconciliar com a resposta real, o rótulo
      // compacto (heatmap/radar/export) ficaria mostrando a sigla antiga
      // até a próxima revalidação completa do estado.
      runner.optimistic(
        (s) => ({
          ...s,
          capabilities: s.capabilities
            .map((c) => (c.id === id ? { ...c, ...patch } : c))
            .sort(defaultNameFormatter.byName),
        }),
        () => api.updateCapability(id, patch),
        (updated) => (s) => ({
          ...s,
          capabilities: s.capabilities
            .map((c) => (c.id === id ? updated : c))
            .sort(defaultNameFormatter.byName),
        }),
      );
    },

    /** Excluir a capacidade remove junto as competências que pertenciam a ela. */
    /**
     * Excluir a capacidade nunca mexe em `assessments`: o backend não altera
     * avaliação histórica quando o catálogo muda (não há FK entre a linha
     * JSONB do item e a competência — a competência pode deixar de existir
     * sem que o registro do que foi perguntado na época mude). Antes, a
     * atualização otimista aqui apagava o item também da tela, na frente do
     * servidor — via de regra corrigido no próximo refetch, mas mostrando
     * por alguns instantes uma avaliação passada com menos itens do que ela
     * realmente tem salvo. Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md,
     * Seção 19.
     */
    removeCapability: (id) =>
      runner.guarded(
        () => api.deleteCapability(id),
        (result) => (s) => {
          if (result.archived) {
            return {
              ...s,
              capabilities: s.capabilities.map((c) => (c.id === id ? { ...c, active: false } : c)),
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
      ),

    // B-09/B-18 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md) —
    // `expectedVersion` vem do estado que a tela está mostrando agora;
    // reconcilia com a resposta real do servidor no sucesso (mesmo
    // raciocínio de `updatePlanItem`: sem isto, o `version` do cache
    // nunca avança, e a PRÓXIMA edição manda uma versão já defasada,
    // levando a um 409 sem conflito real nenhum).
    updateAssessmentItem: (assessmentId, competencyId, patch) => {
      const expectedVersion =
        state.assessments
          .find((a) => a.id === assessmentId)
          ?.items.find((i) => i.competencyId === competencyId)?.version ?? 1;
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

    /**
     * Sem resposta otimista: o id e a data de salvamento nascem no servidor, e
     * exibir uma data chutada pelo navegador seria mentira até a resposta voltar.
     * Vale para as três operações do par de comentários.
     */
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

    /**
     * ENT-09-001/006 — sem otimismo, ao contrário de `addPlanItem`: o
     * servidor pode recusar por várias razões de negócio (capacidade não
     * confirmada, gap <= 0, MASTERY), e o item só existe de fato depois da
     * resposta. `currentLevel`/`targetLevel`/`priority` nunca aparecem
     * aqui — nem o tipo do parâmetro os tem.
     */
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
      // `expectedVersion` vem do estado que a tela está mostrando agora —
      // concorrência otimista (ENT-DATA-012): se outra pessoa já escreveu
      // neste item, o servidor recusa com 409 e o runner revalida.
      const expectedVersion =
        state.plans.find((p) => p.id === planId)?.items.find((i) => i.id === itemId)?.version ?? 1;
      // B-09 — reconcilia com o plano de verdade no sucesso: sem isto, o
      // `version` do item ficava travado no palpite otimista (que este PATCH
      // nunca incrementa sozinho), e a PRÓXIMA edição mandava um
      // `expectedVersion` já defasado, levando a um 409 sem conflito real.
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

    reschedulePlanItem: (planId, itemId, targetDate, reason) => {
      const expectedVersion =
        state.plans.find((p) => p.id === planId)?.items.find((i) => i.id === itemId)?.version ?? 1;
      return runner.command(
        () => api.reschedulePlanItem(planId, itemId, targetDate, reason, expectedVersion),
        (updated) => (s) => ({
          ...s,
          plans: s.plans.map((p) => (p.id === planId ? updated : p)),
        }),
      );
    },

    /** Fora do runner: leitura pura, sem passo local nem cache a reconciliar. */
    planItemEvents: (planId, itemId) => api.planItemEvents(planId, itemId),

    updatePlanStatus: (planId, status) => {
      const expectedVersion = state.plans.find((p) => p.id === planId)?.version ?? 1;
      return runner.command(
        () => api.updatePlanStatus(planId, status, expectedVersion),
        (updated) => (s) => ({
          ...s,
          plans: s.plans.map((p) => (p.id === planId ? updated : p)),
        }),
      );
    },

    /**
     * Reabertura de PDI concluído (ENT-PDI-001) — comando dedicado, sem
     * otimismo: exige motivo e só o Tech Lead responsável, então a tela
     * precisa do erro de verdade se a autorização ou o motivo falharem.
     */
    reopenPlan: (planId, reason) => {
      const expectedVersion = state.plans.find((p) => p.id === planId)?.version ?? 1;
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

    /**
     * Sem otimismo: o servidor gera o id de verdade (nunca mais o `id`
     * enviado pelo cliente — ver AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-
     * 08-19.md, IDOR-001). Inserir a evidência localmente com um id
     * inventado antes da resposta deixaria o item com um id que nunca vai
     * bater com o do servidor, permanentemente, até o próximo refresh.
     */
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

    /** Sem otimismo — mesmo motivo de `addEvidence`: o id de verdade só existe depois da resposta. */
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

    /**
     * Trilha nova entra no topo da lista, igual à ordenação do servidor.
     * Sem otimismo — mesmo motivo de `addEvidence`: o id de verdade só
     * existe depois da resposta.
     */
    addLearningPath: (p) =>
      runner.command(
        () => api.createLearningPath(p),
        (created) => (s) => ({ ...s, learningPaths: [created, ...s.learningPaths] }),
      ),

    /** Progresso é por pessoa: só a entrada de (architectId, itemId) muda, nunca o item inteiro. */
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

    /**
     * Abrir assessment devolve o registro criado pelo servidor (uma linha por
     * competência) — sem otimismo, a resposta é a fonte do registro.
     */
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

    /*
      Awaitable, e não otimista: enviar para revisão, concluir ou reabrir é
      uma transição de negócio que pode ser negada (quem não é Tech Lead não
      finaliza nem reabre) — a tela precisa do erro de verdade para mostrar,
      não só reverter em silêncio depois de já ter pintado o novo status na
      hora do clique.
    */
    setAssessmentStatus: (id, status) => {
      // B-18 — mesmo raciocínio de `updateAssessmentItem`: `expectedVersion`
      // vem do estado atual, não de um valor fixo que o chamador precisaria
      // rastrear.
      const expectedVersion = state.assessments.find((a) => a.id === id)?.version ?? 1;
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
    /**
     * R2-TEC-19 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — `/api/state` é o BFF
     * agregador de todo o app (ADR-0011), não um endpoint barato; o default
     * do React Query (`refetchOnWindowFocus: true`) refaz essa busca INTEIRA
     * — incluindo `appStateSchema.parse` do payload todo — toda vez que a
     * aba/janela recupera o foco depois de `staleTime` (30s) vencido, um
     * padrão de uso comum (alternar abas, voltar pro navegador). Mutations
     * já invalidam a query explicitamente (`buildApi`, mais abaixo) — não
     * dependemos do refetch automático de foco pra ver mudanças próprias.
     */
    refetchOnWindowFocus: false,
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

/**
 * REVISAO-360-FRONTEND, FE-360-012 — a mensagem padrão nunca pode instruir
 * quem usa o produto a rodar `docker compose` ou conferir `VITE_API_URL`:
 * isso é instrução de desenvolvedor vazando pra tela de um usuário
 * enterprise. O detalhe técnico (inclusive a mensagem crua do erro) só
 * aparece em build de desenvolvimento (`import.meta.env.DEV`); em produção,
 * vai só pro console, pra quem for investigar via observabilidade/suporte.
 */
function ConnectionError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const rawMessage = error instanceof Error ? error.message : "Erro desconhecido";
  if (import.meta.env.DEV) console.error("[store] falha ao carregar /api/state:", error);

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

/* ---------- selectors / derived helpers ---------- */

export function useSelectors() {
  const s = useStore();
  return useMemo(() => createSelectors(s), [s]);
}
