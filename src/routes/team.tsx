import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  Bar,
  GapBadge,
  Initials,
  LevelBadge,
  PageHeader,
  SectionCard,
} from "@/components/app/ui-bits";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROLES, roleShort, type Architect, type Level, type RoleName } from "@/lib/domain";
import { useSelectors, useStore } from "@/lib/store";
import { slug } from "@/lib/text";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Time — Architect OS" },
      {
        name: "description",
        content:
          "Time de Arquitetos de Soluções, níveis médios, gaps e progresso de desenvolvimento.",
      },
      { property: "og:title", content: "Time — Architect OS" },
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
  const sel = useSelectors();

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
    setConfirmDelete(null);
  };

  return (
    <>
      <PageHeader
        title="Time"
        description="Arquitetos de Soluções sob acompanhamento técnico da Liderança de Arquitetura."
        actions={<Button onClick={openCreate}>Cadastrar arquiteto</Button>}
      />

      {store.architects.length === 0 && (
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-medium">Nenhum arquiteto cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre o primeiro arquiteto para começar a acompanhar competências e gaps.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            Cadastrar arquiteto
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {store.architects.map((a) => {
          const top = sel.gapsFor(a.id).slice(0, 3);
          const avg =
            sel.domainAverages(a.id).reduce((s, d) => s + d.avg, 0) /
            Math.max(1, store.categories.length);
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
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Nível médio</span>
                <LevelBadge level={Math.round(avg)} showName />
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Evolução</span>
                  <span className="tabular-nums">{sel.developmentScore(a.id)}%</span>
                </div>
                <Bar value={sel.developmentScore(a.id)} />
              </div>

              <div className="mt-4 space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Principais lacunas
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
                  <p className="text-sm text-muted-foreground">Sem avaliação neste ciclo.</p>
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
            <DialogTitle>{editing ? "Editar arquiteto" : "Novo Arquiteto de Soluções"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@empresa.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="role">Cargo</Label>
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
                <Label htmlFor="spec">Especialização principal</Label>
                <Input
                  id="spec"
                  value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="years">Tempo como arquiteto (anos)</Label>
                <Input
                  id="years"
                  type="number"
                  min={0}
                  value={form.years}
                  onChange={(e) => setForm({ ...form, years: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="strong">Domínio forte</Label>
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
                <Label htmlFor="gap">Domínio a desenvolver</Label>
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
            <Button onClick={submit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* confirmação de exclusão */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {confirmDelete?.name}?</DialogTitle>
            <DialogDescription>
              Avaliações, PDIs, OKRs, SWOT, mentorias, evidências e certificações deste arquiteto
              também serão removidos. As trilhas permanecem, apenas sem a atribuição.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={remove}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Perfis de Competência por Cargo: nível esperado de cada competência por cargo.
 * A edição salva competência a competência (PATCH com merge no backend).
 */
export function RoleProfilesCard() {
  const store = useStore();
  const [categoryId, setCategoryId] = useState("");
  const activeCategory = categoryId || store.categories[0]?.id || "";
  const competencies = store.competencies.filter((c) => c.categoryId === activeCategory);

  return (
    <SectionCard
      className="mt-6"
      title="Perfis de Competência por Cargo"
      description="Nível esperado por cargo em cada competência. Ajuste direto na tabela."
      actions={
        <select
          className="rounded-md border border-input bg-card px-3 py-2 text-sm"
          value={activeCategory}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Domínio"
        >
          {store.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => {
          // A média acompanha o domínio escolhido no seletor: sem competências
          // cadastradas nele, não há média a exibir.
          const average = competencies.length
            ? (
                competencies.reduce((sum, c) => sum + (c.expected[r] ?? 0), 0) / competencies.length
              ).toFixed(1)
            : null;
          return (
            <div key={r} className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium">{r}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {store.architects.filter((a) => a.role === r).length} arquiteto(s) ·{" "}
                {average ? `nível esperado médio ${average}` : "sem competências neste domínio"}
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
                <td className="py-2 font-medium">{c.name}</td>
                {ROLES.map((r) => (
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
                ))}
              </tr>
            ))}
            {competencies.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-sm text-muted-foreground">
                  Nenhuma competência neste domínio. Cadastre em Matriz de Competências.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
