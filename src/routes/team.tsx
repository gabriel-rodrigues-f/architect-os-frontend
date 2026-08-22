import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Pencil, TrendingUp, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { GapBadge, Initials, LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { SpecializationCombobox } from "@/components/app/SpecializationCombobox";
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
} from "@/components/ui/dialog";
import { ROLES, type Architect, type RoleName } from "@/lib/domain";
import { ApiError, authApi } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { averageWithCoverage, specializationLabel } from "@/lib/selectors";
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
  /** Legado — só preservado para quem ainda não migrou (Seção 10, passo 6: nunca gravado numa edição nova). */
  specialization: string;
  primarySpecializationCompetencyId: string | null;
  years: string;
  email: string;
  leadUserId: string;
}

const emptyForm = (): ArchitectForm => ({
  name: "",
  role: ROLES[0] as RoleName,
  specialization: "",
  primarySpecializationCompetencyId: null,
  years: "",
  email: "",
  leadUserId: "",
});


function TeamPage() {
  const store = useStore();
  const { t } = useI18n();
  const sel = useSelectors();
  /** Cadastro do roster é decisão administrativa — backend já recusa o resto. */
  const isAdmin = useCurrentUser().role === "admin";
  /** Só para montar o seletor de "Lead responsável" — a rota já é admin-only no backend. */
  const { data: users } = useQuery({
    queryKey: ["auth-users"],
    queryFn: authApi.users,
    staleTime: 30_000,
    enabled: isAdmin,
  });
  const leadOptions = (users ?? []).filter((u) => u.role === "lead" || u.role === "admin");

  /** `null` = diálogo fechado; string vazia = criação; id = edição. */
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ArchitectForm>(emptyForm());
  const [confirmDeactivate, setConfirmDeactivate] = useState<Architect | null>(null);
  /** ENT-CAR-017 — quem está com o diálogo de transição de nível aberto. */
  const [transitioning, setTransitioning] = useState<Architect | null>(null);
  const activeArchitects = sel.activeArchitects;
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
      primarySpecializationCompetencyId: architect.primarySpecializationCompetencyId ?? null,
      years: String(architect.yearsAsArchitect),
      email: architect.email,
      leadUserId: architect.leadUserId ?? "",
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

  /**
   * `role` só entra no payload ao criar — ENT-CAR-017: depois de criado, nível
   * de carreira muda só pelo comando dedicado (`transitionCareerLevel`),
   * nunca por este PATCH genérico de cadastro (o backend já recusa `role`
   * aqui de qualquer forma, mas nem monta o campo para não sugerir que
   * funcionaria).
   */
  const submit = () => {
    if (!canSubmit) return;
    const payload = {
      name: form.name.trim(),
      yearsAsArchitect: Number(form.years),
      // Legado nunca é gravado numa edição nova (Seção 10, passo 6) — só a
      // FK. `specialization` (texto livre) permanece intocado no backend
      // até uma migração administrativa validada mapear o resto.
      primarySpecializationCompetencyId: form.primarySpecializationCompetencyId,
      email: form.email.trim(),
      leadUserId: form.leadUserId || null,
    };

    if (editing) {
      // `specialization` legado nunca sai daqui — a edição só grava a FK
      // nova, preservando (ou não) o texto antigo que já estava salvo.
      store.updateArchitect(editing, payload);
      toast.success(t("team.edit.toast", { nome: payload.name }));
    } else {
      store.addArchitect({
        id: slug(form.name),
        ...payload,
        // Novo cadastro nasce sem o campo legado — só a FK, quando definida.
        specialization: "",
        role: form.role,
        active: true,
      });
    }
    setEditing(null);
  };

  /**
   * "Excluir" virou "Desativar": apaga o cadastro em cascata (avaliações,
   * PDI, mentorias, evidências, certificações) sempre destruiu histórico de
   * gente que só saiu do time. `active: false` some do roster
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
          const top = sel.progressionGapsFor(a.id).slice(0, 3);
          const { avg } = averageWithCoverage(sel.capabilityAverages(a.id).map((d) => d.avg));
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
                    {a.role} · {a.yearsAsArchitect} anos ·{" "}
                    {specializationLabel(a, sel.competencyById)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setTransitioning(a)}
                      aria-label={t("team.transition.action", { nome: a.name })}
                      title={t("team.transition.action", { nome: a.name })}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                    </button>
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
                    {a.role} · {specializationLabel(a, sel.competencyById)}
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
            {/*
              ENT-CAR-017 — nível de carreira só é escolhido na criação. Depois
              disso muda pelo botão dedicado (ícone de seta no card), que exige
              motivo — nunca por este formulário de cadastro.
            */}
            {!editing && (
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
            )}
            {editing && (
              <div>
                <Label htmlFor="leadUserId">{t("team.form.lead")}</Label>
                <select
                  id="leadUserId"
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.leadUserId}
                  onChange={(e) => setForm({ ...form, leadUserId: e.target.value })}
                >
                  <option value="">{t("team.form.lead.none")}</option>
                  {leadOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">{t("team.form.lead.hint")}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="spec">{t("team.form.spec")}</Label>
                <div className="mt-1">
                  <SpecializationCombobox
                    label={t("team.form.spec")}
                    competencies={store.competencies}
                    capabilities={store.capabilities}
                    selectedId={form.primarySpecializationCompetencyId}
                    onSelect={(id) => setForm({ ...form, primarySpecializationCompetencyId: id })}
                  />
                </div>
                {!form.primarySpecializationCompetencyId && form.specialization && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("team.form.spec.legacyPending", { texto: form.specialization })}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="years">{t("team.form.years")}</Label>
                <Input
                  id="years"
                  type="number"
                  min={0}
                  className="mt-1"
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
        description="A pessoa some do roster e dos números do Painel, mas nada é apagado: avaliações, PDI, mentorias, evidências e certificações continuam no perfil dela. Dá para reativar depois."
        confirmLabel={t("team.deactivate.action")}
        destructive={false}
        onCancel={() => setConfirmDeactivate(null)}
        onConfirm={deactivate}
      />

      {transitioning && (
        <CareerLevelTransitionDialog
          architect={transitioning}
          onClose={() => setTransitioning(null)}
        />
      )}
    </>
  );
}

/**
 * ENT-CAR-017 — único jeito de mudar nível de carreira: pede o nível de
 * destino e um motivo (obrigatório), nunca um campo solto de formulário.
 * Sem otimismo: se a versão estiver desatualizada (409, alguém mais mudou
 * o cadastro nesse meio-tempo), a tela precisa mostrar o erro de verdade,
 * não fingir que funcionou. Mesmo padrão de `ReopenPlanDialog`
 * (`development-plans.tsx`).
 */
function CareerLevelTransitionDialog({
  architect,
  onClose,
}: {
  architect: Architect;
  onClose: () => void;
}) {
  const store = useStore();
  const { t } = useI18n();
  const [toRole, setToRole] = useState<RoleName>(architect.role);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    setSubmitting(true);
    store
      .transitionCareerLevel(architect.id, toRole, reason.trim())
      .then(() => {
        toast.success(t("team.transition.success", { nome: architect.name }));
        onClose();
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : t("team.transition.error"));
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("team.transition.title", { nome: architect.name })}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("team.transition.body", { atual: architect.role })}
        </p>
        <div>
          <Label htmlFor="transition-to-role">{t("team.transition.toRole")}</Label>
          <select
            id="transition-to-role"
            className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            value={toRole}
            onChange={(e) => setToRole(e.target.value as RoleName)}
          >
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="transition-reason">{t("team.transition.reasonLabel")}</Label>
          <Textarea
            id="transition-reason"
            className="mt-1"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("team.transition.reasonPlaceholder")}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!reason.trim() || toRole === architect.role || submitting}
            onClick={submit}
          >
            {submitting ? t("team.transition.submitting") : t("team.transition.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
