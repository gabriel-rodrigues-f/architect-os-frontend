import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { GapBadge, LevelBadge, SectionCard } from "@/components/app/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { QuerySection } from "@/components/app/QuerySection";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type {
  Architect,
  Assessment,
  AssessmentComment,
  AssessmentDevelopmentSummary,
  AssessmentItem,
  Capability,
  Competency,
  Level,
} from "@/lib/domain";
import { api, ApiError, type CommentInput } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { useNarrowViewport } from "@/hooks/use-narrow-viewport";
import { useI18n, type I18nApi } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { STATE_QUERY_KEY, useStore } from "@/lib/store";
import { defaultDateFormatter } from "@/lib/text";
import { AssessmentViewModel } from "@/lib/view-models/assessment-view-model";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — adaptador fino: memoiza o `AssessmentViewModel` sobre a
 * fatia de `useStore()` (nota por competência + comentários) e `api`
 * (portfólio de capacidades + resumo de desenvolvimento, que nunca passaram
 * por `store` — ver a doc do ViewModel para o porquê). Usado por todo
 * componente deste arquivo que precisa de uma das duas famílias de ação;
 * não exportado porque nenhum outro arquivo desta PR consome o ViewModel
 * diretamente (a rota `assessments.tsx` continua só pelos componentes
 * já exportados).
 */
function useAssessmentViewModel(): AssessmentViewModel {
  const store = useStore();
  return useMemo(() => new AssessmentViewModel(store, api, defaultUiAuthorizationPolicy), [store]);
}

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-34 (§12) — `/assessments`
 * era um único arquivo de ~1360 linhas. Diferente de `/mentoring` e `/team`,
 * já nascia decomposto em vários subcomponentes autocontidos (cada um com o
 * próprio estado): a extração aqui é, na maior parte, um move literal de
 * arquivo, não uma nova divisão de um monólito. A única peça que não existia
 * como componente separado — o bloco de flags de permissão/lifecycle que
 * espelha `checkAssessmentWrite` do backend — vira `useAssessmentPermissions`,
 * no mesmo espírito de como `/mentoring` extraiu `useMentoringTimeline`.
 */

/**
 * Quem pode escrever o quê agora — espelha `checkAssessmentWrite` do
 * backend exatamente: dono primeiro (`isOwner`), e `isLead` só considera o
 * vínculo real (`architect.leadUserId`) — nunca só o papel da conta — e é
 * mutuamente exclusivo com `isOwner` (a mesma pessoa nunca é "dono e Lead"
 * ao mesmo tempo, mesmo se a conta também administra ou lidera outras
 * equipes; evita autorrevisão de líder/final). Sem isto, o campo nascia
 * editável para um Lead de outra equipe, que só descobria pelo 403 tardio
 * que não podia. Ver PLANO-360-AGENTES-SYNAPSE.md, Seção 9, e UX-001,
 * AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md.
 *
 * Cada campo só abre na etapa certa do lifecycle, não em qualquer momento
 * "antes de Completed": a autoavaliação fecha assim que vai para revisão
 * (senão a pessoa continuaria ajustando a própria nota depois de pedir
 * avaliação do Tech Lead); líder/final só abrem quando a revisão já
 * começou (senão o Tech Lead calibraria a nota final antes de a
 * autoavaliação existir). Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md,
 * Seção 2–4.
 *
 * Espelha a completude que o backend já exige na transição (DOM-002): o
 * botão nasce desabilitado com uma explicação em vez de deixar a pessoa
 * tentar e só descobrir pelo erro do servidor que faltou preencher algo.
 * Ver AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md.
 *
 * OO2-08 — o cômputo em si mudou para `AssessmentViewModel.permissionsFor`
 * (puro, sem hook nenhum por trás); isto ficou um adaptador fino que só
 * resolve `useCurrentUser()` e o ViewModel memoizado.
 */
export function useAssessmentPermissions(
  architectId: string,
  selectedArchitect: Architect | undefined,
  assessment: Assessment | undefined,
) {
  const user = useCurrentUser();
  const viewModel = useAssessmentViewModel();
  return viewModel.permissionsFor(user, architectId, selectedArchitect, assessment);
}

/** O rótulo da coluna Notas mostra quantos comentários a competência já tem. */
function commentCountLabel(total: number, t: I18nApi["t"]) {
  if (total === 0) return t("comment.count.none");
  return total === 1 ? t("comment.count.one") : t("comment.count.many", { n: total });
}

/**
 * Comentários de uma competência: cada mensagem pertence a quem escreveu — não
 * é mais um par obrigatório salvo junto (ver AUDITORIA-RIGIDA-SEGUNDA-
 * REVISAO-SYNAPSE.md, Seção 5). Só o autor edita ou exclui a própria fala; um
 * comentário herdado do formato antigo, sem autor conhecido, fica só leitura
 * para todo mundo.
 *
 * O texto novo só aparece na lista após o servidor confirmar, porque é ele quem
 * carimba a data.
 */
function CommentSection({
  comments,
  currentUserId,
  onCreate,
  onUpdate,
  onDelete,
}: {
  comments: readonly AssessmentComment[];
  currentUserId: string;
  onCreate: (input: CommentInput) => Promise<unknown>;
  onUpdate: (commentId: string, input: CommentInput) => Promise<unknown>;
  onDelete: (commentId: string) => Promise<unknown>;
}) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AssessmentComment | null>(null);

  return (
    <div className="space-y-3">
      {comments.length > 0 && (
        <ul className="space-y-2">
          {comments.map((comment) => {
            const mine = comment.authorUserId !== null && comment.authorUserId === currentUserId;
            const authorLabel = mine
              ? t("comment.you")
              : comment.authorRole === "TECH_LEAD"
                ? t("comment.author.techLead")
                : t("comment.author.professional");
            return editing === comment.id ? (
              <li key={comment.id}>
                <CommentForm
                  initial={comment}
                  submitLabel={t("comment.saveChanges")}
                  onSubmit={(input) => onUpdate(comment.id, input).then(() => setEditing(null))}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={comment.id} className="rounded-md border border-border bg-card p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {authorLabel}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{comment.text}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">
                    {t("comment.savedAt", {
                      data: defaultDateFormatter.formatDate(comment.createdAt, locale) ?? "",
                    })}
                    {comment.updatedAt &&
                      ` · ${t("comment.editedAt", { data: defaultDateFormatter.formatDate(comment.updatedAt, locale) ?? "" })}`}
                  </p>
                  {mine && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setEditing(comment.id)}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-destructive hover:underline"
                        onClick={() => setConfirmDelete(comment)}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CommentForm submitLabel={t("common.save")} onSubmit={onCreate} />

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("comment.delete.title")}
        description={t("comment.delete.hint")}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const alvo = confirmDelete;
          setConfirmDelete(null);
          if (alvo) void onDelete(alvo.id);
        }}
      />
    </div>
  );
}

/** Formulário de um comentário — criação ou edição da própria fala. */
function CommentForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: AssessmentComment;
  submitLabel: string;
  onSubmit: (input: CommentInput) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState(initial?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = text.trim();

  const submit = () => {
    if (!trimmed || saving) return;
    setError(null);
    setSaving(true);
    onSubmit({ text: trimmed })
      .then(() => {
        if (!initial) setText("");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t("comment.saveError")))
      .finally(() => setSaving(false));
  };

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("comment.placeholder")}
        aria-label={t("comment.placeholder")}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" role="status">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : !trimmed ? (
            t("comment.needText")
          ) : null}
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <Button size="sm" variant="outline" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
          )}
          <Button size="sm" disabled={saving || !trimmed} onClick={submit}>
            {saving ? t("comment.saving") : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** R2-VIS-01 — mapeia o status para um dos 3 tons genéricos de `StatusBadge`. */
export const assessmentStatusTone: Record<Assessment["status"], "neutral" | "progress" | "done"> = {
  Draft: "neutral",
  "In Review": "progress",
  Completed: "done",
};

/**
 * ENT-CAR-014/015/016 — portfólio individual de capacidades: quais contam
 * para elegibilidade de carreira NESTE assessment. "Profissional propõe"
 * (dono adiciona/remove enquanto `Draft`), "Tech Lead confirma" (enquanto
 * `In Review`) — mesma governança do resto do assessment, só que aplicada
 * a um recorte adicional, não às notas em si. Mínimo de 3 é regra real do
 * backend desde a oitava rodada (não mais só orientação de UI).
 *
 * ORIENTACAO-NONA-RODADA, Seção 8 — cinco problemas corrigidos nesta
 * versão: (1) só oferece capacidade `READY` para propor; (2) invalida
 * também o estado principal do app depois de add/remove, não só a
 * elegibilidade — sem isto o Assessment em `store` continuava com `items`
 * antigos até um reload manual; (3) remover capacidade já respondida pede
 * confirmação explícita antes de `force=true`; (4) loading/error de
 * verdade em vez de `return null`; (5) dois números claramente
 * distintos — tamanho do portfólio do ciclo (mínimo 3) × quantas estão
 * qualificadas para o próximo nível.
 */
export function CareerPortfolioSection({
  assessment,
  isOwner,
  isLead,
}: {
  assessment: Assessment;
  isOwner: boolean;
  isLead: boolean;
}) {
  const store = useStore();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const viewModel = useAssessmentViewModel();
  const [selectedCapabilityId, setSelectedCapabilityId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; name: string } | null>(null);

  const queryKey = ["assessment-eligibility", assessment.id];
  const {
    data: eligibility,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => api.assessmentEligibility(assessment.id),
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey });
    // Problema 2 — add/remove materializa/remove itens no Assessment no
    // backend; sem revalidar o estado principal, a tela continuava
    // mostrando os `items` de antes até um reload manual.
    void queryClient.invalidateQueries({ queryKey: STATE_QUERY_KEY });
  };

  const canPropose = isOwner && assessment.status === "Draft";
  const canConfirm = isLead && assessment.status === "In Review";

  const addCapability = () => {
    if (!selectedCapabilityId) return;
    setActionError(null);
    setBusy(true);
    viewModel
      .proposeCapability(assessment.id, selectedCapabilityId)
      .then(() => {
        setSelectedCapabilityId("");
        invalidateAll();
      })
      .catch((error: unknown) =>
        setActionError(error instanceof ApiError ? error.message : t("asmt.portfolio.error")),
      )
      .finally(() => setBusy(false));
  };

  /**
   * Problema 3 — sem `force`, o backend devolve 409 quando a capacidade já
   * tem competência respondida. Nesse caso (e só nesse), abre o diálogo de
   * confirmação em vez de mostrar o erro cru; qualquer outro erro (403 de
   * quem não é dono, ou até um outro 409 — ex.: avaliação deixou de estar
   * em Rascunho enquanto o diálogo estava aberto) vai direto para
   * `actionError`. B-16 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md,
   * §26) — reage por `code` estável, não por `status` genérico: antes,
   * QUALQUER 409 nesta chamada abria o diálogo de "forçar remoção", mesmo
   * um 409 sem nada a ver com competência respondida.
   */
  const attemptRemove = (capabilityId: string, capabilityName: string, force = false) => {
    setActionError(null);
    setBusy(true);
    viewModel
      .removeCapability(assessment.id, capabilityId, force)
      .then(() => {
        invalidateAll();
        setPendingRemoval(null);
      })
      .catch((error: unknown) => {
        if (!force && error instanceof ApiError && error.code === "PORTFOLIO_HAS_ANSWERED_ITEMS") {
          setPendingRemoval({ id: capabilityId, name: capabilityName });
          return;
        }
        setActionError(error instanceof ApiError ? error.message : t("asmt.portfolio.error"));
      })
      .finally(() => setBusy(false));
  };

  const confirmCapability = (capabilityId: string) => {
    setActionError(null);
    setBusy(true);
    viewModel
      .confirmCapability(assessment.id, capabilityId)
      .then(() => invalidateAll())
      .catch((error: unknown) =>
        setActionError(error instanceof ApiError ? error.message : t("asmt.portfolio.error")),
      )
      .finally(() => setBusy(false));
  };

  return (
    <QuerySection
      query={{ data: eligibility, isPending, isError, refetch }}
      className="mb-4"
      title={t("asmt.portfolio.title")}
      description={t("asmt.portfolio.subtitle")}
      errorMessage={t("asmt.portfolio.loadError")}
      // Problema 4 — loading/error de verdade em vez de `return null`; o
      // esqueleto/erro/retry/ARIA moram em `QuerySection` (OO3-18/F-2).
      skeleton={
        <div className="space-y-2">
          <div className="h-9 animate-pulse rounded-md bg-secondary" />
          <div className="h-9 animate-pulse rounded-md bg-secondary" />
          <div className="h-9 w-2/3 animate-pulse rounded-md bg-secondary" />
        </div>
      }
      // `!data.capabilities`, não só `!data`: testes que ainda não conhecem
      // esta rota (mock de fetch genérico) devolvem `{}` com 200 em vez de
      // 404 — `data` fica um objeto truthy sem o formato esperado.
      isEmpty={(data) => !data.capabilities}
    >
      {(eligibility) => {
        // Problema 1 — só capacidade `READY` (curadoria completa) pode entrar
        // no portfólio; o backend já recusa o resto, mas oferecer a opção aqui
        // só para devolver erro depois é a experiência ruim que a Seção 8
        // aponta.
        const availableToAdd = viewModel.availableCapabilitiesToPropose(
          store.capabilities,
          eligibility,
        );
        const portfolioSize = eligibility.capabilities.length;
        /**
         * CFG-01 (SPEC-OO3-13, B8) — o mínimo do portfólio deixou de ser um
         * literal `3` repetido (terceira cópia da mesma regra): é
         * `career_level_policies.minimumQualifiedCapabilities` do nível ALVO,
         * que a resposta de elegibilidade já traz (`eligibility.policy`). O
         * `?? 3` cobre só quem está no topo da carreira (sem próximo nível,
         * sem política) — mesmo fallback já usado no badge de qualificação
         * abaixo; o piso global 3 é CHECK do banco (B5, parte backend do
         * CFG-01).
         */
        const minimumPortfolio = eligibility.policy?.minimumQualifiedCapabilities ?? 3;

        return (
          <SectionCard
            className="mb-4"
            title={t("asmt.portfolio.title")}
            description={t("asmt.portfolio.subtitle")}
          >
            {/* Problema 5 — dois números, nunca confundidos: quantas capacidades
          o ciclo exige no mínimo (a política do nível alvo) versus quantas
          já qualificam para o próximo nível. */}
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={portfolioSize >= minimumPortfolio ? "default" : "outline"}>
                {t("asmt.portfolio.size", { n: portfolioSize, min: minimumPortfolio })}
              </Badge>
              {/* ENT-09-016 — indicador visual do mínimo da política, além do número no badge. */}
              <Progress
                value={Math.min(100, (portfolioSize / minimumPortfolio) * 100)}
                className="h-1.5 w-24"
                aria-label={t("asmt.portfolio.size", { n: portfolioSize, min: minimumPortfolio })}
              />
              {eligibility.nextCareerLevel ? (
                <>
                  <span className="text-muted-foreground">
                    {t("asmt.portfolio.progressTo", { nivel: eligibility.nextCareerLevel.name })}
                  </span>
                  <Badge variant={eligibility.eligible ? "default" : "outline"}>
                    {t("asmt.portfolio.qualifiedCount", {
                      qualified: eligibility.qualifiedConfirmedCount,
                      required: eligibility.policy?.minimumQualifiedCapabilities ?? 3,
                    })}
                  </Badge>
                </>
              ) : (
                <span className="text-muted-foreground">{t("asmt.portfolio.topLevel")}</span>
              )}
            </div>
            {canPropose && portfolioSize < minimumPortfolio && (
              <p className="mb-3 text-xs text-muted-foreground">
                {t("asmt.portfolio.minimumHint", { min: minimumPortfolio })}
              </p>
            )}

            <ul className="space-y-1.5">
              {eligibility.capabilities.map((entry) => {
                const capability = store.capabilities.find((c) => c.id === entry.capabilityId);
                const name = capability?.name ?? entry.capabilityId;
                return (
                  <li
                    key={entry.capabilityId}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>{name}</span>
                    <div className="flex items-center gap-2">
                      {entry.confirmed ? (
                        <Badge variant={entry.qualified ? "default" : "outline"}>
                          {entry.qualified
                            ? t("asmt.portfolio.qualified")
                            : t("asmt.portfolio.notQualified")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t("asmt.portfolio.pendingConfirmation")}</Badge>
                      )}
                      {canConfirm && !entry.confirmed && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => confirmCapability(entry.capabilityId)}
                        >
                          {t("asmt.portfolio.confirm")}
                        </Button>
                      )}
                      {canPropose && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => attemptRemove(entry.capabilityId, name)}
                        >
                          {t("common.remove")}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
              {eligibility.capabilities.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("asmt.portfolio.empty")}</p>
              )}
            </ul>

            {canPropose && (
              <div className="mt-3 flex gap-2">
                <select
                  aria-label={t("asmt.portfolio.addLabel")}
                  className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={selectedCapabilityId}
                  disabled={busy}
                  onChange={(e) => setSelectedCapabilityId(e.target.value)}
                >
                  <option value="">{t("asmt.portfolio.addPlaceholder")}</option>
                  {availableToAdd.map((cap) => (
                    <option key={cap.id} value={cap.id}>
                      {cap.name}
                    </option>
                  ))}
                </select>
                <Button size="sm" disabled={!selectedCapabilityId || busy} onClick={addCapability}>
                  {t("asmt.portfolio.add")}
                </Button>
              </div>
            )}
            {canPropose && availableToAdd.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">{t("asmt.portfolio.noneReady")}</p>
            )}

            {actionError && (
              <p className="mt-2 text-xs text-destructive" role="alert">
                {actionError}
              </p>
            )}

            <ConfirmDialog
              open={pendingRemoval !== null}
              title={t("asmt.portfolio.removeConfirm.title")}
              description={t("asmt.portfolio.removeConfirm.description", {
                nome: pendingRemoval?.name ?? "",
              })}
              confirmLabel={t("asmt.portfolio.removeConfirm.confirm")}
              cancelLabel={t("pdi.newItem.cancel")}
              onConfirm={() =>
                pendingRemoval && attemptRemove(pendingRemoval.id, pendingRemoval.name, true)
              }
              onCancel={() => setPendingRemoval(null)}
            />
          </SectionCard>
        );
      }}
    </QuerySection>
  );
}

/**
 * ESPECIFICACAO-OITAVA-RODADA, Seção 18 / ORIENTACAO-NONA-RODADA ENT-09-011
 * — "Começar/Parar/Continuar", mesma governança de escrita do resto do
 * assessment: só o dono escreve em `Draft`, só o Tech Lead complementa em
 * `In Review`, e tudo trava em `Completed` (o backend já bloqueia; aqui só
 * espelha para não abrir campo editável que vai apanhar 403).
 */
export function DevelopmentSummarySection({
  assessment,
  isOwner,
  isLead,
}: {
  assessment: Assessment;
  isOwner: boolean;
  isLead: boolean;
}) {
  const { t } = useI18n();
  const status = assessment.status;
  const canEdit = status === "Draft" ? isOwner && !isLead : status === "In Review" ? isLead : false;

  const queryKey: QueryKey = ["assessment-development-summary", assessment.id];
  const { data, isPending, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => api.assessmentDevelopmentSummary(assessment.id),
    /**
     * Sem refetch automático em segundo plano (foco de janela, por exemplo):
     * o formulário guarda texto digitado localmente até um Salvar explícito,
     * e uma reconsulta silenciosa sobrescreveria esse texto sem aviso —
     * exatamente o problema que ENT-09-011 pede para evitar.
     */
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // OO3-18/F-2 — loading/erro eram o segundo clone byte a byte do bloco do
  // portfólio acima; o esqueleto/erro/retry/ARIA moram em `QuerySection`.
  return (
    <QuerySection
      query={{ data, isPending, isError, refetch }}
      className="mb-4"
      title={t("asmt.devSummary.title")}
      description={t("asmt.devSummary.subtitle")}
      errorMessage={t("asmt.devSummary.loadError")}
      skeleton={
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-24 animate-pulse rounded-md bg-secondary" />
          <div className="h-24 animate-pulse rounded-md bg-secondary" />
          <div className="h-24 animate-pulse rounded-md bg-secondary" />
        </div>
      }
    >
      {(data) => (
        <DevelopmentSummaryForm
          key={data.version}
          assessmentId={assessment.id}
          data={data}
          canEdit={canEdit}
          queryKey={queryKey}
          onReload={() => void refetch()}
        />
      )}
    </QuerySection>
  );
}

/**
 * `key={data.version}` no componente pai (acima) força remontar este
 * formulário sempre que a versão salva no servidor muda — depois de um
 * Salvar bem-sucedido, ou quando a pessoa pede explicitamente a versão mais
 * recente após um conflito de edição concorrente. Fora esses dois momentos
 * pedidos pelo próprio usuário, o texto digitado nunca some sozinho: o
 * componente pai não reconsulta em segundo plano (`staleTime: Infinity`),
 * e este formulário lê `data` só uma vez, no valor inicial do `useState`.
 */
function DevelopmentSummaryForm({
  assessmentId,
  data,
  canEdit,
  queryKey,
  onReload,
}: {
  assessmentId: string;
  data: AssessmentDevelopmentSummary;
  canEdit: boolean;
  queryKey: QueryKey;
  onReload: () => void;
}) {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const viewModel = useAssessmentViewModel();
  const [startDoing, setStartDoing] = useState(data.startDoing);
  const [stopDoing, setStopDoing] = useState(data.stopDoing);
  const [continueDoing, setContinueDoing] = useState(data.continueDoing);
  const [saveState, setSaveState] = useState<"clean" | "dirty" | "saving" | "saved" | "error">(
    "clean",
  );
  const [conflict, setConflict] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const markDirty = () => {
    setConflict(false);
    setSaveState((prev) => (prev === "saving" ? prev : "dirty"));
  };

  const save = () => {
    setSaveState("saving");
    setErrorMessage(null);
    viewModel
      .updateDevelopmentSummary(
        assessmentId,
        { startDoing, stopDoing, continueDoing },
        data.version,
      )
      .then(() => {
        setSaveState("saved");
        void queryClient.invalidateQueries({ queryKey });
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 409) {
          setConflict(true);
          setSaveState("error");
          return;
        }
        setErrorMessage(error instanceof ApiError ? error.message : t("asmt.devSummary.saveError"));
        setSaveState("error");
      });
  };

  return (
    <SectionCard
      className="mb-4"
      title={t("asmt.devSummary.title")}
      description={t("asmt.devSummary.subtitle")}
    >
      {conflict && (
        <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p>{t("asmt.devSummary.conflict")}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => {
              setConflict(false);
              onReload();
            }}
          >
            {t("asmt.devSummary.reload")}
          </Button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="dev-summary-start">{t("asmt.devSummary.start")}</Label>
          <Textarea
            id="dev-summary-start"
            className="mt-1"
            value={startDoing}
            disabled={!canEdit}
            onChange={(e) => {
              setStartDoing(e.target.value);
              markDirty();
            }}
            placeholder={t("asmt.devSummary.start.placeholder")}
          />
        </div>
        <div>
          <Label htmlFor="dev-summary-stop">{t("asmt.devSummary.stop")}</Label>
          <Textarea
            id="dev-summary-stop"
            className="mt-1"
            value={stopDoing}
            disabled={!canEdit}
            onChange={(e) => {
              setStopDoing(e.target.value);
              markDirty();
            }}
            placeholder={t("asmt.devSummary.stop.placeholder")}
          />
        </div>
        <div>
          <Label htmlFor="dev-summary-continue">{t("asmt.devSummary.continue")}</Label>
          <Textarea
            id="dev-summary-continue"
            className="mt-1"
            value={continueDoing}
            disabled={!canEdit}
            onChange={(e) => {
              setContinueDoing(e.target.value);
              markDirty();
            }}
            placeholder={t("asmt.devSummary.continue.placeholder")}
          />
        </div>
      </div>

      {canEdit && (
        <div className="mt-3 flex items-center gap-3">
          <Button
            size="sm"
            disabled={saveState === "saving" || saveState === "clean"}
            onClick={save}
          >
            {saveState === "saving" ? t("asmt.devSummary.saving") : t("common.save")}
          </Button>
          <p className="text-xs" role="status">
            {saveState === "saved" && (
              <span className="text-emerald-600">{t("asmt.devSummary.saved")}</span>
            )}
            {saveState === "dirty" && (
              <span className="text-muted-foreground">{t("asmt.devSummary.unsaved")}</span>
            )}
            {saveState === "error" && !conflict && errorMessage && (
              <span className="text-destructive" role="alert">
                {errorMessage}
              </span>
            )}
          </p>
        </div>
      )}

      {!canEdit && data.updatedAt && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("asmt.devSummary.lastUpdated", {
            data: defaultDateFormatter.formatDate(data.updatedAt, locale) ?? "",
          })}
        </p>
      )}
    </SectionCard>
  );
}

/**
 * `value: Level | null` — `null` é "ainda não avaliado", nunca um nível
 * fabricado. O placeholder "—" fica selecionado até a pessoa escolher de
 * verdade; não existe valor padrão que o componente empurre sozinho. Ver
 * AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, DOM-002.
 */
function LevelSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: Level | null;
  onChange: (v: Level) => void;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="w-full rounded-md border border-input bg-card px-2 py-1 text-sm"
      value={value ?? ""}
      onChange={(e) => onChange(Number(e.target.value) as Level)}
    >
      <option value="" disabled>
        —
      </option>
      {[1, 2, 3, 4, 5].map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  );
}

/**
 * Uma capacidade selecionada: título + tabela de competências (autoavaliação,
 * Tech Lead, alvo, final, gap, comentários). Extraído de `AssessmentsPage`
 * (era o corpo do `.map` sobre `visibleCapabilities`, ~200 linhas) — a rota
 * só decide QUAIS capacidades mostrar (via `capabilityIds`/paginação de
 * "muitas capacidades"); como cada uma é renderizada fica aqui.
 */
export function CapabilityAssessmentCard({
  capability,
  assessment,
  status,
  canEditSelf,
  canEditLeaderFinal,
  architectId,
  openComment,
  onToggleComment,
}: {
  capability: Capability;
  assessment: Assessment;
  status: Assessment["status"] | undefined;
  canEditSelf: boolean;
  canEditLeaderFinal: boolean;
  architectId: string;
  openComment: string | null;
  onToggleComment: (competencyId: string) => void;
}) {
  const store = useStore();
  const { t, locale } = useI18n();
  const labels = useLabels();
  const user = useCurrentUser();
  const viewModel = useAssessmentViewModel();
  /**
   * R2-RESP-07 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — abaixo de `md` (768px)
   * a tabela de pontuação (7 colunas, `min-w-[820px]`) só existia com scroll
   * lateral, e cada `<select>` de nota ficava pequeno demais para tocar com
   * o dedo dentro da coluna estreita. Em vez de tentar espremer a mesma
   * tabela em CSS, troca por um bloco empilhado por competência — mesma
   * informação, mesmos handlers (`updateAssessmentItem` via
   * `CompetencyStackedCard`), só em outra ordem visual. Acima de `md` a
   * tabela permanece exatamente como era (nenhum JSX da branch de tabela
   * foi tocado). Mesmo padrão de `useNarrowViewport` do R2-RESP-06.
   */
  const narrow = useNarrowViewport(768);

  const comps = store.competencies.filter((c) => c.capabilityId === capability.id);
  const answeredCount = comps.filter((c) => {
    const item = assessment.items.find((i) => i.competencyId === c.id);
    if (!item) return false;
    return status === "Draft" ? item.self !== null : item.final !== null;
  }).length;

  return (
    <SectionCard
      title={capability.name}
      description={
        (comps.length === 1
          ? t("asmt.competencyCount.one")
          : t("asmt.competencyCount.many", { n: comps.length })) +
        (comps.length > 0
          ? ` · ${t("asmt.progressCount", { answered: answeredCount, total: comps.length })}`
          : "")
      }
    >
      {comps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("asmt.noCompetencies")}</p>
      ) : narrow ? (
        <div className="space-y-3" data-testid="competency-stacked-list">
          {comps.map((c) => {
            const item = assessment.items.find((i) => i.competencyId === c.id);
            if (!item) return null;
            return (
              <CompetencyStackedCard
                key={c.id}
                competency={c}
                item={item}
                assessmentId={assessment.id}
                architectId={architectId}
                canEditSelf={canEditSelf}
                canEditLeaderFinal={canEditLeaderFinal}
                openComment={openComment}
                onToggleComment={onToggleComment}
              />
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2">
                  {t("asmt.col.competency")}
                </th>
                <th scope="col" className="w-24 py-2 text-center">
                  {t("asmt.col.self")}
                </th>
                <th scope="col" className="w-24 py-2 text-center">
                  {t("asmt.col.techLead")}
                </th>
                <th scope="col" className="w-24 py-2 text-center">
                  {t("asmt.col.target")}
                </th>
                <th scope="col" className="w-24 py-2 text-center">
                  {t("asmt.col.final")}
                </th>
                <th scope="col" className="w-44 py-2">
                  {t("asmt.col.gap")}
                </th>
                <th scope="col" className="w-24 py-2 text-right">
                  {t("asmt.col.notes")}
                </th>
              </tr>
            </thead>
            <tbody>
              {comps.map((c) => {
                const item = assessment.items.find((i) => i.competencyId === c.id);
                if (!item) return null;
                // Sem final ainda: não há gap para mostrar (não é gap zero, é indefinido).
                const gap = item.final === null ? undefined : item.target - item.final;
                const diverges =
                  item.self !== null && item.leader !== null && item.self !== item.leader;
                /**
                 * Fecha o loop da evidência: quando o Tech Lead já aceitou uma
                 * evidência para esta competência desta pessoa, ela aparece aqui
                 * como contexto — sem alterar nota nenhuma sozinha, a calibração
                 * continua sendo decisão de quem revisa. Ver AUDITORIA-TERCEIRA-
                 * RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC I.
                 */
                const acceptedEvidence = store.evidences.filter(
                  (e) =>
                    e.architectId === architectId &&
                    e.status === "Accepted" &&
                    e.competencyIds.includes(c.id),
                );
                return (
                  <Fragment key={c.id}>
                    <tr className="border-b border-border/60">
                      <td className="py-2 font-medium">
                        <span className="flex items-center gap-1.5">
                          {c.name}
                          {acceptedEvidence.length > 0 && (
                            <BadgeCheck
                              className="h-3.5 w-3.5 shrink-0 text-[var(--level-5-fg)]"
                              aria-label={t("asmt.evidence.badge", {
                                n: acceptedEvidence.length,
                              })}
                            />
                          )}
                        </span>
                      </td>
                      <td className="px-1 py-2">
                        {canEditSelf ? (
                          <LevelSelect
                            value={item.self}
                            onChange={(v) => viewModel.updateSelfScore(assessment.id, c.id, v)}
                            ariaLabel={t("asmt.select.self", { competency: c.name })}
                          />
                        ) : (
                          <LevelBadge level={item.self ?? undefined} />
                        )}
                      </td>
                      <td className="px-1 py-2">
                        <div className="flex items-center gap-1">
                          {canEditLeaderFinal ? (
                            <LevelSelect
                              value={item.leader}
                              onChange={(v) => viewModel.updateLeaderScore(assessment.id, c.id, v)}
                              ariaLabel={t("asmt.select.leader", { competency: c.name })}
                            />
                          ) : (
                            <LevelBadge level={item.leader ?? undefined} />
                          )}
                          {diverges && (
                            <AlertTriangle
                              className="h-3.5 w-3.5 shrink-0 text-[var(--gap-high-fg)]"
                              aria-label={t("asmt.divergence")}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-1 py-2 text-center">
                        <LevelBadge level={item.target} />
                      </td>
                      <td className="px-1 py-2">
                        {canEditLeaderFinal ? (
                          <LevelSelect
                            value={item.final}
                            onChange={(v) => viewModel.updateFinalScore(assessment.id, c.id, v)}
                            ariaLabel={t("asmt.select.final", { competency: c.name })}
                          />
                        ) : (
                          <LevelBadge level={item.final ?? undefined} />
                        )}
                      </td>
                      <td className="py-2">
                        <GapBadge gap={gap} />
                      </td>
                      <td className="py-2 text-right">
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => onToggleComment(c.id)}
                        >
                          {commentCountLabel(item.comments.length, t)}
                        </button>
                      </td>
                    </tr>
                    {openComment === c.id && (
                      <tr className="border-b border-border/60 bg-secondary/40">
                        <td colSpan={7} className="p-3">
                          {acceptedEvidence.length > 0 && (
                            <div className="mb-3 space-y-1.5 border-b border-border pb-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t("asmt.evidence.title")}
                              </p>
                              <ul className="space-y-1">
                                {acceptedEvidence.map((e) => (
                                  <li key={e.id} className="text-sm">
                                    <span className="font-medium">{e.title}</span>{" "}
                                    <span className="text-xs text-muted-foreground">
                                      {labels.evidenceType[e.type]} ·{" "}
                                      {defaultDateFormatter.formatDate(e.date, locale)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <CommentSection
                            comments={item.comments}
                            currentUserId={user.id}
                            onCreate={(input) => viewModel.addComment(assessment.id, c.id, input)}
                            onUpdate={(commentId, input) =>
                              viewModel.updateComment(assessment.id, c.id, commentId, input)
                            }
                            onDelete={(commentId) =>
                              viewModel.removeComment(assessment.id, c.id, commentId)
                            }
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

/**
 * R2-RESP-07 — a mesma linha da tabela (nome + evidência, self/Tech
 * Lead/alvo/final, gap, comentários), só que empilhada verticalmente em vez
 * de espalhada em colunas: nada aqui precisa de scroll lateral para
 * aparecer. Mesmos dados e os mesmos handlers de `CapabilityAssessmentCard`
 * — é um recorte 1:1 do `<tr>` de origem, sem lógica nova.
 */
function CompetencyStackedCard({
  competency,
  item,
  assessmentId,
  architectId,
  canEditSelf,
  canEditLeaderFinal,
  openComment,
  onToggleComment,
}: {
  competency: Competency;
  item: AssessmentItem;
  assessmentId: string;
  architectId: string;
  canEditSelf: boolean;
  canEditLeaderFinal: boolean;
  openComment: string | null;
  onToggleComment: (competencyId: string) => void;
}) {
  const store = useStore();
  const { t, locale } = useI18n();
  const labels = useLabels();
  const user = useCurrentUser();
  const viewModel = useAssessmentViewModel();

  // Sem final ainda: não há gap para mostrar (não é gap zero, é indefinido).
  const gap = item.final === null ? undefined : item.target - item.final;
  const diverges = item.self !== null && item.leader !== null && item.self !== item.leader;
  /** Mesmo loop de evidência aceita da versão em tabela — ver comentário lá. */
  const acceptedEvidence = store.evidences.filter(
    (e) =>
      e.architectId === architectId &&
      e.status === "Accepted" &&
      e.competencyIds.includes(competency.id),
  );

  return (
    <div
      className="rounded-md border border-border bg-card p-3"
      data-testid="competency-stacked-card"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {competency.name}
          {acceptedEvidence.length > 0 && (
            <BadgeCheck
              className="h-3.5 w-3.5 shrink-0 text-[var(--level-5-fg)]"
              aria-label={t("asmt.evidence.badge", { n: acceptedEvidence.length })}
            />
          )}
        </span>
        <GapBadge gap={gap} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("asmt.col.self")}
          </p>
          <div className="mt-1">
            {canEditSelf ? (
              <LevelSelect
                value={item.self}
                onChange={(v) => viewModel.updateSelfScore(assessmentId, competency.id, v)}
                ariaLabel={t("asmt.select.self", { competency: competency.name })}
              />
            ) : (
              <LevelBadge level={item.self ?? undefined} />
            )}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("asmt.col.techLead")}
          </p>
          <div className="mt-1 flex items-center gap-1">
            {canEditLeaderFinal ? (
              <LevelSelect
                value={item.leader}
                onChange={(v) => viewModel.updateLeaderScore(assessmentId, competency.id, v)}
                ariaLabel={t("asmt.select.leader", { competency: competency.name })}
              />
            ) : (
              <LevelBadge level={item.leader ?? undefined} />
            )}
            {diverges && (
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0 text-[var(--gap-high-fg)]"
                aria-label={t("asmt.divergence")}
              />
            )}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("asmt.col.target")}
          </p>
          <div className="mt-1">
            <LevelBadge level={item.target} />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("asmt.col.final")}
          </p>
          <div className="mt-1">
            {canEditLeaderFinal ? (
              <LevelSelect
                value={item.final}
                onChange={(v) => viewModel.updateFinalScore(assessmentId, competency.id, v)}
                ariaLabel={t("asmt.select.final", { competency: competency.name })}
              />
            ) : (
              <LevelBadge level={item.final ?? undefined} />
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="mt-3 text-xs text-primary hover:underline"
        onClick={() => onToggleComment(competency.id)}
      >
        {commentCountLabel(item.comments.length, t)}
      </button>

      {openComment === competency.id && (
        <div className="mt-3 border-t border-border pt-3">
          {acceptedEvidence.length > 0 && (
            <div className="mb-3 space-y-1.5 border-b border-border pb-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("asmt.evidence.title")}
              </p>
              <ul className="space-y-1">
                {acceptedEvidence.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="font-medium">{e.title}</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      {labels.evidenceType[e.type]} ·{" "}
                      {defaultDateFormatter.formatDate(e.date, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <CommentSection
            comments={item.comments}
            currentUserId={user.id}
            onCreate={(input) => viewModel.addComment(assessmentId, competency.id, input)}
            onUpdate={(commentId, input) =>
              viewModel.updateComment(assessmentId, competency.id, commentId, input)
            }
            onDelete={(commentId) =>
              viewModel.removeComment(assessmentId, competency.id, commentId)
            }
          />
        </div>
      )}
    </div>
  );
}
