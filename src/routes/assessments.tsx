import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Fragment, useState } from "react";

import { GapBadge, LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { CapabilityCombobox } from "@/components/app/CapabilityCombobox";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Textarea } from "@/components/ui/textarea";
import type { Assessment, AssessmentComment, CompetencyCategory, Level } from "@/lib/domain";
import type { CommentInput } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { useI18n, type I18nApi } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import { useSelectors, useStore } from "@/lib/store";
import { formatDate } from "@/lib/text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assessments")({
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
  const [architectId, setArchitectId] = useState(store.architects[0]?.id ?? "");
  const { t } = useI18n();
  const labels = useLabels();
  const user = useCurrentUser();
  const [categoryIds, setCategoryIds] = useState<string[]>(() =>
    store.categories[0] ? [store.categories[0].id] : [],
  );
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const assessment = sel.assessmentFor(architectId);

  /**
   * Quem pode escrever o quê agora — espelha a regra do backend
   * (`checkAssessmentWrite` em `assessments.ts`), para o campo já nascer
   * desabilitado em vez de deixar a pessoa preencher e só depois descobrir,
   * pelo 403, que não podia. Ver PLANO-360-AGENTES-SYNAPSE.md, Seção 9.
   */
  const isAdmin = user.role === "admin";
  const isOwner = user.architectId === architectId;
  const isCompleted = assessment?.status === "Completed";
  const canEditSelf = !isAdmin && isOwner && !isCompleted;
  const canEditLeaderFinal = isAdmin && !isCompleted;
  const canSubmit = !isAdmin && isOwner && assessment?.status === "Draft";
  const canComplete = isAdmin && assessment && assessment.status !== "Completed";

  /** Capacidades escolhidas, na ordem do catálogo — não na ordem de clique. */
  const selected = store.categories.filter((c) => categoryIds.includes(c.id));

  const toggleCategory = (id: string) =>
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const transition = (status: Assessment["status"]) => {
    if (!assessment) return;
    setTransitionError(null);
    setTransitioning(true);
    store
      .setAssessmentStatus(assessment.id, status)
      .catch((error: unknown) =>
        setTransitionError(
          error instanceof Error
            ? error.message
            : t(status === "Completed" ? "asmt.completeError" : "asmt.submitError"),
        ),
      )
      .finally(() => setTransitioning(false));
  };

  return (
    <>
      <PageHeader
        title={t("asmt.title")}
        description={t("asmt.subtitle")}
        actions={
          <div className="flex gap-2">
            <select
              aria-label={t("asmt.architect")}
              className="rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={architectId}
              onChange={(e) => setArchitectId(e.target.value)}
            >
              {store.architects.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <CapabilityCombobox
              categories={store.categories}
              selected={selected}
              onToggle={toggleCategory}
              onSelectAll={setCategoryIds}
            />
          </div>
        }
      />

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
              <Button size="sm" disabled={transitioning} onClick={() => transition("In Review")}>
                {transitioning ? t("asmt.submitting") : t("asmt.submit")}
              </Button>
            )}
            {canComplete && (
              <Button
                size="sm"
                variant="secondary"
                disabled={transitioning}
                onClick={() => transition("Completed")}
              >
                {transitioning ? t("asmt.completing") : t("asmt.complete")}
              </Button>
            )}
          </div>
          {transitionError && (
            <p className="w-full text-xs text-destructive" role="alert">
              {transitionError}
            </p>
          )}
        </div>
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
          {selected.map((cat) => {
            const comps = store.competencies.filter((c) => c.categoryId === cat.id);
            return (
              <SectionCard
                key={cat.id}
                title={cat.name}
                description={
                  comps.length === 1
                    ? t("asmt.competencyCount.one")
                    : t("asmt.competencyCount.many", { n: comps.length })
                }
              >
                {comps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("asmt.noCompetencies")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-2">{t("asmt.col.competency")}</th>
                          <th className="w-24 py-2 text-center">{t("asmt.col.self")}</th>
                          <th className="w-24 py-2 text-center">{t("asmt.col.techLead")}</th>
                          <th className="w-24 py-2 text-center">{t("asmt.col.target")}</th>
                          <th className="w-24 py-2 text-center">{t("asmt.col.final")}</th>
                          <th className="w-44 py-2">{t("asmt.col.gap")}</th>
                          <th className="w-24 py-2 text-right">{t("asmt.col.notes")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comps.map((c) => {
                          const item = assessment.items.find((i) => i.competencyId === c.id);
                          if (!item) return null;
                          const gap = item.target - item.final;
                          const diverges = item.self !== item.leader;
                          return (
                            <Fragment key={c.id}>
                              <tr className="border-b border-border/60">
                                <td className="py-2 font-medium">{c.name}</td>
                                <td className="px-1 py-2">
                                  {canEditSelf ? (
                                    <LevelSelect
                                      value={item.self}
                                      onChange={(v) =>
                                        store.updateAssessmentItem(assessment.id, c.id, { self: v })
                                      }
                                    />
                                  ) : (
                                    <LevelBadge level={item.self} />
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
                                      />
                                    ) : (
                                      <LevelBadge level={item.leader} />
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
                                    />
                                  ) : (
                                    <LevelBadge level={item.final} />
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
                                    <CommentSection
                                      comments={item.comments}
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
 * Par de comentários de uma competência: a nota do arquiteto e a resposta do
 * Tech Lead entram juntas, num único Salvar. Salvar só é permitido com os dois
 * lados preenchidos — meia conversa registrada não serve de evidência depois.
 *
 * O texto novo só aparece na lista após o servidor confirmar, porque é ele quem
 * carimba a data.
 */
function CommentSection({
  comments,
  onCreate,
  onUpdate,
  onDelete,
}: {
  comments: readonly AssessmentComment[];
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
          {comments.map((comment) =>
            editing === comment.id ? (
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
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("comment.architect")}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{comment.architectText}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("comment.techLead")}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{comment.techLeadText}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">
                    {t("comment.savedAt", { data: formatDate(comment.createdAt, locale) ?? "" })}
                    {comment.updatedAt &&
                      ` · ${t("comment.editedAt", { data: formatDate(comment.updatedAt, locale) ?? "" })}`}
                  </p>
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
                </div>
              </li>
            ),
          )}
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

/**
 * Formulário do par. A regra de "os dois preenchidos" é validada aqui e também
 * no backend; a mensagem diz exatamente qual lado falta, em vez de só bloquear
 * o botão sem explicar.
 */
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
  const [architectText, setArchitectText] = useState(initial?.architectText ?? "");
  const [techLeadText, setTechLeadText] = useState(initial?.techLeadText ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const arquiteto = architectText.trim();
  const techLead = techLeadText.trim();

  /** Mensagem do que falta, ou null quando o par está completo. */
  const faltando =
    !arquiteto && !techLead
      ? t("comment.needBoth")
      : !arquiteto
        ? t("comment.needArchitect")
        : !techLead
          ? t("comment.needTechLead")
          : null;

  const submit = () => {
    if (faltando || saving) return;
    setError(null);
    setSaving(true);
    onSubmit({ architectText: arquiteto, techLeadText: techLead })
      .then(() => {
        if (!initial) {
          setArchitectText("");
          setTechLeadText("");
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t("comment.saveError")))
      .finally(() => setSaving(false));
  };

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Comentário do arquiteto</p>
          <Textarea
            value={architectText}
            onChange={(e) => setArchitectText(e.target.value)}
            placeholder={t("comment.architectPlaceholder")}
            aria-label="Comentário do arquiteto"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Comentário do Tech Lead</p>
          <Textarea
            value={techLeadText}
            onChange={(e) => setTechLeadText(e.target.value)}
            placeholder={t("comment.techLeadPlaceholder")}
            aria-label="Comentário do Tech Lead"
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" role="status">
          {error ? <span className="text-destructive">{error}</span> : faltando}
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <Button size="sm" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button size="sm" disabled={saving || faltando !== null} onClick={submit}>
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

function LevelSelect({ value, onChange }: { value: number; onChange: (v: Level) => void }) {
  return (
    <select
      className="w-full rounded-md border border-input bg-card px-2 py-1 text-sm"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) as Level)}
    >
      {[1, 2, 3, 4, 5].map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  );
}

/** Rótulos e ordem do ciclo de vida da avaliação. */
