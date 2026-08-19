import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { GapBadge, Initials, LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROLES, type Architect, type RoleName } from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { averageWithCoverage } from "@/lib/selectors";
import { useSelectors, useStore } from "@/lib/store";
import { slug } from "@/lib/text";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Time — Synapse" },
      {
        name: "description",
        content:
          "Time de Arquitetos de Soluções, níveis médios, gaps e progresso de desenvolvimento.",
      },
      { property: "og:title", content: "Time — Synapse" },
      {
        property: "og:description",
        content: "Gestão do time de arquitetura: perfis, níveis e desenvolvimento.",
      },
    ],
  }),
  component: TeamPage,
});

interface ArchitectForm {
  name: string;
  role: RoleName;
  specialization: string;
  years: string;
  email: string;
}

const emptyForm = (): ArchitectForm => ({
  name: "",
  role: ROLES[0] as RoleName,
  specialization: "",
  years: "",
  email: "",
});

function TeamPage() {
  const store = useStore();
  const { t } = useI18n();
  const sel = useSelectors();
  /** Cadastro do roster é decisão administrativa — backend já recusa o resto. */
  const isAdmin = useCurrentUser().role === "admin";

  /** `null` = diálogo fechado; string vazia = criação; id = edição. */
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ArchitectForm>(emptyForm());
  const [confirmDeactivate, setConfirmDeactivate] = useState<Architect | null>(null);
  const activeArchitects = store.architects.filter((a) => a.active);
  const inactiveArchitects = store.architects.filter((a) => !a.active);

  const openCreate = () => {
    setForm(emptyForm());
    setEditing("");
  };

  const openEdit = (architect: Architect) => {
    setForm({
      name: architect.name,
      role: architect.role,
      specialization: architect.specialization,
      years: String(architect.yearsAsArchitect),
      email: architect.email,
    });
    setEditing(architect.id);
  };

  /**
   * Nada aqui tem fallback: e-mail inventado do nome e "1 ano" fantasma
   * escondiam dado que ninguém preencheu como se fosse real. Falta um campo,
   * o cadastro não salva — sem exceção. `strongDomain`/`gapDomain` saíram do
   * cadastro: força e lacuna são resultado do assessment (final × target),
   * não uma opinião prévia coletada antes de qualquer avaliação existir. Ver
   * AUDITORIA-RIGIDA-SEGUNDA-REVISAO-SYNAPSE.md, Seção 16 e 17, e AUDITORIA-
   * TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md, Seção 11.
   */
  const yearsValid =
    form.years.trim() !== "" && Number.isInteger(Number(form.years)) && Number(form.years) >= 0;
  const canSubmit =
    form.name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.email.includes("@") &&
    yearsValid;

  const submit = () => {
    if (!canSubmit) return;
    const payload = {
      name: form.name.trim(),
      role: form.role,
      yearsAsArchitect: Number(form.years),
      specialization: form.specialization.trim(),
      email: form.email.trim(),
    };

    if (editing) {
      store.updateArchitect(editing, payload);
      toast.success(t("team.edit.toast", { nome: payload.name }));
    } else {
      store.addArchitect({
        id: slug(form.name),
        ...payload,
        active: true,
      });
    }
    setEditing(null);
  };

  /**
   * "Excluir" virou "Desativar": apaga o cadastro em cascata (avaliações,
   * PDI, OKR, SWOT, mentorias, evidências, certificações) sempre destruiu
   * histórico de gente que só saiu do time. `active: false` some do roster
   * e dos agregados do Painel sem apagar nada — o perfil e o histórico
   * continuam abertos em /architects/:id. Ver AUDITORIA-RIGIDA-SEGUNDA-
   * REVISAO-SYNAPSE.md, Seção 18.
   */
  const deactivate = () => {
    if (!confirmDeactivate) return;
    store.updateArchitect(confirmDeactivate.id, { active: false });
    toast.success(t("team.deactivate.toast", { nome: confirmDeactivate.name }));
    setConfirmDeactivate(null);
  };

  const reactivate = (a: Architect) => {
    store.updateArchitect(a.id, { active: true });
    toast.success(t("team.reactivate.toast", { nome: a.name }));
  };

  return (
    <>
      <PageHeader
        title={t("team.title")}
        description={t("team.subtitle")}
        actions={isAdmin ? <Button onClick={openCreate}>{t("team.new")}</Button> : undefined}
      />

      {store.architects.length === 0 && (
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-medium">{t("team.empty.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("team.empty.hint")}</p>
          {isAdmin && (
            <Button className="mt-4" onClick={openCreate}>
              {t("team.empty.cta")}
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {activeArchitects.map((a) => {
          const top = sel.gapsFor(a.id).slice(0, 3);
          const { avg } = averageWithCoverage(sel.domainAverages(a.id).map((d) => d.avg));
          const hasOfficial = sel.officialAssessmentFor(a.id) !== undefined;
          return (
            <div key={a.id} className="surface-card p-5">
              <div className="flex items-start gap-3">
                <Initials name={a.name} />
                <div className="min-w-0 flex-1">
                  <Link
                    to="/architects/$architectId"
                    params={{ architectId: a.id }}
                    className="font-display text-base font-semibold hover:text-primary"
                  >
                    {a.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.role} · {a.yearsAsArchitect} anos · {a.specialization}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      aria-label={`Editar ${a.name}`}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeactivate(a)}
                      aria-label={`Desativar ${a.name}`}
                      title={t("team.deactivate.action")}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("team.card.avgLevel")}</span>
                <LevelBadge level={avg === undefined ? undefined : Math.round(avg)} showName />
              </div>

              <div className="mt-4 space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("team.card.topGaps")}
                </p>
                {top.map((g) => (
                  <div
                    key={g.item.competencyId}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate">{g.competency?.name}</span>
                    <GapBadge gap={g.gap} />
                  </div>
                ))}
                {top.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {hasOfficial ? t("team.card.noGaps") : t("team.card.notAssessed")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isAdmin && inactiveArchitects.length > 0 && (
        <SectionCard
          className="mt-6"
          title={t("team.inactive.title")}
          description={t("team.inactive.subtitle")}
        >
          <ul className="divide-y divide-border">
            {inactiveArchitects.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link
                    to="/architects/$architectId"
                    params={{ architectId: a.id }}
                    className="truncate text-sm font-medium hover:text-primary"
                  >
                    {a.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.role} · {a.specialization}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => reactivate(a)}>
                  <UserCheck className="h-3.5 w-3.5" />
                  {t("team.reactivate.action")}
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* cadastro e edição */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t("team.form.edit") : t("team.form.create")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">{t("team.form.name")}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
            <div>
              <Label htmlFor="email">{t("team.form.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@empresa.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
            <div>
              <Label htmlFor="role">{t("team.form.role")}</Label>
              <select
                id="role"
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as RoleName })}
              >
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="spec">{t("team.form.spec")}</Label>
                <Input
                  id="spec"
                  value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </div>
              <div>
                <Label htmlFor="years">{t("team.form.years")}</Label>
                <Input
                  id="years"
                  type="number"
                  min={0}
                  value={form.years}
                  onChange={(e) => setForm({ ...form, years: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
              </div>
            </div>
          </div>
          {!canSubmit && (
            <p className="mt-3 text-xs text-muted-foreground">{t("team.form.requiredHint")}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={!canSubmit}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeactivate !== null}
        title={`Desativar ${confirmDeactivate?.name}?`}
        description="A pessoa some do roster e dos números do Painel, mas nada é apagado: avaliações, PDI, OKR, SWOT, mentorias, evidências e certificações continuam no perfil dela. Dá para reativar depois."
        confirmLabel={t("team.deactivate.action")}
        destructive={false}
        onCancel={() => setConfirmDeactivate(null)}
        onConfirm={deactivate}
      />
    </>
  );
}
