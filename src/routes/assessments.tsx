import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, BadgeCheck } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { z } from "zod";

import { GapBadge, LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArchitectSelectCombobox } from "@/components/app/ArchitectSelectCombobox";
import { CapabilityCombobox } from "@/components/app/CapabilityCombobox";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type {
  Assessment,
  AssessmentComment,
  AssessmentDevelopmentSummary,
  Level,
} from "@/lib/domain";
import { api, ApiError, type CommentInput } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { useI18n, type I18nApi } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useLabels } from "@/lib/labels";
import { isLeadOf } from "@/lib/scope";
import { STATE_QUERY_KEY, useSelectors, useStore } from "@/lib/store";
import { formatDate, initialSearchParam } from "@/lib/text";
import { cn } from "@/lib/utils";

/**
 * `architectId` na URL — quem chega de outra tela (o perfil da pessoa)
 * continua olhando para a mesma pessoa, em vez de cair no primeiro
 * arquiteto ativo e perder o contexto que trouxe até aqui. Ver AUDITORIA-
 * TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC H.
 *
 * `cycleId` na URL — sem isto, o link "Ver" do histórico do perfil sempre
 * caía no ciclo ativo, não no ciclo que o histórico realmente mostrava (o
 * usuário pedia para ver 2025 H2 e a tela abria 2026 H1). Ver HIST-001,
 * AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md.
 */
const assessmentsSearchSchema = z.object({
  architectId: z.string().optional(),
  cycleId: z.string().optional(),
});

export const Route = createFileRoute("/assessments")({
  validateSearch: assessmentsSearchSchema,
  head: () => ({
    meta: [
      { title: "Avaliações — Synapse" },
      {
        name: "description",
        content: "Autoavaliação, avaliação do Tech Lead, nível alvo e nível final por competência.",
      },
      { property: "og:title", content: "Avaliações — Synapse" },
      {
        property: "og:description",
        content: "Conduza assessments de competências com comentários do arquiteto e do Tech Lead.",
      },
    ],
  }),
  component: AssessmentsPage,
});

function AssessmentsPage() {
  const store = useStore();
  const sel = useSelectors();
  const [architectId, setArchitectId] = useState(
    () => initialSearchParam("architectId") ?? sel.activeArchitects[0]?.id ?? "",
  );
  /** Ciclo pedido pelo link de origem (histórico) — cai no ativo se nenhum vier na URL. */
  const [cycleId] = useState(() => initialSearchParam("cycleId") ?? store.activeCycleId);
  const isActiveCycle = cycleId === store.activeCycleId;
  const viewedCycle = store.cycles.find((c) => c.id === cycleId);
  const { t, locale } = useI18n();
  const help = usePageHelp("assessments");
  const labels = useLabels();
  const user = useCurrentUser();
  const [capabilityIds, setCapabilityIds] = useState<string[]>(() =>
    store.capabilities[0] ? [store.capabilities[0].id] : [],
  );
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const assessment = sel.assessmentFor(architectId, cycleId);
  const selectedArchitect = sel.architectById(architectId);

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
   */
  const isOwner = user.architectId === architectId;
  const isLead = !isOwner && isLeadOf(user, selectedArchitect);
  const status = assessment?.status;
  const isCompleted = status === "Completed";
  /**
   * Cada campo só abre na etapa certa do lifecycle, não em qualquer momento
   * "antes de Completed": a autoavaliação fecha assim que vai para revisão
   * (senão a pessoa continuaria ajustando a própria nota depois de pedir
   * avaliação do Tech Lead); líder/final só abrem quando a revisão já
   * começou (senão o Tech Lead calibraria a nota final antes de a
   * autoavaliação existir). Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md,
   * Seção 2–4.
   */
  const canEditSelf = !isLead && isOwner && status === "Draft";
  const canEditLeaderFinal = isLead && status === "In Review";
  const canSubmit = !isLead && isOwner && status === "Draft";
  const canComplete = isLead && status === "In Review";
  /** Só o Tech Lead reabre — devolve a `In Review` para corrigir e concluir de novo. */
  const canReopen = isLead && status === "Completed";

  /**
   * Espelha a completude que o backend já exige na transição (DOM-002): o
   * botão nasce desabilitado com uma explicação em vez de deixar a pessoa
   * tentar e só descobrir pelo erro do servidor que faltou preencher algo.
   * Ver AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md.
   */
  const incompleteSelf = assessment?.items.some((i) => i.self === null) ?? false;
  const incompleteLeaderFinal =
    assessment?.items.some((i) => i.leader === null || i.final === null) ?? false;

  /** Capacidades escolhidas, na ordem do catálogo — não na ordem de clique. */
  const selected = store.capabilities.filter((c) => capabilityIds.includes(c.id));

  const toggleCapability = (id: string) =>
    setCapabilityIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  /**
   * R2-ESC-06 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — mesma `queryKey` de
   * `CareerPortfolioSection`: o React Query deduplica, então isto não é uma
   * segunda chamada de rede, só um segundo lugar lendo o cache já buscado.
   * Alimenta o atalho "Selecionar as do portfólio".
   */
  const { data: eligibility } = useQuery({
    queryKey: ["assessment-eligibility", assessment?.id],
    queryFn: () => api.assessmentEligibility(assessment!.id),
    enabled: !!assessment,
  });

  /**
   * REVISAO-360-FRONTEND (R2-ESC-06) — selecionar muitas capacidades de uma
   * vez (ex.: "Selecionar todas" num catálogo de 30) despejava ~180 linhas
   * na tela de uma vez. Acima do limiar, a navegação vira "uma capacidade
   * por vez" — o valor de `selected` continua sendo TODAS as escolhidas
   * (o resto da tela, contagens etc. não muda), só a RENDERIZAÇÃO dos
   * cards de resposta que passa a mostrar um por vez.
   */
  const MANY_CAPABILITIES_THRESHOLD = 10;
  const manyCapabilitiesSelected = selected.length > MANY_CAPABILITIES_THRESHOLD;
  const [capabilityPage, setCapabilityPage] = useState(0);
  const capabilityIdsKey = capabilityIds.join(",");
  useEffect(() => {
    setCapabilityPage(0);
  }, [capabilityIdsKey]);
  const visibleCapabilities = manyCapabilitiesSelected
    ? selected.slice(capabilityPage, capabilityPage + 1)
    : selected;

  const transition = (nextStatus: Assessment["status"]) => {
    if (!assessment) return;
    setTransitionError(null);
    setTransitioning(true);
    const isReopen = status === "Completed" && nextStatus === "In Review";
    store
      .setAssessmentStatus(assessment.id, nextStatus)
      .catch((error: unknown) =>
        setTransitionError(
          error instanceof Error
            ? error.message
            : t(
                isReopen
                  ? "asmt.reopenError"
                  : nextStatus === "Completed"
                    ? "asmt.completeError"
                    : "asmt.submitError",
              ),
        ),
      )
      .finally(() => setTransitioning(false));
  };

  return (
    <>
      <PageHeader
        title={t("asmt.title")}
        description={t("asmt.subtitle")}
        help={help}
        actions={
          <div className="flex gap-2">
            <ArchitectSelectCombobox
              architects={sel.activeArchitects}
              inactiveArchitects={store.architects.filter((a) => !a.active)}
              selectedId={architectId}
              onChange={setArchitectId}
              label={t("asmt.architect")}
              className="w-48"
            />
            <CapabilityCombobox
              capabilities={store.capabilities}
              selected={selected}
              onToggle={toggleCapability}
              onSelectAll={setCapabilityIds}
            />
            {eligibility && eligibility.capabilities.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCapabilityIds(eligibility.capabilities.map((c) => c.capabilityId))
                }
              >
                {t("asmt.selectPortfolio")}
              </Button>
            )}
          </div>
        }
      />

      {!isActiveCycle && (
        <p className="mb-3 text-xs text-muted-foreground">
          {t("asmt.historicalCycle", { cycle: viewedCycle?.name ?? cycleId })}
        </p>
      )}

      {assessment && (
        <div className="mb-4 flex flex-wrap items-center gap-3 surface-inset px-3 py-2 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("asmt.status")}
          </span>
          <AssessmentStatusBadge
            status={assessment.status}
            label={labels.assessmentStatus[assessment.status]}
          />
          {isCompleted && <span className="text-xs text-muted-foreground">{t("asmt.locked")}</span>}
          <div className="ml-auto flex items-center gap-2">
            {canSubmit && (
              <Button
                size="sm"
                disabled={transitioning || incompleteSelf}
                title={incompleteSelf ? t("asmt.incompleteSelf") : undefined}
                onClick={() => transition("In Review")}
              >
                {transitioning ? t("asmt.submitting") : t("asmt.submit")}
              </Button>
            )}
            {canComplete && (
              <Button
                size="sm"
                variant="secondary"
                disabled={transitioning || incompleteLeaderFinal}
                title={incompleteLeaderFinal ? t("asmt.incompleteLeaderFinal") : undefined}
                onClick={() => transition("Completed")}
              >
                {transitioning ? t("asmt.completing") : t("asmt.complete")}
              </Button>
            )}
            {canReopen && (
              <Button
                size="sm"
                variant="outline"
                disabled={transitioning}
                onClick={() => transition("In Review")}
              >
                {transitioning ? t("asmt.reopening") : t("asmt.reopen")}
              </Button>
            )}
          </div>
          {canSubmit && incompleteSelf && (
            <p className="w-full text-xs text-muted-foreground">{t("asmt.incompleteSelf")}</p>
          )}
          {canComplete && incompleteLeaderFinal && (
            <p className="w-full text-xs text-muted-foreground">
              {t("asmt.incompleteLeaderFinal")}
            </p>
          )}
          {transitionError && (
            <p className="w-full text-xs text-destructive" role="alert">
              {transitionError}
            </p>
          )}
        </div>
      )}

      {assessment && (
        <CareerPortfolioSection assessment={assessment} isOwner={isOwner} isLead={isLead} />
      )}

      {assessment && (
        <DevelopmentSummarySection assessment={assessment} isOwner={isOwner} isLead={isLead} />
      )}

      {!assessment ? (
        <SectionCard
          title={t("asmt.noAssessment.title")}
          description={t("asmt.noAssessment.subtitle")}
        >
          {store.architects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cadastre um arquiteto em Time antes de abrir avaliações.
            </p>
          ) : selectedArchitect && !selectedArchitect.active ? (
            <p className="text-sm text-muted-foreground">{t("asmt.noAssessment.inactive")}</p>
          ) : !isActiveCycle ? (
            // Ciclo histórico sem avaliação registrada: não há "abrir" aqui — só o
            // ciclo ativo pode nascer uma avaliação nova (HIST-001).
            <p className="text-sm text-muted-foreground">
              {t("asmt.noAssessment.historicalCycle", { cycle: viewedCycle?.name ?? cycleId })}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Ao abrir, a avaliação nasce com uma linha por competência cadastrada e o nível alvo
                já preenchido a partir do Role Competency Profile do cargo.
              </p>
              {openError && <p className="mt-2 text-sm text-destructive">{openError}</p>}
              <Button
                className="mt-4"
                disabled={opening || !architectId || !store.activeCycleId}
                onClick={() => {
                  setOpenError(null);
                  setOpening(true);
                  store
                    .openAssessment(architectId, store.activeCycleId)
                    .catch((error: unknown) =>
                      setOpenError(error instanceof Error ? error.message : t("asmt.openError")),
                    )
                    .finally(() => setOpening(false));
                }}
              >
                {opening ? t("asmt.opening") : t("asmt.open")}
              </Button>
            </>
          )}
        </SectionCard>
      ) : selected.length === 0 ? (
        <SectionCard title={t("asmt.noCapability")}>
          <p className="text-sm text-muted-foreground">{t("asmt.pickCapability")}</p>
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {manyCapabilitiesSelected && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="text-amber-800">
                {t("asmt.manyCapabilities.warning", { n: selected.length })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={capabilityPage === 0}
                  onClick={() => setCapabilityPage((p) => p - 1)}
                >
                  {t("asmt.manyCapabilities.prev")}
                </Button>
                <select
                  aria-label={t("asmt.manyCapabilities.jump")}
                  className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                  value={capabilityPage}
                  onChange={(e) => setCapabilityPage(Number(e.target.value))}
                >
                  {selected.map((cat, index) => (
                    <option key={cat.id} value={index}>
                      {t("asmt.manyCapabilities.position", {
                        current: index + 1,
                        total: selected.length,
                      })}{" "}
                      — {cat.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={capabilityPage >= selected.length - 1}
                  onClick={() => setCapabilityPage((p) => p + 1)}
                >
                  {t("asmt.manyCapabilities.next")}
                </Button>
              </div>
            </div>
          )}
          {visibleCapabilities.map((cat) => {
            const comps = store.competencies.filter((c) => c.capabilityId === cat.id);
            const answeredCount = comps.filter((c) => {
              const item = assessment.items.find((i) => i.competencyId === c.id);
              if (!item) return false;
              return status === "Draft" ? item.self !== null : item.final !== null;
            }).length;
            return (
              <SectionCard
                key={cat.id}
                title={cat.name}
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
                                      onChange={(v) =>
                                        store.updateAssessmentItem(assessment.id, c.id, { self: v })
                                      }
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
                                        onChange={(v) =>
                                          store.updateAssessmentItem(assessment.id, c.id, {
                                            leader: v,
                                          })
                                        }
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
                                      onChange={(v) =>
                                        store.updateAssessmentItem(assessment.id, c.id, {
                                          final: v,
                                        })
                                      }
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
                                    onClick={() =>
                                      setOpenComment(openComment === c.id ? null : c.id)
                                    }
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
                                                {formatDate(e.date, locale)}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    <CommentSection
                                      comments={item.comments}
                                      currentUserId={user.id}
                                      onCreate={(input) =>
                                        store.addAssessmentComment(assessment.id, c.id, input)
                                      }
                                      onUpdate={(commentId, input) =>
                                        store.updateAssessmentComment(
                                          assessment.id,
                                          c.id,
                                          commentId,
                                          input,
                                        )
                                      }
                                      onDelete={(commentId) =>
                                        store.removeAssessmentComment(
                                          assessment.id,
                                          c.id,
                                          commentId,
                                        )
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
          })}
        </div>
      )}
    </>
  );
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
                    {t("comment.savedAt", { data: formatDate(comment.createdAt, locale) ?? "" })}
                    {comment.updatedAt &&
                      ` · ${t("comment.editedAt", { data: formatDate(comment.updatedAt, locale) ?? "" })}`}
                  </p>
                  {mine && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setEditing(comment.id)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-xs text-destructive hover:underline"
                        onClick={() => setConfirmDelete(comment)}
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CommentForm submitLabel="Salvar" onSubmit={onCreate} />

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
              Cancelar
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

/**
 * Reaproveita a mesma linguagem visual da escala de proficiência — apagado →
 * ácido — em vez de inventar uma paleta própria só para status: `Draft`
 * recebe o tom neutro de nível 0, `Completed` o tom de topo da escala
 * (nível 5), e `In Review` fica no meio.
 */
function AssessmentStatusBadge({ status, label }: { status: Assessment["status"]; label: string }) {
  const tone: Record<Assessment["status"], string> = {
    Draft: "bg-level-0 text-muted-foreground",
    "In Review": "bg-level-3 text-[var(--level-3-fg)]",
    Completed: "bg-level-5 text-[var(--level-5-fg)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        tone[status],
      )}
    >
      {label}
    </span>
  );
}

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
function CareerPortfolioSection({
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

  if (isPending) {
    return (
      <SectionCard
        className="mb-4"
        title={t("asmt.portfolio.title")}
        description={t("asmt.portfolio.subtitle")}
      >
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">{t("common.loading")}</span>
          <div className="h-9 animate-pulse rounded-md bg-secondary" />
          <div className="h-9 animate-pulse rounded-md bg-secondary" />
          <div className="h-9 w-2/3 animate-pulse rounded-md bg-secondary" />
        </div>
      </SectionCard>
    );
  }

  // `!eligibility?.capabilities`, não só `!eligibility`: testes que ainda não
  // conhecem esta rota (mock de fetch genérico) devolvem `{}` com 200 em vez
  // de 404 — `eligibility` fica um objeto truthy sem o formato esperado.
  if (isError || !eligibility?.capabilities) {
    return (
      <SectionCard
        className="mb-4"
        title={t("asmt.portfolio.title")}
        description={t("asmt.portfolio.subtitle")}
      >
        <p className="text-sm text-destructive" role="alert">
          {t("asmt.portfolio.loadError")}
        </p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => void refetch()}>
          {t("common.retry")}
        </Button>
      </SectionCard>
    );
  }

  // Problema 1 — só capacidade `READY` (curadoria completa) pode entrar no
  // portfólio; o backend já recusa o resto, mas oferecer a opção aqui só
  // para devolver erro depois é a experiência ruim que a Seção 8 aponta.
  const availableToAdd = store.capabilities.filter(
    (cap) =>
      cap.curation.status === "READY" &&
      !eligibility.capabilities.some((c) => c.capabilityId === cap.id),
  );

  const canPropose = isOwner && assessment.status === "Draft";
  const canConfirm = isLead && assessment.status === "In Review";
  const portfolioSize = eligibility.capabilities.length;

  const addCapability = () => {
    if (!selectedCapabilityId) return;
    setActionError(null);
    setBusy(true);
    api
      .addAssessmentCapability(assessment.id, selectedCapabilityId)
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
    api
      .removeAssessmentCapability(assessment.id, capabilityId, force)
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
    api
      .confirmAssessmentCapability(assessment.id, capabilityId)
      .then(() => invalidateAll())
      .catch((error: unknown) =>
        setActionError(error instanceof ApiError ? error.message : t("asmt.portfolio.error")),
      )
      .finally(() => setBusy(false));
  };

  return (
    <SectionCard
      className="mb-4"
      title={t("asmt.portfolio.title")}
      description={t("asmt.portfolio.subtitle")}
    >
      {/* Problema 5 — dois números, nunca confundidos: quantas capacidades
          o ciclo exige no mínimo (3) versus quantas já qualificam para o
          próximo nível. */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={portfolioSize >= 3 ? "default" : "outline"}>
          {t("asmt.portfolio.size", { n: portfolioSize })}
        </Badge>
        {/* ENT-09-016 — indicador visual do mínimo de 3, além do número no badge. */}
        <Progress
          value={Math.min(100, (portfolioSize / 3) * 100)}
          className="h-1.5 w-24"
          aria-label={t("asmt.portfolio.size", { n: portfolioSize })}
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
      {canPropose && portfolioSize < 3 && (
        <p className="mb-3 text-xs text-muted-foreground">{t("asmt.portfolio.minimumHint")}</p>
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
}

/**
 * ESPECIFICACAO-OITAVA-RODADA, Seção 18 / ORIENTACAO-NONA-RODADA ENT-09-011
 * — "Começar/Parar/Continuar", mesma governança de escrita do resto do
 * assessment: só o dono escreve em `Draft`, só o Tech Lead complementa em
 * `In Review`, e tudo trava em `Completed` (o backend já bloqueia; aqui só
 * espelha para não abrir campo editável que vai apanhar 403).
 */
function DevelopmentSummarySection({
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

  if (isPending) {
    return (
      <SectionCard
        className="mb-4"
        title={t("asmt.devSummary.title")}
        description={t("asmt.devSummary.subtitle")}
      >
        <div className="grid gap-3 md:grid-cols-3" aria-busy="true" aria-live="polite">
          <span className="sr-only">{t("common.loading")}</span>
          <div className="h-24 animate-pulse rounded-md bg-secondary" />
          <div className="h-24 animate-pulse rounded-md bg-secondary" />
          <div className="h-24 animate-pulse rounded-md bg-secondary" />
        </div>
      </SectionCard>
    );
  }

  if (isError || !data) {
    return (
      <SectionCard
        className="mb-4"
        title={t("asmt.devSummary.title")}
        description={t("asmt.devSummary.subtitle")}
      >
        <p className="text-sm text-destructive" role="alert">
          {t("asmt.devSummary.loadError")}
        </p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => void refetch()}>
          {t("common.retry")}
        </Button>
      </SectionCard>
    );
  }

  return (
    <DevelopmentSummaryForm
      key={data.version}
      assessmentId={assessment.id}
      data={data}
      canEdit={canEdit}
      queryKey={queryKey}
      onReload={() => void refetch()}
    />
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
    api
      .updateAssessmentDevelopmentSummary(
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
          {t("asmt.devSummary.lastUpdated", { data: formatDate(data.updatedAt, locale) ?? "" })}
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

/** Rótulos e ordem do ciclo de vida da avaliação. */
