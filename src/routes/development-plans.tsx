import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

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
  type PdiStatus,
  type SmartGoal,
} from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
import { useLabels } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { canActFor, isLeadOf } from "@/lib/scope";
import type { Gap } from "@/lib/selectors";
import { useSelectors, useStore } from "@/lib/store";
import { formatDate, initialSearchParam, todayIso } from "@/lib/text";

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
  const store = useStore();
  const sel = useSelectors();
  const labels = useLabels();
  const [architectId, setArchitectId] = useState(
    () => initialSearchParam("architectId") ?? sel.activeArchitects[0]?.id ?? "",
  );
  /** Item cujo formulário de meta SMART está aberto — nunca mais que um por vez. */
  const [smartEditingId, setSmartEditingId] = useState<string | null>(null);
  /** Gap escolhido para virar item de PDI — abre o formulário de ação real. */
  const [creatingForCompetencyId, setCreatingForCompetencyId] = useState<string | null>(null);
  const [planTransitioning, setPlanTransitioning] = useState(false);
  const [planTransitionError, setPlanTransitionError] = useState<string | null>(null);
  const { t, locale } = useI18n();
  const user = useCurrentUser();
  const architect = sel.architectById(architectId);
  /**
   * PDI é da pessoa — só ela, o Tech Lead responsável por ela (não Lead de
   * qualquer equipe), ou admin escreve; backend já recusa o resto
   * (`canActFor`, `auth/scope.ts`). Ver UX-001, AUDITORIA-QUINTA-RODADA-360-
   * SYNAPSE-2026-08-19.md.
   */
  const canEdit = canActFor(user, architect);
  const plan = sel.planFor(architectId);
  const gaps = sel.gapsFor(architectId).filter((g) => g.gap > 0);

  /**
   * Espelha `isLeadOf` do backend: só o Tech Lead atribuído (ou admin), nunca
   * a própria pessoa por ter conta lead/admin em outro contexto — usado para
   * decidir quais botões de aprovar/reabrir mostrar, não para autorizar nada
   * de verdade (o servidor recusa de qualquer forma).
   */
  const isLeadOfArchitect = isLeadOf(user, architect);
  const planStatus = plan?.status ?? "Draft";
  const canApprovePlan = plan && planStatus === "Draft" && isLeadOfArchitect;
  const canReopenPlan = plan && planStatus === "Approved" && isLeadOfArchitect;
  const canCompletePlan = plan && planStatus === "Approved" && canEdit;

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

  const suggestions = gaps
    .filter((g) => !plan?.items.some((i) => i.competencyId === g.item.competencyId))
    .slice(0, 5);

  const creatingForGap = creatingForCompetencyId
    ? gaps.find((g) => g.item.competencyId === creatingForCompetencyId)
    : undefined;

  const transitionPlan = (nextStatus: DevelopmentPlan["status"]) => {
    if (!plan) return;
    setPlanTransitionError(null);
    setPlanTransitioning(true);
    store
      .updatePlanStatus(plan.id, nextStatus)
      .catch((error: unknown) =>
        setPlanTransitionError(
          error instanceof ApiError ? error.message : t("pdi.plan.transitionError"),
        ),
      )
      .finally(() => setPlanTransitioning(false));
  };

  return (
    <>
      <PageHeader
        title={t("pdi.title")}
        description={t("pdi.subtitle")}
        actions={
          <select
            className="rounded-md border border-input bg-card px-3 py-2 text-sm"
            value={architectId}
            onChange={(e) => setArchitectId(e.target.value)}
          >
            {sel.activeArchitects.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
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
              {t("pdi.plan.approvedAt", { data: formatDate(plan.approvedAt, locale) ?? "" })}
            </span>
          )}
          {plan.completedAt && planStatus === "Completed" && (
            <span className="text-xs text-muted-foreground">
              {t("pdi.plan.completedAt", { data: formatDate(plan.completedAt, locale) ?? "" })}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {canApprovePlan && (
              <Button
                size="sm"
                disabled={planTransitioning}
                onClick={() => transitionPlan("Approved")}
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
                onClick={() => transitionPlan("Completed")}
              >
                {planTransitioning ? t("pdi.plan.completing") : t("pdi.plan.complete")}
              </Button>
            )}
            {canReopenPlan && (
              <Button
                size="sm"
                variant="outline"
                disabled={planTransitioning}
                onClick={() => transitionPlan("Draft")}
              >
                {planTransitioning ? t("pdi.plan.reopening") : t("pdi.plan.reopen")}
              </Button>
            )}
          </div>
          {canCompletePlan && incompletePlanReason && (
            <p className="w-full text-xs text-muted-foreground">{incompletePlanReason}</p>
          )}
          {planTransitionError && (
            <p className="w-full text-xs text-destructive">{planTransitionError}</p>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
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

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <Field label={t("pdi.field.actionType")}>
                    {canEditDiagnostic ? (
                      <select
                        className="w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                        value={item.actionType}
                        onChange={(e) =>
                          store.updatePlanItem(plan!.id, item.id, {
                            actionType: e.target.value as ActionType,
                          })
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
                          store.updatePlanItem(plan!.id, item.id, {
                            status: e.target.value as PdiStatus,
                          })
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
                  <Field label={t("pdi.field.deadline")}>
                    <p className="py-1.5 text-sm tabular-nums">
                      {formatDate(item.targetDate, locale)}
                    </p>
                  </Field>
                </div>

                <ActionPlanField
                  value={item.actionPlan}
                  disabled={!canEditExecution}
                  onSave={(actionPlan) => store.updatePlanItem(plan!.id, item.id, { actionPlan })}
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
                            store.removePlanItem(plan!.id, item.id);
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
                      store.updatePlanItem(plan!.id, item.id, { smart });
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
          onCancel={() => setCreatingForCompetencyId(null)}
          onSave={(draft) => {
            store.addPlanItem(architectId, {
              id: `pdi-${architectId}-${creatingForGap.item.competencyId}-${Date.now()}`,
              competencyId: creatingForGap.item.competencyId,
              currentLevel: creatingForGap.item.final,
              targetLevel: creatingForGap.item.target,
              objective: `Evoluir ${creatingForGap.competency?.name} do nível ${creatingForGap.item.final} para o nível ${creatingForGap.item.target}`,
              actionType: draft.actionType,
              actionPlan: draft.actionPlan,
              startDate: todayIso(),
              targetDate: draft.targetDate,
              priority:
                creatingForGap.gap >= 3 ? "Critical" : creatingForGap.gap === 2 ? "High" : "Medium",
              owner: architect.name,
              status: "Not Started",
              checkins: [],
            });
            setCreatingForCompetencyId(null);
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
  const store = useStore();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setError(null);
    setSaving(true);
    try {
      await store.addPlanItemCheckin(planId, item.id, trimmed);
      setText("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("pdi.checkin.error"));
    } finally {
      setSaving(false);
    }
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
                {formatDate(c.createdAt, locale)}:
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
  onSave,
  onCancel,
}: {
  gap: Gap;
  onSave: (draft: { actionType: ActionType; actionPlan: string; targetDate: string }) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const labels = useLabels();
  const [actionType, setActionType] = useState<ActionType>("Learn");
  const [actionPlan, setActionPlan] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const canSave = actionPlan.trim().length > 0 && targetDate.length > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("pdi.newItem.title", { competencia: gap.competency?.name ?? "" })}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="new-item-action-type">{t("pdi.field.actionType")}</Label>
            <select
              id="new-item-action-type"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={actionType}
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
              onChange={(e) => setActionPlan(e.target.value)}
              placeholder={t("pdi.field.actionPlan.placeholder")}
            />
          </div>
          <div>
            <Label htmlFor="new-item-target-date">{t("pdi.field.deadline")}</Label>
            <input
              id="new-item-target-date"
              type="date"
              min={todayIso()}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t("pdi.newItem.cancel")}
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => onSave({ actionType, actionPlan: actionPlan.trim(), targetDate })}
          >
            {t("pdi.newItem.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
