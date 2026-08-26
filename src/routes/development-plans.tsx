import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { ArchitectSelectCombobox } from "@/components/app/ArchitectSelectCombobox";
import { CommandWithReasonDialog } from "@/components/app/CommandWithReasonDialog";
import { GapBadge, LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import {
  ACTION_TYPES,
  type ActionType,
  type DevelopmentPlan,
  type DevelopmentPlanItem,
  type DevelopmentPlanItemEvent,
  type PdiStatus,
  type SmartGoal,
} from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
import { useLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import type { Gap } from "@/lib/selectors";
import { useObjectiveFromGap, useSelectors, useStore } from "@/lib/store";
import { defaultDateFormatter } from "@/lib/text";
import { useAsyncSubmit } from "@/hooks/use-async-submit";
import { useSearchParamString } from "@/hooks/use-search-param";
import { DevelopmentPlansViewModel } from "@/lib/view-models/development-plans-view-model";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 61) — adaptador fino: memoiza o `DevelopmentPlansViewModel` sobre
 * a fatia de `useStore()` que ele precisa. Ver o arquivo do ViewModel para
 * o porquê do escopo (só ciclo de vida do plano, não a tela inteira).
 * CFG-03: o objetivo de PDI gerado de gap vem do template efetivo
 * (`text_templates`, fallback = seed) no locale ativo, injetado no
 * construtor — mesmo padrão de `useDashboardPresenter` com o limiar.
 */
function useDevelopmentPlansViewModel() {
  const store = useStore();
  const objectiveFromGap = useObjectiveFromGap();
  return useMemo(
    () => new DevelopmentPlansViewModel(store, objectiveFromGap),
    [store, objectiveFromGap],
  );
}

/**
 * `architectId` na URL — quem chega de outra tela (o perfil da pessoa, uma
 * lacuna específica) continua olhando para a mesma pessoa, em vez de cair no
 * primeiro arquiteto da lista e perder o contexto que trouxe até aqui. Ver
 * AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC H.
 */
const developmentPlansSearchSchema = z.object({
  architectId: z.string().optional(),
});

export const Route = createFileRoute("/development-plans")({
  validateSearch: developmentPlansSearchSchema,
  head: () => ({
    meta: [
      { title: "Planos de Desenvolvimento — Synapse" },
      {
        name: "description",
        content:
          "Plano de desenvolvimento individual: maiores gaps como ponto de partida, SMART goal e plano de ação escritos pela pessoa e pelo Tech Lead.",
      },
      { property: "og:title", content: "Planos de Desenvolvimento — Synapse" },
      {
        property: "og:description",
        content:
          "Planos de desenvolvimento individual com ações Learn, Practice, Apply, Teach, Mentor e Lead.",
      },
    ],
  }),
  component: PlansPage,
});

const STATUSES: PdiStatus[] = ["Not Started", "In Progress", "Blocked", "Completed"];

function PlansPage() {
  const sel = useSelectors();
  const labels = useLabels();
  const viewModel = useDevelopmentPlansViewModel();
  const [architectId, setArchitectId] = useSearchParamString(
    "architectId",
    () => sel.activeArchitects[0]?.id ?? "",
  );
  /** Item cujo formulário de meta SMART está aberto — nunca mais que um por vez. */
  const [smartEditingId, setSmartEditingId] = useState<string | null>(null);
  /** Gap escolhido para virar item de PDI — abre o formulário de ação real. */
  const [creatingForCompetencyId, setCreatingForCompetencyId] = useState<string | null>(null);
  const { t, locale } = useI18n();
  /** OO3-11/D-6 (reuso final) — os dois ciclos submitting/erro da tela vêm do hook compartilhado. */
  const creating = useAsyncSubmit(t("pdi.newItem.error"));
  const planTransition = useAsyncSubmit(t("pdi.plan.transitionError"));
  const help = usePageHelp("developmentPlans");
  const user = useCurrentUser();
  const architect = sel.architectById(architectId);
  /**
   * PDI é da pessoa — só ela, o Tech Lead responsável por ela (não Lead de
   * qualquer equipe), ou admin escreve; backend já recusa o resto
   * (`canActFor`, `auth/scope.ts`). Ver UX-001, AUDITORIA-QUINTA-RODADA-360-
   * SYNAPSE-2026-08-19.md.
   */
  const canEdit = defaultUiAuthorizationPolicy.canActFor(user, architect);
  const plan = sel.planFor(architectId);
  /**
   * ORIENTACAO-NONA-RODADA, Seção 5/11 (ENT-09-006) — só GAP de progressão
   * de verdade (`targetSemantics === "NEXT_ROLE"`) pode virar sugestão de
   * PDI aqui: o item nasce via `/from-gap`, que o servidor já rejeita para
   * assessments MASTERY. Usar `gapsFor` bruta ofereceria "Adicionar ao PDI"
   * para uma diferença que nunca vai conseguir criar o item.
   */
  const gaps = sel.progressionGapsFor(architectId).filter((g) => g.gap > 0);

  /**
   * Espelha `isLeadOf` do backend: só o Tech Lead atribuído (ou admin), nunca
   * a própria pessoa por ter conta lead/admin em outro contexto — usado para
   * decidir quais botões de aprovar/reabrir mostrar, não para autorizar nada
   * de verdade (o servidor recusa de qualquer forma).
   */
  const isLeadOfArchitect = defaultUiAuthorizationPolicy.isLeadOf(user, architect);
  const planStatus = plan?.status ?? "Draft";
  const canApprovePlan = plan && planStatus === "Draft" && isLeadOfArchitect;
  const canReturnToDraft = plan && planStatus === "Approved" && isLeadOfArchitect;
  const canCompletePlan = plan && planStatus === "Approved" && canEdit;
  /**
   * ENT-PDI-001 (AUDITORIA-ENTERPRISE-SYNAPSE-SEXTA-RODADA-2026-08-19.md,
   * Seção 5) — reabrir um PDI concluído é ação exclusiva do Tech Lead
   * RESPONSÁVEL por esta pessoa; `isAssignedTechLeadOf` não tem o bypass de
   * admin que `isLeadOf` tem. A própria pessoa (dona do PDI) só vê a
   * informação de que está bloqueado, nunca o botão.
   */
  const canReopenCompletedPlan =
    plan &&
    planStatus === "Completed" &&
    defaultUiAuthorizationPolicy.isAssignedTechLeadOf(user, architect);
  const ownerSeesLockedMessage =
    plan &&
    planStatus === "Completed" &&
    canEdit &&
    !defaultUiAuthorizationPolicy.isAssignedTechLeadOf(user, architect);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);

  /**
   * Espelha a régua de conclusão do backend (FASE 1 — "conclusão de PDI com
   * regras de negócio"): sem item nenhum, ou com algum item ainda "Não
   * iniciado", concluir deixaria o PDI parecer um resultado que não existe.
   * O botão nasce desabilitado nesses casos, em vez de deixar clicar e só
   * depois descobrir pelo 409. Ver AUDITORIA-QUINTA-RODADA-360-SYNAPSE-
   * 2026-08-19.md.
   */
  const incompletePlanReason = !plan
    ? undefined
    : plan.items.length === 0
      ? t("pdi.plan.incomplete.noItems")
      : plan.items.some((i) => i.status === "Not Started")
        ? t("pdi.plan.incomplete.notStarted")
        : undefined;

  /**
   * Espelha o backend (DOM-001): depois de `Approved`, item não muda mais de
   * escopo — nem cria item novo, nem edita competência/nível/objetivo/tipo/
   * prazo/prioridade, nem remove. Só os campos de execução (status, plano de
   * ação, meta SMART) continuam abertos até `Completed`, quando tudo trava.
   * Ver AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md.
   */
  const canEditDiagnostic = canEdit && planStatus === "Draft";
  const canEditExecution = canEdit && planStatus !== "Completed";

  const suggestions = viewModel.suggestions(gaps, plan);

  const creatingForGap = creatingForCompetencyId
    ? gaps.find((g) => g.item.competencyId === creatingForCompetencyId)
    : undefined;

  /**
   * `action` chama um dos métodos de transição do `DevelopmentPlansViewModel`
   * (`approve`/`complete`/`returnToDraft`) — o loading/erro local é o
   * `useAsyncSubmit` compartilhado (D-6), igual antes.
   */
  const runPlanTransition = (action: () => Promise<DevelopmentPlan>) => {
    if (!plan) return;
    void planTransition.run(action);
  };
  const planTransitioning = planTransition.submitting;

  return (
    <>
      <PageHeader
        title={t("pdi.title")}
        description={t("pdi.subtitle")}
        help={help}
        actions={
          <ArchitectSelectCombobox
            architects={sel.activeArchitects}
            selectedId={architectId}
            onChange={setArchitectId}
            label={t("pdi.architect")}
            className="w-48"
          />
        }
      />

      {plan && (
        <div className="mb-4 flex flex-wrap items-center gap-3 surface-inset px-3 py-2 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("pdi.plan.status")}
          </span>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
            {labels.planStatus[planStatus]}
          </span>
          {planStatus === "Completed" && (
            <span className="text-xs text-muted-foreground">{t("pdi.plan.locked")}</span>
          )}
          {planStatus === "Approved" && (
            <span className="text-xs text-muted-foreground">{t("pdi.plan.approvedHint")}</span>
          )}
          {plan.approvedAt && (planStatus === "Approved" || planStatus === "Completed") && (
            <span className="text-xs text-muted-foreground">
              {t("pdi.plan.approvedAt", {
                data: defaultDateFormatter.formatDate(plan.approvedAt, locale) ?? "",
              })}
            </span>
          )}
          {plan.completedAt && planStatus === "Completed" && (
            <span className="text-xs text-muted-foreground">
              {t("pdi.plan.completedAt", {
                data: defaultDateFormatter.formatDate(plan.completedAt, locale) ?? "",
              })}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {canApprovePlan && (
              <Button
                size="sm"
                disabled={planTransitioning}
                onClick={() => runPlanTransition(() => viewModel.approve(plan.id))}
              >
                {planTransitioning ? t("pdi.plan.approving") : t("pdi.plan.approve")}
              </Button>
            )}
            {canCompletePlan && (
              <Button
                size="sm"
                variant="secondary"
                disabled={planTransitioning || !!incompletePlanReason}
                title={incompletePlanReason}
                onClick={() => runPlanTransition(() => viewModel.complete(plan.id))}
              >
                {planTransitioning ? t("pdi.plan.completing") : t("pdi.plan.complete")}
              </Button>
            )}
            {canReturnToDraft && (
              <Button
                size="sm"
                variant="outline"
                disabled={planTransitioning}
                onClick={() => runPlanTransition(() => viewModel.returnToDraft(plan.id))}
              >
                {planTransitioning ? t("pdi.plan.returningToDraft") : t("pdi.plan.returnToDraft")}
              </Button>
            )}
            {canReopenCompletedPlan && (
              <Button size="sm" variant="outline" onClick={() => setReopenDialogOpen(true)}>
                {t("pdi.plan.reopen")}
              </Button>
            )}
          </div>
          {canCompletePlan && incompletePlanReason && (
            <p className="w-full text-xs text-muted-foreground">{incompletePlanReason}</p>
          )}
          {ownerSeesLockedMessage && (
            <p className="w-full text-xs text-muted-foreground">{t("pdi.plan.lockedForOwner")}</p>
          )}
          {planTransition.error && (
            <p className="w-full text-xs text-destructive">{planTransition.error}</p>
          )}
        </div>
      )}

      {plan && reopenDialogOpen && (
        <ReopenPlanDialog
          onClose={() => setReopenDialogOpen(false)}
          onSubmit={(reason) =>
            viewModel
              .reopen(plan.id, reason)
              .then(() => toast.success(t("pdi.plan.reopenDialog.success")))
          }
        />
      )}

      {/* R2-UX-04 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — minmax(0,1fr) na
          pista flexível: a fixa (320px) já tem tamanho definido, não corre o
          mesmo risco de min-content trap. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {(plan?.items ?? []).map((item) => {
            const comp = sel.competencyById(item.competencyId);
            /*
              A competência pode ter sido removida da matriz depois que o item
              do PDI foi criado — o gap que o gerou já não existe mais para
              recalcular o nome. Sem este retorno, `comp?.name` vira
              `undefined` e a string literal "undefined" vazava para dentro de
              frases inteiras (título, SMART goal), que é o bug relatado.
            */
            const competencyName = comp?.name ?? t("pdi.unknownCompetency");
            return (
              <div key={item.id} className="surface-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold">{competencyName}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.objective}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <LevelBadge level={item.currentLevel} />
                    <span className="text-muted-foreground">→</span>
                    <LevelBadge level={item.targetLevel} />
                    <GapBadge gap={item.targetLevel - item.currentLevel} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-5">
                  <Field label={t("pdi.field.actionType")}>
                    {canEditDiagnostic ? (
                      <select
                        className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                        value={item.actionType}
                        onChange={(e) =>
                          viewModel.setItemActionType(
                            plan!.id,
                            item.id,
                            e.target.value as ActionType,
                          )
                        }
                      >
                        {ACTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {labels.actionType[t]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="py-1.5 text-sm">{labels.actionType[item.actionType]}</p>
                    )}
                  </Field>
                  <Field label={t("pdi.field.status")}>
                    {canEditExecution ? (
                      <select
                        className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                        value={item.status}
                        onChange={(e) =>
                          viewModel.setItemStatus(plan!.id, item.id, e.target.value as PdiStatus)
                        }
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {labels.planItemStatus[s]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="py-1.5 text-sm">{labels.planItemStatus[item.status]}</p>
                    )}
                  </Field>
                  <Field label={t("pdi.field.priority")}>
                    <p className="py-1.5 text-sm">{labels.priority[item.priority]}</p>
                  </Field>
                  <Field label={t("pdi.field.dedication")}>
                    <p className="py-1.5 text-sm tabular-nums">
                      {item.dedicationHoursPerWeek != null
                        ? t("pdi.field.dedication.value", { horas: item.dedicationHoursPerWeek })
                        : "—"}
                    </p>
                  </Field>
                  <DeadlineField
                    planId={plan!.id}
                    item={item}
                    locale={locale}
                    canEditDraft={canEditDiagnostic}
                    canReschedule={canEditExecution && planStatus === "Approved"}
                  />
                </div>

                <ActionPlanField
                  value={item.actionPlan}
                  disabled={!canEditExecution}
                  onSave={(actionPlan) => viewModel.saveActionPlan(plan!.id, item.id, actionPlan)}
                />

                {item.smart && (
                  <div className="mt-4 rounded-lg border border-border bg-secondary/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      SMART Goal
                    </p>
                    <p className="mt-2 text-sm">{item.smart.statement}</p>
                    <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>
                        <dt className="font-medium text-foreground">Specific</dt>
                        <dd>{item.smart.specific}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Measurable</dt>
                        <dd>{item.smart.measurable}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Achievable</dt>
                        <dd>{item.smart.achievable}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Relevant</dt>
                        <dd>{item.smart.relevant}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-foreground">Time-bound</dt>
                        <dd>{item.smart.timeBound}</dd>
                      </div>
                    </dl>
                  </div>
                )}

                {!item.smart &&
                  (canEditExecution || canEditDiagnostic) &&
                  smartEditingId !== item.id && (
                    <div className="mt-4 flex items-center gap-2">
                      {canEditExecution && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSmartEditingId(item.id)}
                        >
                          {t("pdi.smart.define")}
                        </Button>
                      )}
                      {canEditDiagnostic && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            viewModel.removeItem(plan!.id, item.id);
                            toast.success(t("pdi.gap.removed.toast", { nome: competencyName }));
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("pdi.gap.remove")}
                        </Button>
                      )}
                    </div>
                  )}

                {!item.smart && canEditExecution && smartEditingId === item.id && (
                  <SmartGoalEditor
                    onCancel={() => setSmartEditingId(null)}
                    onSave={(smart) => {
                      viewModel.defineSmartGoal(plan!.id, item.id, smart);
                      setSmartEditingId(null);
                    }}
                  />
                )}

                <CheckinTimeline planId={plan!.id} item={item} canCheckin={canEditExecution} />
              </div>
            );
          })}
          {!plan?.items.length && (
            <SectionCard title={t("pdi.empty.title")} description={t("pdi.empty.subtitle")}>
              <p className="text-sm text-muted-foreground">O plano deste ciclo ainda está vazio.</p>
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard
            title={t("pdi.suggestions.title")}
            description={t("pdi.suggestions.subtitle")}
          >
            <ul className="space-y-2">
              {suggestions.map((g) => (
                <li key={g.item.competencyId} className="surface-inset p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{g.competency?.name}</p>
                    <GapBadge gap={g.gap} />
                  </div>
                  {canEditDiagnostic && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 px-0"
                      onClick={() => setCreatingForCompetencyId(g.item.competencyId)}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {t("pdi.suggestions.add")}
                    </Button>
                  )}
                </li>
              ))}
              {!suggestions.length && (
                <p className="text-sm text-muted-foreground">{t("pdi.suggestions.none")}</p>
              )}
            </ul>
          </SectionCard>

          <SectionCard
            title={t("pdi.actionModel.title")}
            description={t("pdi.actionModel.subtitle")}
          >
            <div className="flex flex-wrap gap-1.5">
              {ACTION_TYPES.map((t, i) => (
                <span key={t} className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium">
                  {i + 1}. {t}
                </span>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {creatingForGap && creatingForGap.competency && architect && (
        <NewPlanItemDialog
          gap={creatingForGap}
          submitting={creating.submitting}
          error={creating.error}
          onCancel={() => {
            creating.clearError();
            setCreatingForCompetencyId(null);
          }}
          onSave={async (draft) => {
            // Montagem do payload (id de cliente, startDate, objetivo) mora
            // no ViewModel — ver `DevelopmentPlansViewModel.createItemFromGap`.
            const result = await creating.run(() =>
              viewModel.createItemFromGap(architectId, creatingForGap, draft, architect.name),
            );
            if (result.ok) setCreatingForCompetencyId(null);
          }}
        />
      )}
    </>
  );
}

/**
 * Plano de ação: salva ao sair do campo (blur), não a cada tecla — antes
 * cada caractere digitado disparava um PATCH, inundando a API e deixando o
 * indicador de estado sem sentido (sempre "salvando"). O rascunho local só
 * é gravado quando a pessoa termina de editar; falha de rede já aparece via
 * toast global (`remote()` na store), este indicador é só o retorno visual
 * rápido de que o campo específico foi salvo. Ver AUDITORIA-QUARTA-REVISAO-
 * ESTADO-ATUAL-SYNAPSE.md, EPIC 3.
 */
function ActionPlanField({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (value: string) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (draft === value) return;
    onSave(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("pdi.field.actionPlan")}
        </p>
        {saved && <span className="text-xs text-emerald-600">{t("pdi.saved")}</span>}
      </div>
      <Textarea
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        placeholder={t("pdi.field.actionPlan.placeholder")}
      />
    </div>
  );
}

/**
 * ORIENTACAO-NONA-RODADA, Seção 7/14 (GES-007/ENT-09-010) — prazo é
 * editável em `Draft` como qualquer campo diagnóstico normal (o PATCH
 * genérico já aceita `targetDate` até aqui); em `Approved`, o mesmo PATCH
 * já bloqueia o campo no backend (`EXECUTION_FIELDS`), então a única forma
 * de mudar o prazo passa a ser o comando dedicado `Reprogramar prazo`
 * (motivo obrigatório, evento auditável). Nunca um input silencioso depois
 * de aprovado.
 */
function DeadlineField({
  planId,
  item,
  locale,
  canEditDraft,
  canReschedule,
}: {
  planId: string;
  item: DevelopmentPlanItem;
  locale: string;
  canEditDraft: boolean;
  canReschedule: boolean;
}) {
  const { t } = useI18n();
  const viewModel = useDevelopmentPlansViewModel();
  const [rescheduling, setRescheduling] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (canEditDraft) {
    return (
      <Field label={t("pdi.field.deadline")}>
        <input
          type="date"
          className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
          value={item.targetDate}
          onChange={(e) => viewModel.setItemTargetDate(planId, item.id, e.target.value)}
        />
      </Field>
    );
  }

  return (
    <Field label={t("pdi.field.deadline")}>
      <div className="flex flex-wrap items-center gap-2 py-1.5">
        <p className="text-sm tabular-nums">
          {defaultDateFormatter.formatDate(item.targetDate, locale)}
        </p>
        {canReschedule && (
          <Button
            size="sm"
            variant="ghost"
            className="h-auto px-1.5 py-0.5 text-xs"
            onClick={() => setRescheduling(true)}
          >
            {t("pdi.reschedule.action")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-auto px-1.5 py-0.5 text-xs text-muted-foreground"
          onClick={() => setHistoryOpen((open) => !open)}
        >
          {historyOpen ? t("pdi.reschedule.history.hide") : t("pdi.reschedule.history.show")}
        </Button>
      </div>
      {historyOpen && <ItemHistory planId={planId} itemId={item.id} locale={locale} />}
      {rescheduling && (
        <RescheduleDialog planId={planId} item={item} onClose={() => setRescheduling(false)} />
      )}
    </Field>
  );
}

/**
 * Histórico append-only de reprogramações — `GET /api/plans/:planId/items/
 * :itemId/events`. Sem otimismo (é leitura), buscado só quando a pessoa
 * pede para ver, não em toda renderização do card.
 */
function ItemHistory({
  planId,
  itemId,
  locale,
}: {
  planId: string;
  itemId: string;
  locale: string;
}) {
  const { t } = useI18n();
  const store = useStore();
  const [events, setEvents] = useState<DevelopmentPlanItemEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    store
      .planItemEvents(planId, itemId)
      .then((result) => {
        if (!cancelled) setEvents(result);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof ApiError ? e.message : t("pdi.reschedule.history.error"));
      });
    return () => {
      cancelled = true;
    };
  }, [planId, itemId, store, t]);

  if (error) return <p className="mt-1 text-xs text-destructive">{error}</p>;
  if (!events)
    return (
      <p className="mt-1 text-xs text-muted-foreground">{t("pdi.reschedule.history.loading")}</p>
    );
  if (events.length === 0) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">{t("pdi.reschedule.history.empty")}</p>
    );
  }

  return (
    <ul className="mt-1 space-y-1.5 border-t border-border pt-2">
      {events.map((e) => (
        <li key={e.id} className="text-xs text-muted-foreground">
          <p>
            {t("pdi.reschedule.history.entry", {
              de: e.fromTargetDate
                ? (defaultDateFormatter.formatDate(e.fromTargetDate, locale) ?? "")
                : "—",
              para: defaultDateFormatter.formatDate(e.toTargetDate, locale) ?? "",
            })}
          </p>
          <p>
            {t("pdi.reschedule.history.reason", { motivo: e.reason })} ·{" "}
            {defaultDateFormatter.formatDate(e.occurredAt, locale)}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * OO3-11 §3b (reuso final) — wrapper fino sobre `CommandWithReasonDialog`:
 * o comando (`DevelopmentPlansViewModel.reschedule`, OO3-10) e o ciclo
 * submitting/erro são o mecanismo compartilhado; aqui ficam só o campo
 * extra de data e os textos. Comportamentos preservados do original:
 * não fecha por clique fora/Esc enquanto envia, campos desabilitados
 * durante o envio e `role="alert"` no erro.
 */
function RescheduleDialog({
  planId,
  item,
  onClose,
}: {
  planId: string;
  item: DevelopmentPlanItem;
  /** Cancelou OU salvou — nos dois casos o pai só fecha o diálogo, como antes. */
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const viewModel = useDevelopmentPlansViewModel();
  const [targetDate, setTargetDate] = useState(item.targetDate);

  return (
    <CommandWithReasonDialog
      title={t("pdi.reschedule.title")}
      reasonInputId="reschedule-reason"
      reasonLabel={t("pdi.reschedule.reasonLabel")}
      reasonPlaceholder={t("pdi.reschedule.reasonPlaceholder")}
      confirmLabel={t("pdi.reschedule.confirm")}
      submittingLabel={t("pdi.reschedule.saving")}
      cancelLabel={t("pdi.newItem.cancel")}
      fallbackError={t("pdi.reschedule.error")}
      canSubmit={targetDate.length > 0}
      dismissibleWhileSubmitting={false}
      disableFieldsWhileSubmitting
      errorRole="alert"
      extraFields={({ submitting }) => (
        <div className="grid gap-3">
          <div>
            <Label>{t("pdi.reschedule.current")}</Label>
            <p className="mt-1 text-sm tabular-nums">
              {defaultDateFormatter.formatDate(item.targetDate, locale)}
            </p>
          </div>
          <div>
            <Label htmlFor="reschedule-target-date">{t("pdi.reschedule.new")}</Label>
            <input
              id="reschedule-target-date"
              type="date"
              disabled={submitting}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>
      )}
      onSubmit={(reason) => viewModel.reschedule(planId, item.id, targetDate, reason)}
      onClose={onClose}
    />
  );
}

/**
 * FASE 2 (quinta rodada) — "não há formalização de check-in. PDI é
 * atualizado, mas acompanhamento é implícito." Mudar `status` já
 * registrava o resultado; check-in registra o processo — uma nota datada,
 * de quem escreveu, sem mudar nenhum campo do item. Autor e data vêm
 * sempre do servidor (mesmo padrão de `CommentSection` em assessments.tsx):
 * a lista só reflete o que o servidor confirmou, sem otimismo. Ver
 * AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, Seção 11.
 */
function CheckinTimeline({
  planId,
  item,
  canCheckin,
}: {
  planId: string;
  item: DevelopmentPlanItem;
  canCheckin: boolean;
}) {
  const { t, locale } = useI18n();
  const user = useCurrentUser();
  const viewModel = useDevelopmentPlansViewModel();
  const [text, setText] = useState("");
  /** OO3-11/D-6 (reuso final) — ciclo submitting/erro compartilhado; só o "limpar rascunho no sucesso" é daqui. */
  const { submitting: saving, error, run } = useAsyncSubmit(t("pdi.checkin.error"));

  const submit = async () => {
    if (!text.trim() || saving) return;
    const result = await run(() => viewModel.addCheckin(planId, item.id, text));
    if (result.ok) setText("");
  };

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("pdi.checkin.title", { n: item.checkins.length })}
      </p>
      {item.checkins.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {item.checkins.map((c) => (
            <li key={c.id} className="text-sm">
              <span className="text-muted-foreground">
                {c.authorUserId === user.id ? t("comment.you") : t("pdi.checkin.someone")} ·{" "}
                {defaultDateFormatter.formatDate(c.createdAt, locale)}:
              </span>{" "}
              {c.text}
            </li>
          ))}
        </ul>
      )}
      {canCheckin && (
        <div className="flex items-center gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("pdi.checkin.placeholder")}
            aria-label={t("pdi.checkin.placeholder")}
            className="min-h-9 flex-1"
          />
          <Button size="sm" disabled={saving || !text.trim()} onClick={() => void submit()}>
            {saving ? t("pdi.checkin.saving") : t("pdi.checkin.save")}
          </Button>
        </div>
      )}
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Item de PDI real: tipo de ação, plano e prazo são escolhidos pela própria
 * pessoa aqui — antes um clique em "Adicionar ao PDI" já criava o item com
 * `actionType: "Learn"` e prazo de +4 meses fabricados, sem ninguém ter
 * decidido nada disso. Ver AUDITORIA-QUARTA-REVISAO-ESTADO-ATUAL-
 * SYNAPSE.md, EPIC 3.
 */
function NewPlanItemDialog({
  gap,
  submitting,
  error,
  onSave,
  onCancel,
}: {
  gap: Gap;
  submitting: boolean;
  error: string | null;
  onSave: (draft: {
    actionType: ActionType;
    actionPlan: string;
    targetDate: string;
    dedicationHoursPerWeek: number | null;
  }) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const labels = useLabels();
  const [actionType, setActionType] = useState<ActionType>("Learn");
  const [actionPlan, setActionPlan] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [dedication, setDedication] = useState("");
  const canSave = actionPlan.trim().length > 0 && targetDate.length > 0 && !submitting;

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("pdi.newItem.title", { competencia: gap.competency?.name ?? "" })}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {/**
           * ORIENTACAO-NONA-RODADA, Seção 11 — GAP oficial em read-only,
           * como contexto de origem; nunca prioridade calculada aqui — "não
           * duplicar o algoritmo de prioridade no frontend sequer para
           * preview antes da resposta do servidor" (Seção 11). A prioridade
           * de verdade só aparece no card do item, depois que o servidor
           * confirmou a criação.
           */}
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("pdi.newItem.officialGap")}
            </p>
            <p className="mt-1">
              {t("pdi.newItem.officialGapValue", { atual: gap.item.final, alvo: gap.item.target })}
            </p>
          </div>
          <div>
            <Label htmlFor="new-item-action-type">{t("pdi.field.actionType")}</Label>
            <select
              id="new-item-action-type"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={actionType}
              disabled={submitting}
              onChange={(e) => setActionType(e.target.value as ActionType)}
            >
              {ACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {labels.actionType[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="new-item-action-plan">{t("pdi.field.actionPlan")}</Label>
            <Textarea
              id="new-item-action-plan"
              className="mt-1"
              value={actionPlan}
              disabled={submitting}
              onChange={(e) => setActionPlan(e.target.value)}
              placeholder={t("pdi.field.actionPlan.placeholder")}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="new-item-target-date">{t("pdi.field.deadline")}</Label>
              <input
                id="new-item-target-date"
                type="date"
                min={defaultDateFormatter.todayIso()}
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={targetDate}
                disabled={submitting}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-item-dedication">{t("pdi.field.dedication")}</Label>
              <input
                id="new-item-dedication"
                type="number"
                min={0}
                step="0.5"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={dedication}
                disabled={submitting}
                placeholder={t("pdi.field.dedication.placeholder")}
                onChange={(e) => setDedication(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {t("pdi.newItem.cancel")}
          </Button>
          <Button
            disabled={!canSave}
            onClick={() =>
              onSave({
                actionType,
                actionPlan: actionPlan.trim(),
                targetDate,
                dedicationHoursPerWeek: dedication.trim() ? Number(dedication) : null,
              })
            }
          >
            {submitting ? t("pdi.newItem.saving") : t("pdi.newItem.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * ENT-PDI-001 (AUDITORIA-ENTERPRISE-SYNAPSE-SEXTA-RODADA-2026-08-19.md,
 * Seção 5) — motivo obrigatório: reabrir algo concluído é um comando de
 * negócio, não uma troca de campo qualquer, e o histórico (`PlanReopened`)
 * precisa desse motivo para fazer sentido depois.
 */
function ReopenPlanDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  /**
   * OO3-11c `[MUDA UI]` (aprovado em 2026-08-26) — o ciclo submitting/erro
   * saiu do componente pai: o erro de transição agora aparece DENTRO do
   * diálogo (padrão de `CommandWithReasonDialog`), não mais na barra de
   * status atrás dele.
   */
  return (
    <CommandWithReasonDialog
      title={t("pdi.plan.reopenDialog.title")}
      body={t("pdi.plan.reopenDialog.body")}
      reasonInputId="reopen-reason"
      reasonLabel={t("pdi.plan.reopenDialog.reasonLabel")}
      reasonPlaceholder={t("pdi.plan.reopenDialog.reasonPlaceholder")}
      confirmLabel={t("pdi.plan.reopenDialog.confirm")}
      submittingLabel={t("pdi.plan.reopening")}
      cancelLabel={t("pdi.plan.reopenDialog.cancel")}
      fallbackError={t("pdi.plan.transitionError")}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
}

const SMART_FIELDS = [
  { key: "specific", label: "Specific" },
  { key: "measurable", label: "Measurable" },
  { key: "achievable", label: "Achievable" },
  { key: "relevant", label: "Relevant" },
  { key: "timeBound", label: "Time-bound" },
] as const;

/**
 * Formulário da meta SMART: cada campo é escrito pela própria pessoa (ou pelo
 * Tech Lead), nada é preenchido sozinho. Antes um clique fabricava um texto
 * genérico idêntico para qualquer competência ("Duas entregas arquiteturais,
 * um ADR e uma sessão técnica" valia pra tudo) — a meta parecia elaborada sem
 * ninguém ter pensado nela. Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md,
 * Seção 33.
 */
function SmartGoalEditor({
  onSave,
  onCancel,
}: {
  onSave: (smart: SmartGoal) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<SmartGoal>({
    specific: "",
    measurable: "",
    achievable: "",
    relevant: "",
    timeBound: "",
    statement: "",
  });
  const canSave = Object.values(draft).every((v) => v.trim().length > 0);

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-border bg-secondary/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        SMART Goal
      </p>
      {SMART_FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label className="text-xs font-medium text-foreground" htmlFor={`smart-${key}`}>
            {label}
          </label>
          <Textarea
            id={`smart-${key}`}
            className="mt-1 min-h-12 text-sm"
            value={draft[key]}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          />
        </div>
      ))}
      <div>
        <label className="text-xs font-medium text-foreground" htmlFor="smart-statement">
          {t("pdi.smart.statement")}
        </label>
        <Textarea
          id="smart-statement"
          className="mt-1 min-h-16 text-sm"
          value={draft.statement}
          onChange={(e) => setDraft({ ...draft, statement: e.target.value })}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" disabled={!canSave} onClick={() => onSave(draft)}>
          {t("pdi.smart.save")}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
