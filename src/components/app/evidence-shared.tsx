import { useState } from "react";

import { semanticTone } from "@/components/app/ui-bits";
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
import { useArchitectProfileViewModel, useSuccessToast, useToastSubmit } from "@/hooks";
import type { DevelopmentPlan, Evidence, EvidenceType } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import { useVocabulary } from "@/lib/store";
import { defaultDateFormatter } from "@/lib/text";

/**
 * Lido em FUNÇÃO, e não numa constante de módulo.
 *
 * `semanticTone` mora em `ui-bits`, e o grafo de importação da casa tem ciclo:
 * na ordem de inicialização do pacote de SSR de produção, este módulo chegava a
 * rodar ANTES de `ui-bits` terminar, e o mapa nascia lendo `undefined.warning`.
 * O sintoma não aparecia em nenhum teste (jsdom importa noutra ordem) nem no
 * `build` — só no pod, como 500 na sonda de prontidão e canário abortado.
 *
 * Chamar na hora de desenhar tira a dependência de ORDEM: quando o componente
 * renderiza, todo módulo já terminou de carregar.
 */
class EvidenceStatusChips {
  static byStatus(): Record<Evidence["status"], string> {
    return {
      Pending: "bg-secondary text-muted-foreground",
      Accepted: semanticTone.success,
      "Needs Improvement": semanticTone.warning,
      Rejected: "bg-destructive/15 text-destructive",
    };
  }
}

export function EvidenceStatusBadge({ status }: { status: Evidence["status"] }) {
  const labels = useLabels();
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${EvidenceStatusChips.byStatus()[status]}`}
    >
      {labels.evidenceStatus[status]}
    </span>
  );
}

export function EvidenceDialog({
  architectId,
  plan,
}: {
  architectId: string;
  plan: DevelopmentPlan | undefined;
}) {
  const planItems = plan?.items ?? [];
  const { t } = useI18n();
  const labels = useLabels();
  const viewModel = useArchitectProfileViewModel();

  const evidenceTypes = useVocabulary("EVIDENCE_TYPE");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState(() => evidenceTypes.options[0]?.code ?? "");
  const [date, setDate] = useState(defaultDateFormatter.todayIso());
  const [complexity, setComplexity] = useState<"Low" | "Medium" | "High">("Medium");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("");
  const [url, setUrl] = useState("");
  const [issuer, setIssuer] = useState("");
  const [pdiItemId, setPdiItemId] = useState("");

  const { submitting: saving, run } = useToastSubmit();
  const notifySuccess = useSuccessToast();
  const isCertification = type === "Certification";

  const salvar = async () => {
    const nome = title.trim();
    if (!nome || !type) return;
    const result = await run(() =>
      viewModel.registerEvidence(architectId, {
        title,
        description,
        type: type as EvidenceType,
        date,
        complexity,
        project,
        url,
        issuer,
        pdiItemId,
      }),
    );
    if (!result.ok) return;
    notifySuccess("msg.evidence.create.success", { titulo: nome }, result.value);
    setTitle("");
    setDescription("");
    setProject("");
    setUrl("");
    setIssuer("");
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
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && salvar()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ev-type">{t("ev.field.type")}</Label>
              <select
                id="ev-type"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                {evidenceTypes.options.map((option) => (
                  <option key={option.code} value={option.code}>
                    {evidenceTypes.label(option.code)}
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
                onChange={(event) => setDate(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && salvar()}
              />
            </div>
          </div>
          {isCertification && (
            <div>
              <Label htmlFor="ev-issuer">{t("ev.field.issuer")}</Label>
              <Input
                id="ev-issuer"
                value={issuer}
                onChange={(event) => setIssuer(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && salvar()}
              />
            </div>
          )}
          <div>
            <Label htmlFor="ev-complexity">{t("ev.field.complexity")}</Label>
            <select
              id="ev-complexity"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={complexity}
              onChange={(event) => setComplexity(event.target.value as "Low" | "Medium" | "High")}
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
              onChange={(event) => setProject(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && salvar()}
            />
          </div>
          <div>
            <Label htmlFor="ev-url">{t("ev.field.link")}</Label>
            <Input
              id="ev-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && salvar()}
            />
          </div>
          <div>
            <Label htmlFor="ev-description">{t("ev.field.description")}</Label>
            <Textarea
              id="ev-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {planItems.length > 0 && (
            <div>
              <Label htmlFor="ev-pdi">{t("ev.field.pdiLink")}</Label>
              <select
                id="ev-pdi"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={pdiItemId}
                onChange={(event) => setPdiItemId(event.target.value)}
              >
                <option value="">{t("ev.field.pdiLink.none")}</option>
                {planItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.objective || item.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            {t("ev.resubmit.cancel")}
          </Button>
          <Button disabled={!title.trim() || saving} onClick={() => void salvar()}>
            {saving ? t("ev.saving") : t("ev.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResubmitEvidenceDialog({ evidence }: { evidence: Evidence }) {
  const { t } = useI18n();
  const viewModel = useArchitectProfileViewModel();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(evidence.description);
  const [url, setUrl] = useState(evidence.url ?? "");

  const { submitting: saving, run } = useToastSubmit();
  const notifySuccess = useSuccessToast();

  const submit = async () => {
    const result = await run(() => viewModel.resubmit(evidence, { description, url }));
    if (!result.ok) return;
    notifySuccess("msg.evidence.resubmit.success", { titulo: evidence.title }, result.value);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDescription(evidence.description);
          setUrl(evidence.url ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-auto px-0 text-xs">
          {t("ev.resubmit.action")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ev.resubmit.title")}</DialogTitle>
        </DialogHeader>
        {evidence.leaderComment && (
          <p className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
            "{evidence.leaderComment}"
          </p>
        )}
        <div className="grid gap-3">
          <div>
            <Label htmlFor="ev-resubmit-description">{t("ev.field.description")}</Label>
            <Textarea
              id="ev-resubmit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ev-resubmit-url">{t("ev.field.link")}</Label>
            <Input
              id="ev-resubmit-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            {t("ev.resubmit.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? t("ev.resubmit.saving") : t("ev.resubmit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
