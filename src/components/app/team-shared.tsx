import { Link } from "@tanstack/react-router";
import { Check, ChevronsUpDown, Pencil, TrendingUp, UserCheck, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { ActiveFilterChip, SortOption } from "@/components/app/DataView";
import { CommandWithReasonDialog } from "@/components/app/CommandWithReasonDialog";
import { GapBadge, Initials, LevelBadge } from "@/components/app/ui-bits";
import type { MultiSelectFilterOption } from "@/components/app/MultiSelectFilter";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type Architect, type RoleName } from "@/lib/domain";
import { Selection } from "@/lib/selection";
import { useToastSubmit } from "@/hooks/use-async-submit";
import { useI18n } from "@/lib/i18n";
import { type Gap } from "@/lib/selectors";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useCareerLevelsByRank, useSelectors, useStore } from "@/lib/store";
import { defaultNameFormatter } from "@/lib/text";
import { cn } from "@/lib/utils";
import {
  emptyArchitectForm,
  TeamViewModel,
  type ArchitectFormValues,
} from "@/lib/view-models/team-view-model";

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-34 (§12) / R1-P07 —
 * `/team` era um único componente de ~1018 linhas (filtro/ordenação/paginação
 * do roster + formulário de cadastro/edição + renderização em cards/tabela,
 * cada um com o próprio estado). Extraído no mesmo padrão de
 * `mentoring-shared.tsx`: `TeamPage` (rota) vira só composição.
 *
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seções 58-61) — `useArchitectForm` abaixo virou o adaptador fino que a
 * Seção 61 descreve: o cadastro/edição/reativação de verdade mora em
 * `TeamViewModel` (`lib/view-models/team-view-model.ts`), e o hook só cuida
 * do que é genuinamente estado de render (diálogo aberto/fechado, rascunho
 * do formulário) e da orquestração de UI (toast, fechar diálogo). Ver nota
 * no próprio `team-view-model.ts` sobre por que `useTeamRoster` (abaixo)
 * NÃO fez a mesma migração.
 */

/** Pseudo-ids pra quem não tem especialização/capacidade derivável — nunca somem do filtro por não ter um id real de catálogo. */
const NO_SPECIALIZATION = "__no-specialization__";
const NO_CAPABILITY = "__no-capability__";

/** Uma pessoa do roster já enriquecida com gaps/média/histórico — o que `enrichedSorted` produz e a tabela/cards consomem. */
export interface EnrichedArchitect {
  architect: Architect;
  topGaps: Gap[];
  avg: number | undefined;
  hasOfficial: boolean;
  lastMentoring: string | undefined;
}

/**
 * Estado + submit do diálogo de cadastro/edição, mais reativar. `editing` é
 * `null` (fechado), string vazia (criação) ou um id (edição) — mesmo
 * controle que a rota já usava. `confirmDeactivate`/`transitioning` só
 * guardam "para quem o diálogo está aberto" — o próprio submit (motivo
 * obrigatório + concorrência otimista) mora em `DeactivateDialog`/
 * `CareerLevelTransitionDialog`, não aqui, mesmo padrão dos dois.
 */
/**
 * `store` (o retorno de `useStore()`) faz o papel de "serviço" que o
 * exemplo da Seção 60 pede no construtor — já abstrai o gateway HTTP
 * atrás de cache/otimismo (Seção 64), então o `TeamViewModel` não
 * precisa (nem deve) falar com `FrontendContainer` diretamente aqui: um
 * ViewModel que bypassasse `store` duplicaria a semântica de cache que
 * `store.tsx` já resolve, e é exatamente o tipo de comportamento
 * inventado que este brief pede para evitar. OO3-11c — adaptador único
 * compartilhado pelo formulário e pelos dois diálogos de comando.
 */
function useTeamViewModel(): TeamViewModel {
  const store = useStore();
  return useMemo(() => new TeamViewModel(store, defaultUiAuthorizationPolicy), [store]);
}

export function useArchitectForm() {
  const { t } = useI18n();
  const viewModel = useTeamViewModel();
  /**
   * CFG-01 (SPEC-OO3-13, A5) — o nível padrão do cadastro é o primeiro
   * nível REAL de `career_levels` (menor `rank`), não mais `ROLES[0]`
   * hardcoded. O `useState` inicial pode rodar antes da consulta resolver
   * (fica ""), mas o único caminho para abrir o diálogo de criação é
   * `openCreate`, que reavalia com os níveis já carregados.
   */
  const careerLevels = useCareerLevelsByRank();
  const defaultRole = (careerLevels[0]?.name ?? "") as RoleName;

  /** `null` = diálogo fechado; string vazia = criação; id = edição. */
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ArchitectFormValues>(() => emptyArchitectForm(defaultRole));
  /** R2-UX-08/OO-03 — quem está com o diálogo de desativação aberto. */
  const [confirmDeactivate, setConfirmDeactivate] = useState<Architect | null>(null);
  /** ENT-CAR-017 — quem está com o diálogo de transição de nível aberto. */
  const [transitioning, setTransitioning] = useState<Architect | null>(null);

  const openCreate = () => {
    setForm(emptyArchitectForm(defaultRole));
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

  const { yearsValid, canSubmit } = viewModel.validate(form);
  /**
   * OO3-18/F-1 — esqueleto try/catch/toast.error(authErrorMessage) mora no
   * hook; este era um dos 3 call sites SEM `finally`/`setSaving` (o diálogo
   * aceitava re-submit durante a chamada em voo — bug latente que a
   * unificação corrige: `submitting` agora desabilita o botão Salvar).
   */
  const { submitting, run } = useToastSubmit();

  /**
   * Validação e payload moraram em `TeamViewModel.submit` (Seção 61 — hook
   * vira adaptador fino). O que fica aqui é só orquestração de UI: toast e
   * fechar o diálogo, igual antes.
   */
  const submit = async () => {
    if (!canSubmit) return;

    if (editing) {
      // `specialization` legado nunca sai daqui — a edição só grava a FK
      // nova, preservando (ou não) o texto antigo que já estava salvo.
      await viewModel.submit(form, editing);
      toast.success(t("team.edit.toast", { nome: form.name.trim() }));
      setEditing(null);
    } else {
      // B-32 — id é gerado no servidor (nunca mais slug(nome), que colidia
      // entre duas pessoas de nome parecido); sem otimismo, a tela só fecha
      // o diálogo depois que o cadastro existe de verdade.
      const result = await run(() => viewModel.submit(form, editing));
      if (result.ok) setEditing(null);
    }
  };

  const reactivate = (a: Architect) => {
    viewModel.reactivate(a);
    toast.success(t("team.reactivate.toast", { nome: a.name }));
  };

  return {
    editing,
    setEditing,
    form,
    setForm,
    confirmDeactivate,
    setConfirmDeactivate,
    transitioning,
    setTransitioning,
    openCreate,
    openEdit,
    yearsValid,
    canSubmit,
    submitting,
    submit,
    reactivate,
  };
}

/**
 * Filtro/ordenação/paginação do roster. `isAdmin` vem de fora porque só a
 * rota conhece o usuário atual — não-admin nunca alcança "Inativos", mesmo
 * que o estado interno de `statusFilter` diga outra coisa (REVISAO-360-
 * FRONTEND, Seção 23).
 */
export function useTeamRoster(isAdmin: boolean) {
  const store = useStore();
  const { t } = useI18n();
  const sel = useSelectors();

  /**
   * REVISAO-360-FRONTEND, Seção 23 — lista única e filtrável (cards ou
   * tabela), em vez de "arquitetos ativos" + uma segunda seção separada de
   * inativos. Não-admin nunca alcança "Inativos": o status fica travado em
   * "active" pra quem não tem a visão administrativa, mesmo que o estado
   * interno diga outra coisa.
   *
   * Pedido do usuário revisando o app rodando: filtro é composição por
   * caixinha (MultiSelectFilter), nunca busca por texto — marcar um valor,
   * vários, ou "selecionar tudo"/"remover tudo" de uma vez, mesmo padrão do
   * `ArchitectFilter`. Cada filtro nasce com TUDO selecionado (nenhuma
   * filtragem de fato) exceto Status, que nasce só em "Ativos" — a mesma
   * visão padrão de antes desta seção existir. Sem filtro de Tech Lead: só
   * existe um Tech Lead no time hoje, então filtrar por ele não distingue
   * nada.
   */
  const [statusFilter, setStatusFilter] = useState<string[]>(["active"]);
  /**
   * CFG-01 (SPEC-OO3-13, A5) — as opções do filtro de nível vêm de
   * `career_levels` (por `rank`), não mais do array `ROLES` hardcoded. Como
   * os níveis chegam por consulta própria (podem ainda não ter resolvido no
   * primeiro render), o estado guarda `null` = "todos selecionados" (a mesma
   * visão padrão de antes: nascer com tudo marcado, nenhuma filtragem de
   * fato) — inicializar `useState` com uma lista ainda vazia esconderia o
   * time inteiro até um clique manual no filtro.
   */
  const careerLevels = useCareerLevelsByRank();
  const [roleSelection, setRoleSelection] = useState<string[] | null>(null);
  const roleFilter = roleSelection ?? careerLevels.map((l) => l.name);
  const [specializationFilter, setSpecializationFilter] = useState<string[]>(() => {
    const used = new Set(
      store.architects
        .map((a) => a.primarySpecializationCompetencyId)
        .filter((id): id is string => !!id),
    );
    const ids = [...used];
    if (store.architects.some((a) => !a.primarySpecializationCompetencyId))
      ids.push(NO_SPECIALIZATION);
    return ids;
  });
  const [capabilityFilter, setCapabilityFilter] = useState<string[]>(() => {
    const ids = store.capabilities.map((c) => c.id);
    const hasNone = store.architects.some((a) => {
      const competency = a.primarySpecializationCompetencyId
        ? sel.competencyById(a.primarySpecializationCompetencyId)
        : undefined;
      return !competency;
    });
    return hasNone ? [...ids, NO_CAPABILITY] : ids;
  });
  /**
   * R2-UX-06 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, Anexo B) — evolui B-13:
   * "Buscar por nome" (texto livre) virou seleção múltipla pesquisável
   * (`ArchitectNameCombobox`), mesmo padrão de composição por caixinha das
   * outras 4 facetas. Nasce com todos os ids — nenhuma filtragem de fato,
   * mesmo cuidado das outras facetas (nunca esconder gente por engano).
   */
  const [nameSelection, setNameSelection] = useState<string[]>(() =>
    store.architects.map((a) => a.id),
  );
  const [sort, setSort] = useState<"name-asc" | "name-desc" | "level" | "recent">("name-asc");
  const [page, setPage] = useState(1);
  /** P1-12 — 25 como default superdimensiona times de 10–30 pessoas; 10 mostra o time inteiro sem paginar na maioria dos casos reais. */
  const [pageSize, setPageSize] = useState(10);
  const [viewOverride, setViewOverride] = useState<"cards" | "table" | null>(null);

  useEffect(() => {
    setPage(1);
  }, [nameSelection, statusFilter, roleSelection, specializationFilter, capabilityFilter, sort]);

  /** Última sessão de mentoria por mentee — proxy de "atualização recente": não há `updatedAt` no cadastro. */
  const lastMentoringByArchitect = useMemo(() => {
    const map = new Map<string, string>();
    for (const session of store.mentoringSessions) {
      const prev = map.get(session.menteeId);
      if (!prev || session.date > prev) map.set(session.menteeId, session.date);
    }
    return map;
  }, [store.mentoringSessions]);

  const statusOptions: MultiSelectFilterOption[] = [
    { id: "active", label: t("team.filter.status.active") },
    { id: "inactive", label: t("team.filter.status.inactive") },
  ];
  const roleOptions: MultiSelectFilterOption[] = careerLevels.map((l) => ({
    id: l.name,
    label: l.name,
  }));

  const specializationOptions = useMemo(() => {
    const used = new Set(
      store.architects
        .map((a) => a.primarySpecializationCompetencyId)
        .filter((id): id is string => !!id),
    );
    const options: MultiSelectFilterOption[] = [...used]
      .map((id) => sel.competencyById(id))
      .filter((c): c is NonNullable<ReturnType<typeof sel.competencyById>> => !!c)
      .sort(defaultNameFormatter.byName)
      .map((c) => ({ id: c.id, label: c.name }));
    if (store.architects.some((a) => !a.primarySpecializationCompetencyId)) {
      options.push({
        id: NO_SPECIALIZATION,
        label: t("team.filter.specialization.none"),
        isPlaceholder: true,
      });
    }
    return options;
  }, [store.architects, sel, t]);

  const capabilityOptions = useMemo(() => {
    const options: MultiSelectFilterOption[] = store.capabilities.map((c) => ({
      id: c.id,
      label: c.name,
    }));
    const hasNone = store.architects.some((a) => {
      const competency = a.primarySpecializationCompetencyId
        ? sel.competencyById(a.primarySpecializationCompetencyId)
        : undefined;
      return !competency;
    });
    if (hasNone) {
      options.push({
        id: NO_CAPABILITY,
        label: t("team.filter.capability.none"),
        isPlaceholder: true,
      });
    }
    return options;
  }, [store.capabilities, store.architects, sel, t]);

  const filtered = useMemo(() => {
    const effectiveStatus = isAdmin ? statusFilter : ["active"];
    /** OO3-09b — mesmo recorte explícito de gap/compare: `[]` = ninguém, nunca vazio-como-atalho. */
    const nameFilter = Selection.explicit(nameSelection);
    return store.architects.filter((a) => {
      if (!nameFilter.contains(a.id)) return false;
      if (!effectiveStatus.includes(a.active ? "active" : "inactive")) return false;
      // `null` = todos os níveis (inclusive enquanto `career_levels` carrega).
      if (roleSelection !== null && !roleSelection.includes(a.role)) return false;
      const specKey = a.primarySpecializationCompetencyId ?? NO_SPECIALIZATION;
      if (!specializationFilter.includes(specKey)) return false;
      const competency = a.primarySpecializationCompetencyId
        ? sel.competencyById(a.primarySpecializationCompetencyId)
        : undefined;
      const capKey = competency?.capabilityId ?? NO_CAPABILITY;
      if (!capabilityFilter.includes(capKey)) return false;
      return true;
    });
  }, [
    store.architects,
    isAdmin,
    statusFilter,
    roleSelection,
    specializationFilter,
    capabilityFilter,
    nameSelection,
    sel,
  ]);

  const enrichedSorted = useMemo(() => {
    const withStats = filtered.map((a) => ({
      architect: a,
      topGaps: sel.progressionGapsFor(a.id).slice(0, 3),
      avg: sel.coverageFor(a.id).avg,
      hasOfficial: sel.officialAssessmentFor(a.id) !== undefined,
      lastMentoring: lastMentoringByArchitect.get(a.id),
    }));
    switch (sort) {
      case "name-desc":
        withStats.sort((x, y) => defaultNameFormatter.byName(y.architect, x.architect));
        break;
      case "level":
        withStats.sort(
          (x, y) =>
            (y.avg ?? -1) - (x.avg ?? -1) || defaultNameFormatter.byName(x.architect, y.architect),
        );
        break;
      case "recent":
        withStats.sort(
          (x, y) =>
            (y.lastMentoring ?? "").localeCompare(x.lastMentoring ?? "") ||
            defaultNameFormatter.byName(x.architect, y.architect),
        );
        break;
      default:
        withStats.sort((x, y) => defaultNameFormatter.byName(x.architect, y.architect));
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

  /** Resumo genérico pra chip de filtro: 0 = "ninguém", 1 = o próprio rótulo, N = contagem. */
  const summarize = (selected: string[], options: MultiSelectFilterOption[]) =>
    selected.length === 0
      ? t("team.filter.chip.none")
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.label ?? selected[0]!)
        : t("filter.multi.count", { n: selected.length });

  const activeFilterChips: ActiveFilterChip[] = [];
  if (nameSelection.length !== store.architects.length) {
    activeFilterChips.push({
      key: "name",
      label: t("team.filter.chip.name", { n: nameSelection.length }),
      onRemove: () => setNameSelection(store.architects.map((a) => a.id)),
    });
  }
  if (isAdmin && !(statusFilter.length === 1 && statusFilter[0] === "active")) {
    activeFilterChips.push({
      key: "status",
      label: `${t("team.filter.status")}: ${summarize(statusFilter, statusOptions)}`,
      onRemove: () => setStatusFilter(["active"]),
    });
  }
  if (roleFilter.length !== roleOptions.length) {
    activeFilterChips.push({
      key: "role",
      label: `${t("team.filter.role")}: ${summarize(roleFilter, roleOptions)}`,
      onRemove: () => setRoleSelection(null),
    });
  }
  if (specializationFilter.length !== specializationOptions.length) {
    activeFilterChips.push({
      key: "spec",
      label: `${t("team.filter.specialization")}: ${summarize(specializationFilter, specializationOptions)}`,
      onRemove: () => setSpecializationFilter(specializationOptions.map((o) => o.id)),
    });
  }
  if (capabilityFilter.length !== capabilityOptions.length) {
    activeFilterChips.push({
      key: "cap",
      label: `${t("team.filter.capability")}: ${summarize(capabilityFilter, capabilityOptions)}`,
      onRemove: () => setCapabilityFilter(capabilityOptions.map((o) => o.id)),
    });
  }

  const clearFilters = () => {
    setNameSelection(store.architects.map((a) => a.id));
    setStatusFilter(["active"]);
    setRoleSelection(null);
    setSpecializationFilter(specializationOptions.map((o) => o.id));
    setCapabilityFilter(capabilityOptions.map((o) => o.id));
    setSort("name-asc");
  };

  return {
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter: setRoleSelection as (ids: string[]) => void,
    specializationFilter,
    setSpecializationFilter,
    capabilityFilter,
    setCapabilityFilter,
    nameSelection,
    setNameSelection,
    sort,
    setSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    viewOverride,
    setViewOverride,
    statusOptions,
    roleOptions,
    specializationOptions,
    capabilityOptions,
    enrichedSorted,
    pageItems,
    clampedPage,
    view,
    sortOptions,
    activeFilterChips,
    clearFilters,
  };
}

/**
 * R2-ESC-04 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — seletor de Lead
 * responsável pesquisável. Diferente de `ArchitectSelectCombobox`: a lista
 * é de contas `SessionUser` (lead/admin), não de arquitetos, e tem uma
 * opção "sem Lead" — mesmo padrão de "remover" de `SpecializationCombobox`.
 */
export function LeadCombobox({
  options,
  selectedId,
  onChange,
  label,
  id,
}: {
  options: { id: string; name: string }[];
  selectedId: string;
  onChange: (id: string) => void;
  label: string;
  id?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ordered = [...options].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const selected = ordered.find((u) => u.id === selectedId);

  const select = (userId: string) => {
    onChange(userId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          title={selected?.name ?? t("team.form.lead.none")}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm"
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left",
              !selected && "text-muted-foreground",
            )}
          >
            {selected ? selected.name : t("team.form.lead.none")}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={t("architectCombobox.search")} />
          <CommandList className="max-h-72">
            <CommandEmpty>{t("architectCombobox.empty")}</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => select("")}>
                <Check
                  className={cn("mr-2 h-4 w-4 shrink-0", !selected ? "opacity-100" : "opacity-0")}
                />
                <span className="text-muted-foreground">{t("team.form.lead.none")}</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {ordered.map((u) => (
                <CommandItem key={u.id} value={u.name} title={u.name} onSelect={() => select(u.id)}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      u.id === selectedId ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{u.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
export function CareerLevelTransitionDialog({
  architect,
  onClose,
}: {
  architect: Architect;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const viewModel = useTeamViewModel();
  /** CFG-01 (A5) — os níveis de destino vêm de `career_levels` (por `rank`), não mais de `ROLES`. */
  const careerLevels = useCareerLevelsByRank();
  const [toRole, setToRole] = useState<RoleName>(architect.role);

  return (
    <CommandWithReasonDialog
      title={t("team.transition.title", { nome: architect.name })}
      body={t("team.transition.body", { atual: architect.role })}
      reasonInputId="transition-reason"
      reasonLabel={t("team.transition.reasonLabel")}
      reasonPlaceholder={t("team.transition.reasonPlaceholder")}
      confirmLabel={t("team.transition.confirm")}
      submittingLabel={t("team.transition.submitting")}
      fallbackError={t("team.transition.error")}
      canSubmit={toRole !== architect.role}
      extraFields={() => (
        <div>
          <Label htmlFor="transition-to-role">{t("team.transition.toRole")}</Label>
          <select
            id="transition-to-role"
            className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            value={toRole}
            onChange={(e) => setToRole(e.target.value as RoleName)}
          >
            {careerLevels.map((l) => (
              <option key={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      )}
      onSubmit={(reason) =>
        viewModel
          .transitionCareerLevel(architect.id, toRole, reason)
          .then(() => toast.success(t("team.transition.success", { nome: architect.name })))
      }
      onClose={onClose}
    />
  );
}

/**
 * R2-UX-08/OO-03 — desativação migrou de `PATCH /api/architects/:id` com
 * `{ active: false }` (o backend passou a recusar isso com 400: "Desativação
 * exige motivo") para um comando dedicado, `POST .../deactivate`, no mesmo
 * molde de `transitionCareerLevel`/`CareerLevelTransitionDialog` acima:
 * motivo obrigatório, sem otimismo, e um 409 (`ARCHITECT_VERSION_CONFLICT` —
 * alguém mais alterou o cadastro desde que o diálogo abriu) precisa aparecer
 * como erro de verdade, não fingir sucesso.
 */
export function DeactivateDialog({
  architect,
  onClose,
}: {
  architect: Architect;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const viewModel = useTeamViewModel();

  return (
    <CommandWithReasonDialog
      title={t("team.deactivate.confirmTitle", { nome: architect.name })}
      body={t("team.deactivate.confirmDescription")}
      reasonInputId="deactivate-reason"
      reasonLabel={t("team.deactivate.reasonLabel")}
      reasonPlaceholder={t("team.deactivate.reasonPlaceholder")}
      confirmLabel={t("team.deactivate.action")}
      submittingLabel={t("team.deactivate.submitting")}
      confirmVariant="destructive"
      fallbackError={t("team.deactivate.error")}
      onSubmit={(reason) =>
        viewModel
          .deactivate(architect.id, reason)
          .then(() => toast.success(t("team.deactivate.toast", { nome: architect.name })))
      }
      onClose={onClose}
    />
  );
}

/**
 * Roster já paginado, em cards ou tabela — mesma lista, duas apresentações.
 * `leadOptions` vem de fora (só a rota consulta `authApi.users`); os
 * callbacks (`onEdit`/`onTransition`/`onDeactivate`/`onReactivate`) cruzam a
 * fronteira porque o estado que eles mudam (`useArchitectForm`) é
 * compartilhado com o diálogo de cadastro, que fica na rota.
 */
export function TeamRosterView({
  pageItems,
  view,
  isAdmin,
  leadOptions,
  onTransition,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  pageItems: EnrichedArchitect[];
  view: "cards" | "table";
  isAdmin: boolean;
  leadOptions: readonly { id: string; name: string }[];
  onTransition: (architect: Architect) => void;
  onEdit: (architect: Architect) => void;
  onDeactivate: (architect: Architect) => void;
  onReactivate: (architect: Architect) => void;
}) {
  const { t } = useI18n();
  const sel = useSelectors();

  return view === "cards" ? (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {pageItems.map(({ architect: a, topGaps: top, avg, hasOfficial }) => {
        const specialization = sel.specializationLabel(a);
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
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={`${a.role} · ${t("team.card.years", { n: a.yearsAsArchitect })} · ${specialization}`}
                >
                  {a.role} · {t("team.card.years", { n: a.yearsAsArchitect })} · {specialization}
                </p>
                <p className="truncate text-xs text-muted-foreground" title={a.email}>
                  {a.email}
                </p>
              </div>
              {isAdmin && (
                <div className="flex shrink-0 gap-1">
                  {a.active ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onTransition(a)}
                        aria-label={t("team.transition.action", { nome: a.name })}
                        title={t("team.transition.action", { nome: a.name })}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <TrendingUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(a)}
                        aria-label={`${t("common.edit")} ${a.name}`}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeactivate(a)}
                        aria-label={`${t("team.deactivate.action")} ${a.name}`}
                        title={t("team.deactivate.action")}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onReactivate(a)}
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
                  <span className="min-w-0 flex-1 truncate" title={g.competency?.name}>
                    {g.competency?.name}
                  </span>
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
  ) : (
    <div className="surface-card overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-4 py-3">
              {t("team.table.col.name")}
            </th>
            <th scope="col" className="px-4 py-3">
              {t("team.table.col.role")}
            </th>
            <th scope="col" className="px-4 py-3">
              {t("team.table.col.specialization")}
            </th>
            {isAdmin && (
              <th scope="col" className="whitespace-nowrap px-4 py-3">
                {t("team.table.col.lead")}
              </th>
            )}
            <th scope="col" className="whitespace-nowrap px-4 py-3 text-center">
              {t("team.table.col.level")}
            </th>
            <th scope="col" className="px-4 py-3 text-center">
              {t("team.table.col.gaps")}
            </th>
            {isAdmin && (
              <th scope="col" className="px-4 py-3">
                {t("team.table.col.status")}
              </th>
            )}
            {isAdmin && (
              <th scope="col" className="px-4 py-3 text-right">
                {t("team.table.col.actions")}
              </th>
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
                    title={a.name}
                  >
                    {a.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground" title={a.email}>
                    {a.email}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{a.role}</td>
                <td className="max-w-[200px] px-4 py-3 text-muted-foreground">
                  <span className="block truncate" title={sel.specializationLabel(a)}>
                    {sel.specializationLabel(a)}
                  </span>
                </td>
                {isAdmin && (
                  <td className="max-w-[160px] px-4 py-3 text-muted-foreground">
                    <span className="block truncate" title={lead?.name ?? "—"}>
                      {lead?.name ?? "—"}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  <LevelBadge level={avg === undefined ? undefined : Math.round(avg)} />
                </td>
                <td className="px-4 py-3 text-center">
                  {!hasOfficial ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : top.length === 0 ? (
                    <span className="text-xs text-muted-foreground">{t("team.card.noGaps")}</span>
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
                            onClick={() => onTransition(a)}
                            aria-label={t("team.transition.action", { nome: a.name })}
                            title={t("team.transition.action", { nome: a.name })}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <TrendingUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(a)}
                            aria-label={`${t("common.edit")} ${a.name}`}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeactivate(a)}
                            aria-label={`${t("team.deactivate.action")} ${a.name}`}
                            title={t("team.deactivate.action")}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => onReactivate(a)}>
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
  );
}
