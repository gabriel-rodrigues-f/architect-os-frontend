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
  progressFor,
  type DevelopmentPlan,
  type Evidence,
  type EvidenceType,
} from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
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
  /** OKR, evidência e certificação são da pessoa — só ela (ou admin) registra; backend já recusa o resto. */
  const isAdmin = user.role === "admin";
  const canEditOwn = isAdmin || user.architectId === architectId;
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
  const swot = sel.swotFor(architect.id);
  // Sem o cycleId, uma pessoa com OKR em mais de um ciclo podia mostrar o
  // objetivo errado — o primeiro que o array trouxesse, não o do ciclo em
  // foco. Ver AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 25.
  const okr = store.okrs.find(
    (o) => o.architectId === architect.id && o.cycleId === store.activeCycleId,
  );
  const sessions = store.mentoringSessions.filter((m) => m.menteeId === architect.id);
  const evidences = store.evidences.filter((e) => e.architectId === architect.id);
  const certifications = store.certifications.filter((c) => c.architectId === architect.id);
  const paths = store.learningPaths.filter((p) => p.assignedTo.includes(architect.id));
  const score = sel.developmentScore(architect.id);
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

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("arch.stat.devIndex")}
          value={`${score}`}
          hint={t("arch.stat.devIndexHint")}
        />
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
        <StatCard
          label="9 Box"
          value={`${architect.performance}/${architect.potential}`}
          hint={t("arch.stat.nineboxHint")}
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
            {gaps.slice(0, 8).map((g) => (
              <li
                key={g.item.competencyId}
                className="flex items-center justify-between gap-3 surface-inset p-2.5"
              >
                <span className="truncate text-sm">{g.competency?.name}</span>
                <span className="flex items-center gap-2">
                  <LevelBadge level={g.item.final} />
                  <span className="text-xs text-muted-foreground">→ {g.item.target}</span>
                  <GapBadge gap={g.gap} />
                </span>
              </li>
            ))}
            {!gaps.length && <p className="text-sm text-muted-foreground">{t("arch.gaps.none")}</p>}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard title="PDI" description={t("arch.plan.subtitle")}>
          <ul className="space-y-3">
            {(plan?.items ?? []).map((i) => (
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
                <Bar value={i.progress} className="mt-2" />
              </li>
            ))}
            {!plan?.items.length && (
              <p className="text-sm text-muted-foreground">{t("arch.plan.none")}</p>
            )}
          </ul>
        </SectionCard>

        <SectionCard title={t("arch.swot.title")} description={t("arch.swot.subtitle")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Swot title={t("swot.strengths")} items={swot?.strengths ?? []} />
            <Swot title={t("swot.weaknesses")} items={swot?.weaknesses ?? []} />
            <Swot title={t("swot.opportunities")} items={swot?.opportunities ?? []} />
            <Swot title={t("swot.threats")} items={swot?.threats ?? []} />
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <SectionCard title={t("arch.okr.title")} description={t("arch.okr.subtitle")}>
          {okr ? (
            <div>
              <p className="text-sm font-medium">{okr.objective}</p>
              <ul className="mt-2 space-y-2">
                {okr.keyResults.map((k) => (
                  <li key={k.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{k.title}</p>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {k.progress}%
                      </span>
                    </div>
                    <Bar value={k.progress} className="mt-1" />
                    {/* O progresso do KR é acompanhado aqui: antes só era exibido. */}
                    {canEditOwn && (
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={k.progress}
                        aria-label={`Progresso de ${k.title}`}
                        onChange={(e) =>
                          store.updateKeyResult(okr.id, k.id, Number(e.target.value))
                        }
                        className="mt-1 w-full accent-primary"
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("arch.okr.none")}</p>
          )}
        </SectionCard>

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
                  {labels.evidenceType[e.type]} · {formatDate(e.date, locale)} · complexidade{" "}
                  {labels.complexity[e.complexity]}
                </p>
                {e.leaderComment && (
                  <p className="mt-1 text-xs text-muted-foreground">"{e.leaderComment}"</p>
                )}
                {isAdmin && <EvidenceReviewDialog evidence={e} />}
              </li>
            ))}
            {!evidences.length && (
              <p className="text-sm text-muted-foreground">{t("arch.evidence.none")}</p>
            )}
          </ul>
        </SectionCard>

        <SectionCard
          title={t("arch.cert.title")}
          description={t("arch.cert.subtitle")}
          actions={canEditOwn ? <CertificationDialog architectId={architect.id} /> : undefined}
        >
          <ul className="space-y-2">
            {certifications.map((c) => (
              <li key={c.id} className="surface-inset p-2.5">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.issuer} · {c.year}
                </p>
              </li>
            ))}
            {!certifications.length && (
              <p className="text-sm text-muted-foreground">{t("arch.cert.none")}</p>
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

function Swot({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="surface-inset p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
        {!items.length && <li className="list-none text-muted-foreground">—</li>}
      </ul>
    </div>
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
  const [pdiItemId, setPdiItemId] = useState("");

  const salvar = () => {
    const nome = title.trim();
    if (!nome) return;
    const id = `ev-${Date.now()}`;
    store.addEvidence({
      id,
      architectId,
      title: nome,
      description: description.trim(),
      type,
      competencyIds: [],
      date,
      complexity,
      status: "Pending",
      ...(project.trim() ? { project: project.trim() } : {}),
      ...(url.trim() ? { url: url.trim() } : {}),
    });
    if (pdiItemId && plan) {
      const item = planItems.find((i) => i.id === pdiItemId);
      if (item) {
        store.updatePlanItem(plan.id, pdiItemId, { evidenceIds: [...item.evidenceIds, id] });
      }
    }
    toast.success(t("ev.toast", { titulo: nome }));
    setTitle("");
    setDescription("");
    setProject("");
    setUrl("");
    setPdiItemId("");
    setOpen(false);
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

  const salvar = () => {
    store.reviewEvidence(evidence.id, {
      status,
      ...(comment.trim() ? { leaderComment: comment.trim() } : {}),
    });
    toast.success(
      t("ev.review.toast", { titulo: evidence.title, status: labels.evidenceStatus[status] }),
    );
    setOpen(false);
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
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar}>{t("ev.review.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Certificações não tinham tela nenhuma — nem listagem, nem cadastro. */
function CertificationDialog({ architectId }: { architectId: string }) {
  const { t } = useI18n();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const salvar = () => {
    if (!name.trim() || !issuer.trim()) return;
    store.addCertification({
      id: `cert-${Date.now()}`,
      architectId,
      name: name.trim(),
      issuer: issuer.trim(),
      year: Number(year) || new Date().getFullYear(),
    });
    setName("");
    setIssuer("");
    setOpen(false);
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
          <DialogTitle>{t("cert.dialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="cert-name">{t("cert.field.name")}</Label>
            <Input
              id="cert-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && salvar()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cert-issuer">{t("cert.field.issuer")}</Label>
              <Input
                id="cert-issuer"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvar()}
              />
            </div>
            <div>
              <Label htmlFor="cert-year">{t("cert.field.year")}</Label>
              <Input
                id="cert-year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvar()}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={!name.trim() || !issuer.trim()} onClick={salvar}>
            {t("cert.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
