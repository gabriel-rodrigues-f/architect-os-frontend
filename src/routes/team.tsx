import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Pencil, Table2, TrendingUp, UserCheck, UserX } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DataViewToolbar,
  EmptyState,
  Pagination,
  type ActiveFilterChip,
  type SortOption,
} from "@/components/app/DataView";
import { GapBadge, Initials, LevelBadge, PageHeader } from "@/components/app/ui-bits";
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
import { byName, slug } from "@/lib/text";
import { cn } from "@/lib/utils";

const ALL_OPTION = "__all__";
const NO_LEAD_OPTION = "__none__";

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

/** Select nativo com o mesmo visual do seletor de ordenação do `DataViewToolbar` — um por filtro de domínio. */
function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 rounded-md border border-input bg-card px-2 py-2 text-sm"
      >
        {children}
      </select>
    </div>
  );
}

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

  /**
   * REVISAO-360-FRONTEND, Seção 23 — lista única e filtrável (cards ou
   * tabela), em vez de "arquitetos ativos" + uma segunda seção separada de
   * inativos. Não-admin nunca alcança "Inativos"/"Todos": o status é
   * travado em "active" pra quem não tem a visão administrativa, mesmo que
   * o estado interno diga outra coisa.
   */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [roleFilter, setRoleFilter] = useState<string>(ALL_OPTION);
  const [leadFilter, setLeadFilter] = useState<string>(ALL_OPTION);
  const [specializationFilter, setSpecializationFilter] = useState<string>(ALL_OPTION);
  const [capabilityFilter, setCapabilityFilter] = useState<string>(ALL_OPTION);
  const [sort, setSort] = useState<"name-asc" | "name-desc" | "level" | "recent">("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [viewOverride, setViewOverride] = useState<"cards" | "table" | null>(null);
  const effectiveStatusFilter = isAdmin ? statusFilter : "active";

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, roleFilter, leadFilter, specializationFilter, capabilityFilter, sort]);

  /** Última sessão de mentoria por mentee — proxy de "atualização recente": não há `updatedAt` no cadastro. */
  const lastMentoringByArchitect = useMemo(() => {
    const map = new Map<string, string>();
    for (const session of store.mentoringSessions) {
      const prev = map.get(session.menteeId);
      if (!prev || session.date > prev) map.set(session.menteeId, session.date);
    }
    return map;
  }, [store.mentoringSessions]);

  const specializationOptions = useMemo(() => {
    const ids = new Set(
      store.architects
        .map((a) => a.primarySpecializationCompetencyId)
        .filter((id): id is string => !!id),
    );
    return [...ids]
      .map((id) => sel.competencyById(id))
      .filter((c): c is NonNullable<ReturnType<typeof sel.competencyById>> => !!c)
      .sort(byName);
  }, [store.architects, sel]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return store.architects.filter((a) => {
      if (effectiveStatusFilter === "active" && !a.active) return false;
      if (effectiveStatusFilter === "inactive" && a.active) return false;
      if (roleFilter !== ALL_OPTION && a.role !== roleFilter) return false;
      if (isAdmin && leadFilter !== ALL_OPTION) {
        if (leadFilter === NO_LEAD_OPTION ? !!a.leadUserId : a.leadUserId !== leadFilter)
          return false;
      }
      if (
        specializationFilter !== ALL_OPTION &&
        a.primarySpecializationCompetencyId !== specializationFilter
      ) {
        return false;
      }
      if (capabilityFilter !== ALL_OPTION) {
        const competency = a.primarySpecializationCompetencyId
          ? sel.competencyById(a.primarySpecializationCompetencyId)
          : undefined;
        if (competency?.capabilityId !== capabilityFilter) return false;
      }
      if (term && !`${a.name} ${a.email}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [
    store.architects,
    effectiveStatusFilter,
    roleFilter,
    isAdmin,
    leadFilter,
    specializationFilter,
    capabilityFilter,
    search,
    sel,
  ]);

  const enrichedSorted = useMemo(() => {
    const withStats = filtered.map((a) => ({
      architect: a,
      topGaps: sel.progressionGapsFor(a.id).slice(0, 3),
      avg: averageWithCoverage(sel.capabilityAverages(a.id).map((d) => d.avg)).avg,
      hasOfficial: sel.officialAssessmentFor(a.id) !== undefined,
      lastMentoring: lastMentoringByArchitect.get(a.id),
    }));
    switch (sort) {
      case "name-desc":
        withStats.sort((x, y) => byName(y.architect, x.architect));
        break;
      case "level":
        withStats.sort((x, y) => (y.avg ?? -1) - (x.avg ?? -1) || byName(x.architect, y.architect));
        break;
      case "recent":
        withStats.sort(
          (x, y) =>
            (y.lastMentoring ?? "").localeCompare(x.lastMentoring ?? "") ||
            byName(x.architect, y.architect),
        );
        break;
      default:
        withStats.sort((x, y) => byName(x.architect, y.architect));
    }
    return withStats;
  }, [filtered, sel, lastMentoringByArchitect, sort]);

  const totalPages = Math.max(1, Math.ceil(enrichedSorted.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = enrichedSorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
  const view: "cards" | "table" = viewOverride ?? (filtered.length > 12 ? "table" : "cards");

  const sortOptions: SortOption[] = [
    { value: "name-asc", label: t("team.sort.nameAsc") },
    { value: "name-desc", label: t("team.sort.nameDesc") },
    { value: "level", label: t("team.sort.level") },
    { value: "recent", label: t("team.sort.recent") },
  ];

  const activeFilterChips: ActiveFilterChip[] = [];
  if (isAdmin && statusFilter !== "active") {
    activeFilterChips.push({
      key: "status",
      label: `${t("team.filter.status")}: ${
        statusFilter === "inactive" ? t("team.filter.status.inactive") : t("team.filter.status.all")
      }`,
      onRemove: () => setStatusFilter("active"),
    });
  }
  if (roleFilter !== ALL_OPTION) {
    activeFilterChips.push({
      key: "role",
      label: roleFilter,
      onRemove: () => setRoleFilter(ALL_OPTION),
    });
  }
  if (isAdmin && leadFilter !== ALL_OPTION) {
    const label =
      leadFilter === NO_LEAD_OPTION
        ? t("team.filter.lead.none")
        : (leadOptions.find((u) => u.id === leadFilter)?.name ?? leadFilter);
    activeFilterChips.push({
      key: "lead",
      label: `${t("team.filter.lead")}: ${label}`,
      onRemove: () => setLeadFilter(ALL_OPTION),
    });
  }
  if (specializationFilter !== ALL_OPTION) {
    activeFilterChips.push({
      key: "spec",
      label: sel.competencyById(specializationFilter)?.name ?? specializationFilter,
      onRemove: () => setSpecializationFilter(ALL_OPTION),
    });
  }
  if (capabilityFilter !== ALL_OPTION) {
    activeFilterChips.push({
      key: "cap",
      label: store.capabilities.find((c) => c.id === capabilityFilter)?.name ?? capabilityFilter,
      onRemove: () => setCapabilityFilter(ALL_OPTION),
    });
  }

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("active");
    setRoleFilter(ALL_OPTION);
    setLeadFilter(ALL_OPTION);
    setSpecializationFilter(ALL_OPTION);
    setCapabilityFilter(ALL_OPTION);
    setSort("name-asc");
  };

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

      {store.architects.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <p className="text-sm font-medium">{t("team.empty.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("team.empty.hint")}</p>
          {isAdmin && (
            <Button className="mt-4" onClick={openCreate}>
              {t("team.empty.cta")}
            </Button>
          )}
        </div>
      ) : (
        <>
          <DataViewToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t("team.filter.searchPlaceholder")}
            resultCount={enrichedSorted.length}
            totalCount={store.architects.length}
            activeFilters={activeFilterChips}
            onClearFilters={clearFilters}
            sortValue={sort}
            sortOptions={sortOptions}
            onSortChange={(v) => setSort(v as typeof sort)}
          >
            {isAdmin && (
              <FilterSelect
                id="team-filter-status"
                label={t("team.filter.status")}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              >
                <option value="active">{t("team.filter.status.active")}</option>
                <option value="inactive">{t("team.filter.status.inactive")}</option>
                <option value="all">{t("team.filter.status.all")}</option>
              </FilterSelect>
            )}
            <FilterSelect
              id="team-filter-role"
              label={t("team.filter.role")}
              value={roleFilter}
              onChange={setRoleFilter}
            >
              <option value={ALL_OPTION}>{t("team.filter.role.all")}</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </FilterSelect>
            {isAdmin && leadOptions.length > 0 && (
              <FilterSelect
                id="team-filter-lead"
                label={t("team.filter.lead")}
                value={leadFilter}
                onChange={setLeadFilter}
              >
                <option value={ALL_OPTION}>{t("team.filter.lead.all")}</option>
                <option value={NO_LEAD_OPTION}>{t("team.filter.lead.none")}</option>
                {leadOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </FilterSelect>
            )}
            {specializationOptions.length > 0 && (
              <FilterSelect
                id="team-filter-specialization"
                label={t("team.filter.specialization")}
                value={specializationFilter}
                onChange={setSpecializationFilter}
              >
                <option value={ALL_OPTION}>{t("team.filter.specialization.all")}</option>
                {specializationOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </FilterSelect>
            )}
            <FilterSelect
              id="team-filter-capability"
              label={t("team.filter.capability")}
              value={capabilityFilter}
              onChange={setCapabilityFilter}
            >
              <option value={ALL_OPTION}>{t("team.filter.capability.all")}</option>
              {store.capabilities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
          </DataViewToolbar>

          <div className="mb-3 flex justify-end">
            <div className="inline-flex items-center gap-0.5 rounded-md border border-input p-0.5">
              <button
                type="button"
                aria-label={t("team.view.cards")}
                aria-pressed={view === "cards"}
                title={t("team.view.cards")}
                onClick={() => setViewOverride("cards")}
                className={cn(
                  "rounded p-1.5 transition-colors",
                  view === "cards"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={t("team.view.table")}
                aria-pressed={view === "table"}
                title={t("team.view.table")}
                onClick={() => setViewOverride("table")}
                className={cn(
                  "rounded p-1.5 transition-colors",
                  view === "table"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Table2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {pageItems.length === 0 ? (
            <EmptyState
              hasFilters
              emptyMessage={t("team.empty.noResults")}
              noResultsMessage={t("team.empty.noResults")}
              onClearFilters={clearFilters}
            />
          ) : view === "cards" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pageItems.map(({ architect: a, topGaps: top, avg, hasOfficial }) => (
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
                        {a.active ? (
                          <>
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
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => reactivate(a)}
                            aria-label={`${t("team.reactivate.action")} ${a.name}`}
                            title={t("team.reactivate.action")}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
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
                        <span className="min-w-0 flex-1 truncate">{g.competency?.name}</span>
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
              ))}
            </div>
          ) : (
            <div className="surface-card overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">{t("team.table.col.name")}</th>
                    <th className="px-4 py-3">{t("team.table.col.role")}</th>
                    <th className="px-4 py-3">{t("team.table.col.specialization")}</th>
                    {isAdmin && (
                      <th className="whitespace-nowrap px-4 py-3">{t("team.table.col.lead")}</th>
                    )}
                    <th className="whitespace-nowrap px-4 py-3 text-center">
                      {t("team.table.col.level")}
                    </th>
                    <th className="px-4 py-3 text-center">{t("team.table.col.gaps")}</th>
                    {isAdmin && <th className="px-4 py-3">{t("team.table.col.status")}</th>}
                    {isAdmin && (
                      <th className="px-4 py-3 text-right">{t("team.table.col.actions")}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(({ architect: a, topGaps: top, avg, hasOfficial }) => {
                    const lead = leadOptions.find((u) => u.id === a.leadUserId);
                    return (
                      <tr key={a.id} className="border-b border-border/60 last:border-0">
                        <td className="max-w-[220px] px-4 py-3">
                          <Link
                            to="/architects/$architectId"
                            params={{ architectId: a.id }}
                            className="block truncate font-medium hover:text-primary"
                          >
                            {a.name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {a.role}
                        </td>
                        <td className="max-w-[200px] px-4 py-3 text-muted-foreground">
                          <span className="block truncate">
                            {specializationLabel(a, sel.competencyById)}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="max-w-[160px] px-4 py-3 text-muted-foreground">
                            <span className="block truncate">{lead?.name ?? "—"}</span>
                          </td>
                        )}
                        <td className="px-4 py-3 text-center">
                          <LevelBadge level={avg === undefined ? undefined : Math.round(avg)} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!hasOfficial ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : top.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {t("team.card.noGaps")}
                            </span>
                          ) : (
                            <GapBadge gap={top[0]!.gap} />
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                a.active
                                  ? "bg-primary/10 text-primary"
                                  : "bg-secondary text-muted-foreground",
                              )}
                            >
                              {a.active ? t("team.badge.active") : t("team.badge.inactive")}
                            </span>
                          </td>
                        )}
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              {a.active ? (
                                <>
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
                                </>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => reactivate(a)}>
                                  <UserCheck className="h-3.5 w-3.5" />
                                  {t("team.reactivate.action")}
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            page={clampedPage}
            pageSize={pageSize}
            total={enrichedSorted.length}
            onPageChange={setPage}
            onPageSizeChange={(n) => setPageSize(n)}
          />
        </>
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
