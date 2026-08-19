import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  Bar,
  GapBadge,
  Initials,
  LevelBadge,
  PageHeader,
  SectionCard,
} from "@/components/app/ui-bits";
import { CapabilityCombobox } from "@/components/app/CapabilityCombobox";
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
import { ROLES, roleShort, type Architect, type Level, type RoleName } from "@/lib/domain";
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
  strongDomain: string;
  gapDomain: string;
}

const emptyForm = (): ArchitectForm => ({
  name: "",
  role: ROLES[0] as RoleName,
  specialization: "",
  years: "1",
  email: "",
  strongDomain: "",
  gapDomain: "",
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
  const [confirmDelete, setConfirmDelete] = useState<Architect | null>(null);

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
      strongDomain: architect.strongDomain,
      gapDomain: architect.gapDomain,
    });
    setEditing(architect.id);
  };

  const submit = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      role: form.role,
      yearsAsArchitect: Number(form.years) || 1,
      specialization: form.specialization.trim() || "Arquitetura de Soluções",
      email: form.email.trim() || `${slug(form.name)}@company.com`,
      strongDomain: form.strongDomain || store.categories[0]?.id || "",
      gapDomain: form.gapDomain || store.categories[1]?.id || "",
    };

    if (editing) {
      store.updateArchitect(editing, payload);
      toast.success(t("team.edit.toast", { nome: payload.name }));
    } else {
      store.addArchitect({
        id: slug(form.name),
        ...payload,
        performance: "Medium",
        potential: "Medium",
      });
    }
    setEditing(null);
  };

  const remove = () => {
    if (!confirmDelete) return;
    store.removeArchitect(confirmDelete.id);
    toast.success(t("team.delete.toast", { nome: confirmDelete.name }));
    setConfirmDelete(null);
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
        {store.architects.map((a) => {
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
                      onClick={() => setConfirmDelete(a)}
                      aria-label={`Excluir ${a.name}`}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("team.card.avgLevel")}</span>
                <LevelBadge level={avg === undefined ? undefined : Math.round(avg)} showName />
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("team.card.progress")}</span>
                  <span className="tabular-nums">{sel.developmentScore(a.id)}%</span>
                </div>
                <Bar value={sel.developmentScore(a.id)} />
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

      <RoleProfilesCard />

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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="strong">{t("team.form.strong")}</Label>
                <select
                  id="strong"
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.strongDomain}
                  onChange={(e) => setForm({ ...form, strongDomain: e.target.value })}
                >
                  <option value="">—</option>
                  {store.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="gap">{t("team.form.gap")}</Label>
                <select
                  id="gap"
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.gapDomain}
                  onChange={(e) => setForm({ ...form, gapDomain: e.target.value })}
                >
                  <option value="">—</option>
                  {store.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={submit}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Excluir ${confirmDelete?.name}?`}
        description="Avaliações, PDIs, OKRs, SWOT, mentorias, evidências e certificações deste arquiteto também serão removidos. As trilhas permanecem, apenas sem a atribuição."
        onCancel={() => setConfirmDelete(null)}
        onConfirm={remove}
      />
    </>
  );
}

/**
 * Perfis de Competência por Cargo: nível esperado de cada competência por cargo.
 * A edição salva competência a competência (PATCH com merge no backend).
 */
export function RoleProfilesCard() {
  const store = useStore();
  const { t } = useI18n();
  /** Role Competency Profile é a régua de avaliação do time — só admin ajusta. */
  const isAdmin = useCurrentUser().role === "admin";
  const [categoryIds, setCategoryIds] = useState<string[]>(() =>
    store.categories[0] ? [store.categories[0].id] : [],
  );

  /** Capacidades escolhidas, na ordem do catálogo — não na ordem de clique. */
  const selected = store.categories.filter((c) => categoryIds.includes(c.id));

  const toggleCategory = (id: string) =>
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  /** Soma das competências de todas as capacidades marcadas. */
  const competencies = store.competencies.filter((c) => categoryIds.includes(c.categoryId));

  /** Com mais de uma capacidade aberta, a linha diz de qual ela veio. */
  const showOrigin = selected.length > 1;
  const categoryName = (id: string) => store.categories.find((c) => c.id === id)?.name ?? "";

  return (
    <SectionCard
      className="mt-6"
      title={t("team.profiles.title")}
      description={t("team.profiles.subtitle")}
      actions={
        <CapabilityCombobox
          categories={store.categories}
          selected={selected}
          onToggle={toggleCategory}
          onSelectAll={setCategoryIds}
        />
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => {
          // A média acompanha as capacidades escolhidas no seletor: sem
          // competências cadastradas nelas, não há média a exibir.
          const average = competencies.length
            ? (
                competencies.reduce((sum, c) => sum + (c.expected[r] ?? 0), 0) / competencies.length
              ).toFixed(1)
            : null;
          return (
            <div key={r} className="surface-inset p-4">
              <p className="text-sm font-medium">{r}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {store.architects.filter((a) => a.role === r).length} arquiteto(s) ·{" "}
                {average
                  ? t("team.profiles.avgExpected", { media: average })
                  : t("team.profiles.noComp")}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2">Competência</th>
              {ROLES.map((r) => (
                <th key={r} className="py-2 text-center">
                  {roleShort(r)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {competencies.map((c) => (
              <tr key={c.id} className="border-b border-border/60 last:border-0">
                <td className="py-2 font-medium">
                  {c.name}
                  {showOrigin && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {categoryName(c.categoryId)}
                    </span>
                  )}
                </td>
                {ROLES.map((r) =>
                  isAdmin ? (
                    <td key={r} className="py-2 text-center">
                      <select
                        className="w-16 rounded-md border border-input bg-card px-2 py-1 text-sm"
                        value={c.expected[r] ?? 3}
                        aria-label={`${c.name} — ${r}`}
                        onChange={(e) =>
                          store.updateCompetency(c.id, {
                            expected: { [r]: Number(e.target.value) as Level } as Record<
                              RoleName,
                              Level
                            >,
                          })
                        }
                      >
                        {[1, 2, 3, 4, 5].map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </td>
                  ) : (
                    <td key={r} className="py-2 text-center tabular-nums text-muted-foreground">
                      {c.expected[r] ?? 3}
                    </td>
                  ),
                )}
              </tr>
            ))}
            {competencies.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-sm text-muted-foreground">
                  {selected.length === 0
                    ? t("team.profiles.pickCapability")
                    : t("team.profiles.noneSelected")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
