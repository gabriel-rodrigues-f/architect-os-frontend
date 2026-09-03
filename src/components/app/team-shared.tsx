import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { TrendingUp, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ActiveFilterChip, SortOption } from "@/components/app/DataView";
import { CommandWithReasonDialog } from "@/components/app/CommandWithReasonDialog";
import { GapBadge, Initials, LevelBadge } from "@/components/app/ui-bits";
import type { MultiSelectFilterOption } from "@/components/app/MultiSelectFilter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type Architect } from "@/lib/domain";
import { Selection } from "@/lib/selection";
import { useSuccessToast } from "@/hooks";
import { teamsApi } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import type { TeamSummary } from "@/lib/gateways/teams.gateway";
import { useI18n } from "@/lib/i18n";
import { type Gap } from "@/lib/selectors";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useCareerLevelsByRank, useSelectors, useStore } from "@/lib/store";
import { defaultNameFormatter } from "@/lib/text";
import { cn } from "@/lib/utils";
import { TeamOrLevelChange, TeamViewModel, type ArchitectFormRole } from "@/lib/view-models";

const NO_CAPABILITY = "__no-capability__";

interface EnrichedArchitect {
  architect: Architect;
  topGaps: Gap[];
  avg: number | undefined;
  hasOfficial: boolean;
  lastMentoring: string | undefined;
}

function useTeamViewModel(): TeamViewModel {
  const store = useStore();
  return useMemo(() => new TeamViewModel(store, defaultUiAuthorizationPolicy), [store]);
}

/**
 * ONDA 37 — o que sobrou das ações de /team. O dono tirou daqui "Cadastrar
 * profissional", "Editar profissional" e "Desativar profissional": a pessoa
 * nasce, muda de cargo e é desativada em Usuários, num ato só. Fica o que é
 * DESTA tela — mudar time ou nível, que é onde o histórico com motivo mora —
 * e reativar, porque o filtro "Inativos" só existe aqui: sem ele a
 * desativação seria irreversível pela interface.
 */
export function useTeamRosterActions() {
  const viewModel = useTeamViewModel();
  const isAdmin = viewModel.isAdmin(useCurrentUser());

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: teamsApi.teams,
    staleTime: 60_000,
    enabled: isAdmin,
  });
  const teams = viewModel.allocatableTeams(teamsQuery.data ?? []);

  const [transitioning, setTransitioning] = useState<Architect | null>(null);
  const notifySuccess = useSuccessToast();

  const reactivate = (architect: Architect) => {
    viewModel.reactivate(architect);
    notifySuccess("team.reactivate.toast", { nome: architect.name });
  };

  return { teams, transitioning, setTransitioning, reactivate };
}

export function useTeamRoster(isAdmin: boolean) {
  const store = useStore();
  const { t } = useI18n();
  const sel = useSelectors();

  const [statusFilter, setStatusFilter] = useState<string[]>(["active"]);

  const careerLevels = useCareerLevelsByRank();
  const [roleSelection, setRoleSelection] = useState<string[] | null>(null);
  const roleFilter = roleSelection ?? careerLevels.map((l) => l.name);
  const [capabilitySelection, setCapabilitySelection] = useState<string[] | null>(null);
  const [nameSelectionChosen, setNameSelectionChosen] = useState<string[] | null>(null);
  const [sort, setSort] = useState<"name-asc" | "name-desc" | "level" | "recent">("name-asc");
  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(10);
  const [viewOverride, setViewOverride] = useState<"cards" | "table" | null>(null);

  useEffect(() => {
    setPage(1);
  }, [nameSelectionChosen, statusFilter, roleSelection, capabilitySelection, sort]);

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

  const capabilityFilter = useMemo(
    () => capabilitySelection ?? capabilityOptions.map((option) => option.id),
    [capabilitySelection, capabilityOptions],
  );
  const nameSelection = useMemo(
    () => nameSelectionChosen ?? store.architects.map((a) => a.id),
    [nameSelectionChosen, store.architects],
  );

  const filtered = useMemo(() => {
    const effectiveStatus = isAdmin ? statusFilter : ["active"];

    const nameFilter = Selection.explicit(nameSelection);
    return store.architects.filter((a) => {
      if (!nameFilter.contains(a.id)) return false;
      if (!effectiveStatus.includes(a.active ? "active" : "inactive")) return false;

      if (roleSelection !== null && !roleSelection.includes(a.role)) return false;
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

  const summarize = (selected: string[], options: MultiSelectFilterOption[]) => {
    const [only, ...rest] = selected;
    if (only === undefined) return t("team.filter.chip.none");
    if (rest.length > 0) return t("filter.multi.count", { n: selected.length });
    return options.find((o) => o.id === only)?.label ?? only;
  };

  const activeFilterChips: ActiveFilterChip[] = [];
  if (nameSelection.length !== store.architects.length) {
    activeFilterChips.push({
      key: "name",
      label: t("team.filter.chip.name", { n: nameSelection.length }),
      onRemove: () => setNameSelectionChosen(null),
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
  if (capabilityFilter.length !== capabilityOptions.length) {
    activeFilterChips.push({
      key: "cap",
      label: `${t("team.filter.capability")}: ${summarize(capabilityFilter, capabilityOptions)}`,
      onRemove: () => setCapabilitySelection(null),
    });
  }

  const clearFilters = () => {
    setNameSelectionChosen(null);
    setStatusFilter(["active"]);
    setRoleSelection(null);
    setCapabilitySelection(null);
    setSort("name-asc");
  };

  return {
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter: setRoleSelection as (ids: string[]) => void,
    capabilityFilter,
    setCapabilityFilter: setCapabilitySelection as (ids: string[]) => void,
    nameSelection,
    setNameSelection: setNameSelectionChosen as (ids: string[]) => void,
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

export function TeamOrLevelChangeDialog({
  architect,
  teams,
  onClose,
}: {
  architect: Architect;
  teams: readonly TeamSummary[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const viewModel = useTeamViewModel();
  const notifySuccess = useSuccessToast();

  const careerLevels = useCareerLevelsByRank();
  const [toRole, setToRole] = useState<ArchitectFormRole>("");
  const [toTeamId, setToTeamId] = useState<string | null>(architect.teamId ?? null);
  const change = new TeamOrLevelChange(architect, toRole, toTeamId);
  const currentTeam = viewModel.teamNameOf(architect.teamId, teams) ?? t("team.transition.noTeam");

  return (
    <CommandWithReasonDialog
      title={t("team.transition.title", { nome: architect.name })}
      body={t("team.transition.body", { atual: architect.role, time: currentTeam })}
      reasonInputId="transition-reason"
      reasonLabel={t("team.transition.reasonLabel")}
      reasonPlaceholder={t("team.transition.reasonPlaceholder")}
      confirmLabel={t("team.transition.confirm")}
      submittingLabel={t("team.transition.submitting")}
      fallbackError={t("team.transition.error")}
      canSubmit={change.isEffective}
      extraFields={() => (
        <div className="grid gap-3">
          <div>
            <Label htmlFor="transition-to-role">{t("team.transition.toRole")}</Label>
            <select
              id="transition-to-role"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={toRole}
              onChange={(e) => setToRole(e.target.value as ArchitectFormRole)}
            >
              <option value="">{t("team.transition.keepRole")}</option>
              {viewModel.otherCareerLevels(careerLevels, architect.role).map((l) => (
                <option key={l.id} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="transition-to-team">{t("team.transition.toTeam")}</Label>
            <select
              id="transition-to-team"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              value={toTeamId ?? ""}
              onChange={(e) => setToTeamId(e.target.value === "" ? null : e.target.value)}
            >
              <option value="">{t("team.transition.noTeam")}</option>
              {viewModel.allocatableTeams(teams).map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      onSubmit={(reason) =>
        viewModel.changeTeamOrLevel(change, reason).then((updated) =>
          notifySuccess(
            "msg.people.careerLevelTransition.success",
            {
              nome: architect.name,
              time: viewModel.teamNameOf(updated.teamId, teams) ?? t("team.transition.noTeam"),
            },
            updated,
          ),
        )
      }
      onClose={onClose}
    />
  );
}

function WorstGapCell({
  hasOfficial,
  worstGap,
}: {
  hasOfficial: boolean;
  worstGap: Gap | undefined;
}) {
  const { t } = useI18n();
  if (!hasOfficial) return <span className="text-xs text-muted-foreground">—</span>;
  if (!worstGap)
    return <span className="text-xs text-muted-foreground">{t("team.card.noGaps")}</span>;
  return <GapBadge gap={worstGap.gap} />;
}

export function TeamRosterView({
  pageItems,
  view,
  isAdmin,
  onTransition,
  onReactivate,
}: {
  pageItems: EnrichedArchitect[];
  view: "cards" | "table";
  isAdmin: boolean;
  onTransition: (architect: Architect) => void;
  onReactivate: (architect: Architect) => void;
}) {
  const { t } = useI18n();

  return view === "cards" ? (
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
              <p className="truncate text-xs text-muted-foreground" title={a.role}>
                {a.role}
              </p>
              <p className="truncate text-xs text-muted-foreground" title={a.email}>
                {a.email}
              </p>
            </div>
            {isAdmin && (
              <div className="flex shrink-0 gap-1">
                {a.active ? (
                  <button
                    type="button"
                    onClick={() => onTransition(a)}
                    aria-label={t("team.transition.action", { nome: a.name })}
                    title={t("team.transition.action", { nome: a.name })}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                  </button>
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
      ))}
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
                {isAdmin && (
                  <td className="max-w-[160px] px-4 py-3 text-muted-foreground">
                    <span className="block truncate" title={a.teamId ?? "—"}>
                      {a.teamId ?? "—"}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3 text-center">
                  <LevelBadge level={avg === undefined ? undefined : Math.round(avg)} />
                </td>
                <td className="px-4 py-3 text-center">
                  <WorstGapCell hasOfficial={hasOfficial} worstGap={top[0]} />
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
                        <button
                          type="button"
                          onClick={() => onTransition(a)}
                          aria-label={t("team.transition.action", { nome: a.name })}
                          title={t("team.transition.action", { nome: a.name })}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                        </button>
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
