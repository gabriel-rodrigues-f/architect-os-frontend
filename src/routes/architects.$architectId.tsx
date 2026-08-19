import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { DomainRadar } from "@/components/app/charts";
import {
  Bar,
  GapBadge,
  Initials,
  LevelBadge,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/app/ui-bits";
import { useLabels } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  EVIDENCE_TYPES,
  evidencesForPlanItem,
  progressFor,
  type DevelopmentPlan,
  type Evidence,
  type EvidenceType,
} from "@/lib/domain";
import { isLeadCapable } from "@/lib/api";
import { authErrorMessage, useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { averageWithCoverage } from "@/lib/selectors";
import { useSelectors, useStore } from "@/lib/store";
import { formatDate, todayIso } from "@/lib/text";

export const Route = createFileRoute("/architects/$architectId")({
  head: () => ({
    meta: [
      { title: "Architect Profile — Synapse" },
      {
        name: "description",
        content:
          "Perfil completo do arquiteto: competências, gaps, PDI, metas, mentorias e evidências.",
      },
      { property: "og:title", content: "Architect Profile — Synapse" },
      {
        property: "og:description",
        content: "Visão 360 do desenvolvimento técnico individual do Arquiteto de Soluções.",
      },
    ],
  }),
  component: ArchitectProfile,
  notFoundComponent: ArchitectNotFound,
});

/** Componente próprio para poder usar o hook de idioma. */
function ArchitectNotFound() {
  const { t } = useI18n();
  return <p className="text-sm text-muted-foreground">{t("arch.notFound")}</p>;
}

function ArchitectProfile() {
  const { architectId } = Route.useParams();
  const store = useStore();
  const sel = useSelectors();
  const labels = useLabels();
  const { t, locale } = useI18n();
  const user = useCurrentUser();
  /** Evidência é da pessoa — só ela (ou o Tech Lead dela) registra; backend já recusa o resto. */
  const isLead = isLeadCapable(user.role);
  const canEditOwn = isLead || user.architectId === architectId;
  const architect = sel.architectById(architectId);

  if (!architect) {
    return (
      <div className="surface-card p-6 text-sm">
        Arquiteto não encontrado.{" "}
        <Link to="/team" className="text-primary underline">
          Voltar ao time
        </Link>
      </div>
    );
  }

  const gaps = sel.gapsFor(architect.id).filter((g) => g.gap > 0);
  const domains = sel.domainAverages(architect.id);
  const plan = sel.planFor(architect.id);
  const sessions = store.mentoringSessions.filter((m) => m.menteeId === architect.id);
  const evidences = store.evidences.filter((e) => e.architectId === architect.id);
  /**
   * Histórico de avaliações: um assessment por ciclo já concluído, mais
   * recente primeiro. Sem isto o workspace da pessoa não tinha nenhuma vista
   * de "como ela evoluiu" — só o ciclo atual. Ver AUDITORIA-TERCEIRA-RODADA-
   * RECONSTRUCAO-PRODUTO-SYNAPSE.md, EPIC G.
   */
  const assessmentHistory = store.assessments
    .filter((a) => a.architectId === architect.id)
    .map((a) => ({ assessment: a, cycle: store.cycles.find((c) => c.id === a.cycleId) }))
    .sort((x, y) => (y.cycle?.start ?? "").localeCompare(x.cycle?.start ?? ""));
  const paths = store.learningPaths.filter((p) => p.assignedTo.includes(architect.id));
  const {
    avg,
    covered: coveredDomains,
    total: totalDomains,
  } = averageWithCoverage(domains.map((d) => d.avg));

  return (
    <>
      <PageHeader
        title={architect.name}
        description={`${architect.role} · ${architect.specialization} · ${architect.yearsAsArchitect} anos como arquiteto`}
        actions={
          <Link
            to="/team"
            className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
          >
            {t("arch.back")}
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label={t("arch.stat.avgLevel")}
          value={avg === undefined ? "—" : avg.toFixed(2)}
          hint={
            coveredDomains < totalDomains
              ? t("arch.stat.avgLevelHintPartial", { covered: coveredDomains, total: totalDomains })
              : t("arch.stat.avgLevelHint")
          }
        />
        <StatCard
          label={t("arch.stat.openGaps")}
          value={`${gaps.length}`}
          hint={t("arch.stat.openGapsHint")}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title={t("arch.radar.title")} description={t("arch.radar.subtitle")}>
          <DomainRadar
            data={domains.map((d) => ({
              domain: d.category.short,
              atual: d.avg ?? 0,
              alvo: d.target ?? 0,
            }))}
          />
        </SectionCard>

        <SectionCard title={t("arch.gaps.title")} description={t("arch.gaps.subtitle")}>
          <ul className="space-y-2">
            {gaps.slice(0, 8).map((g) => {
              const inPlan = plan?.items.some((i) => i.competencyId === g.item.competencyId);
              return (
                <li
                  key={g.item.competencyId}
                  className="flex items-center justify-between gap-3 surface-inset p-2.5"
                >
                  <span className="truncate text-sm">{g.competency?.name}</span>
                  <span className="flex items-center gap-2">
                    <LevelBadge level={g.item.final} />
                    <span className="text-xs text-muted-foreground">→ {g.item.target}</span>
                    <GapBadge gap={g.gap} />
                    {canEditOwn && !inPlan && (
                      <Link
                        to="/development-plans"
                        search={{ architectId: architect.id }}
                        className="whitespace-nowrap text-xs text-primary hover:underline"
                      >
                        {t("arch.gaps.addToPlan")}
                      </Link>
                    )}
                  </span>
                </li>
              );
            })}
            {!gaps.length && <p className="text-sm text-muted-foreground">{t("arch.gaps.none")}</p>}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title={t("arch.history.title")} description={t("arch.history.subtitle")}>
          <ul className="space-y-2">
            {assessmentHistory.map(({ assessment, cycle }) => (
              <li
                key={assessment.id}
                className="flex items-center justify-between gap-3 surface-inset p-2.5"
              >
                <span className="text-sm font-medium">{cycle?.name ?? assessment.cycleId}</span>
                <span className="flex items-center gap-2">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                    {labels.assessmentStatus[assessment.status]}
                  </span>
                  <Link
                    to="/assessments"
                    search={{ architectId: architect.id }}
                    className="whitespace-nowrap text-xs text-primary hover:underline"
                  >
                    {t("arch.history.view")}
                  </Link>
                </span>
              </li>
            ))}
            {!assessmentHistory.length && (
              <p className="text-sm text-muted-foreground">{t("arch.history.none")}</p>
            )}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="PDI" description={t("arch.plan.subtitle")}>
          <ul className="space-y-3">
            {(plan?.items ?? []).map((i) => {
              const itemEvidences = evidencesForPlanItem(evidences, i.id);
              return (
                <li key={i.id} className="surface-inset p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {sel.competencyById(i.competencyId)?.name ?? t("pdi.unknownCompetency")}
                    </p>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                      {labels.planItemStatus[i.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {labels.actionType[i.actionType]} · {i.actionPlan} · prazo{" "}
                    {formatDate(i.targetDate, locale)}
                  </p>
                  {itemEvidences.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {itemEvidences.map((e) => (
                        <li key={e.id} className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">{e.title}</span>
                          <EvidenceStatusBadge status={e.status} labels={labels} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
            {!plan?.items.length && (
              <p className="text-sm text-muted-foreground">{t("arch.plan.none")}</p>
            )}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title={t("arch.paths.title")} description={t("arch.paths.subtitle")}>
          <ul className="space-y-2">
            {paths.map((p) => {
              const values = p.items.map((i) => progressFor(p, architect.id, i.id).progress);
              const value = values.length
                ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
                : 0;
              return (
                <li key={p.id} className="surface-inset p-2.5">
                  <p className="text-sm font-medium">{p.name}</p>
                  <Bar className="mt-1.5" value={value} />
                </li>
              );
            })}
            {!paths.length && (
              <p className="text-sm text-muted-foreground">{t("arch.paths.none")}</p>
            )}
          </ul>
        </SectionCard>

        <SectionCard
          title={t("arch.evidence.title")}
          description={t("arch.evidence.subtitle")}
          actions={
            canEditOwn ? <EvidenceDialog architectId={architect.id} plan={plan} /> : undefined
          }
        >
          <ul className="space-y-2">
            {evidences.map((e) => (
              <li key={e.id} className="surface-inset p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{e.title}</p>
                  <EvidenceStatusBadge status={e.status} labels={labels} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {labels.evidenceType[e.type]}
                  {e.issuer ? ` · ${e.issuer}` : ""} · {formatDate(e.date, locale)} · complexidade{" "}
                  {labels.complexity[e.complexity]}
                </p>
                {e.leaderComment && (
                  <p className="mt-1 text-xs text-muted-foreground">"{e.leaderComment}"</p>
                )}
                {isLead && <EvidenceReviewDialog evidence={e} />}
              </li>
            ))}
            {!evidences.length && (
              <p className="text-sm text-muted-foreground">{t("arch.evidence.none")}</p>
            )}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        className="mt-6"
        title={t("arch.mentoring.title")}
        description={t("arch.mentoring.count", { n: sessions.length })}
      >
        <ol className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-start gap-3 surface-inset p-3">
              <Initials name={s.mentor} />
              <div>
                <p className="text-sm font-medium">{s.topic}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(s.date, locale)} · {s.durationMin} min · mentor {s.mentor}
                </p>
                <p className="mt-1 text-sm">{s.actions}</p>
              </div>
            </li>
          ))}
          {!sessions.length && (
            <p className="text-sm text-muted-foreground">{t("arch.mentoring.none")}</p>
          )}
        </ol>
      </SectionCard>
    </>
  );
}

const EVIDENCE_STATUS_TONE: Record<Evidence["status"], string> = {
  Pending: "bg-secondary text-muted-foreground",
  Accepted: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "Needs Improvement": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Rejected: "bg-destructive/15 text-destructive",
};

function EvidenceStatusBadge({
  status,
  labels,
}: {
  status: Evidence["status"];
  labels: ReturnType<typeof useLabels>;
}) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${EVIDENCE_STATUS_TONE[status]}`}
    >
      {labels.evidenceStatus[status]}
    </span>
  );
}

/**
 * Registro de evidência. A entidade já existia no domínio e na API, mas não
 * havia nenhuma tela para criá-la — só para listar. O vínculo opcional com um
 * item do PDI fecha o loop Gap → PDI → Atividade → Evidência. Ver AUDITORIA-
 * RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 30.
 */
function EvidenceDialog({
  architectId,
  plan,
}: {
  architectId: string;
  plan: DevelopmentPlan | undefined;
}) {
  const planItems = plan?.items ?? [];
  const { t } = useI18n();
  const labels = useLabels();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EvidenceType>(EVIDENCE_TYPES[0] as EvidenceType);
  const [date, setDate] = useState(todayIso());
  const [complexity, setComplexity] = useState<"Low" | "Medium" | "High">("Medium");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [url, setUrl] = useState("");
  const [issuer, setIssuer] = useState("");
  const [pdiItemId, setPdiItemId] = useState("");
  const [saving, setSaving] = useState(false);
  const isCertification = type === "Certification";

  /**
   * Sem id local nem sucesso otimista: o servidor gera o id de verdade e é
   * quem decide se o registro vale — só fecha o diálogo depois da resposta.
   * Ver AUDITORIA-QUINTA-RODADA-360-SYNAPSE-2026-08-19.md, IDOR-001/EVD-001.
   */
  const salvar = async () => {
    const nome = title.trim();
    if (!nome) return;
    setSaving(true);
    try {
      await store.addEvidence({
        id: "",
        architectId,
        title: nome,
        description: description.trim(),
        type,
        // Sem competência escolhida na tela: se ligada a um item do PDI, o
        // servidor herda a competência do item automaticamente (EPIC 2).
        competencyIds: [],
        date,
        complexity,
        status: "Pending",
        ...(project.trim() ? { project: project.trim() } : {}),
        ...(url.trim() ? { url: url.trim() } : {}),
        ...(isCertification && issuer.trim() ? { issuer: issuer.trim() } : {}),
        ...(pdiItemId ? { developmentPlanItemId: pdiItemId } : {}),
      });
      toast.success(t("ev.toast", { titulo: nome }));
      setTitle("");
      setDescription("");
      setProject("");
      setUrl("");
      setIssuer("");
      setPdiItemId("");
      setOpen(false);
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          {t("arch.register")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ev.dialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="ev-title">{t("ev.field.title")}</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ev-type">{t("ev.field.type")}</Label>
              <select
                id="ev-type"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as EvidenceType)}
              >
                {EVIDENCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="ev-date">{t("ev.field.date")}</Label>
              <Input
                id="ev-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvar()}
              />
            </div>
          </div>
          {isCertification && (
            <div>
              <Label htmlFor="ev-issuer">{t("ev.field.issuer")}</Label>
              <Input
                id="ev-issuer"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvar()}
              />
            </div>
          )}
          <div>
            <Label htmlFor="ev-complexity">{t("ev.field.complexity")}</Label>
            <select
              id="ev-complexity"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={complexity}
              onChange={(e) => setComplexity(e.target.value as "Low" | "Medium" | "High")}
            >
              <option value="Low">{labels.complexity.Low}</option>
              <option value="Medium">{labels.complexity.Medium}</option>
              <option value="High">{labels.complexity.High}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="ev-project">{t("ev.field.project")}</Label>
            <Input
              id="ev-project"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
            />
          </div>
          <div>
            <Label htmlFor="ev-url">{t("ev.field.link")}</Label>
            <Input
              id="ev-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
            />
          </div>
          <div>
            <Label htmlFor="ev-description">{t("ev.field.description")}</Label>
            <Textarea
              id="ev-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {planItems.length > 0 && (
            <div>
              <Label htmlFor="ev-pdi">{t("ev.field.pdiLink")}</Label>
              <select
                id="ev-pdi"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={pdiItemId}
                onChange={(e) => setPdiItemId(e.target.value)}
              >
                <option value="">{t("ev.field.pdiLink.none")}</option>
                {planItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.objective || i.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={!title.trim()} onClick={salvar}>
            {t("ev.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Revisão da evidência é decisão do Tech Lead — só admin vê este controle. */
function EvidenceReviewDialog({ evidence }: { evidence: Evidence }) {
  const { t } = useI18n();
  const labels = useLabels();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Evidence["status"]>(evidence.status);
  const [comment, setComment] = useState(evidence.leaderComment ?? "");
  const [saving, setSaving] = useState(false);

  /**
   * Sem otimismo: só fecha o diálogo e avisa sucesso depois que o servidor
   * confirmou a revisão — decisão de Tech Lead não pode aparecer "salva" e
   * não estar. Ver AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-
   * SYNAPSE.md, EPIC L.
   */
  const salvar = async () => {
    setSaving(true);
    try {
      await store.reviewEvidence(evidence.id, {
        status,
        ...(comment.trim() ? { leaderComment: comment.trim() } : {}),
      });
      toast.success(
        t("ev.review.toast", { titulo: evidence.title, status: labels.evidenceStatus[status] }),
      );
      setOpen(false);
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setStatus(evidence.status);
          setComment(evidence.leaderComment ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="mt-1 h-auto px-0 text-xs">
          {t("ev.review.action")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ev.review.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="ev-review-status">{t("ev.review.status")}</Label>
            <select
              id="ev-review-status"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as Evidence["status"])}
            >
              <option value="Pending">{labels.evidenceStatus.Pending}</option>
              <option value="Accepted">{labels.evidenceStatus.Accepted}</option>
              <option value="Needs Improvement">
                {labels.evidenceStatus["Needs Improvement"]}
              </option>
              <option value="Rejected">{labels.evidenceStatus.Rejected}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="ev-review-comment">{t("ev.review.comment")}</Label>
            <Textarea
              id="ev-review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={saving}>
            {saving ? t("ev.review.saving") : t("ev.review.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
