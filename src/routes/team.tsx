import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import {
  ArchitectNameCombobox,
  DataViewToolbar,
  MultiSelectFilter,
  OutOfReachScreen,
  PageHeader,
  Pagination,
  SingleSelectFilter,
  TeamOrLevelChangeDialog,
  TeamRosterView,
  useCardsAndTableViews,
  useTeamRoster,
  useTeamRosterActions,
  ViewToggle,
} from "@/components/app";
import { EmptyState } from "@/components/app/DataView";
import { EmptyState as EmptyStateCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest, SELECTOR_CONTEXTS } from "@/lib/context-scope";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { requireLeadershipReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useStore } from "@/lib/store";
import { TeamViewModel } from "@/lib/view-models";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Time — Synapse" },
      {
        name: "description",
        content: "Time, níveis médios, gaps e progresso de desenvolvimento.",
      },
      { property: "og:title", content: "Time — Synapse" },
      {
        property: "og:description",
        content: "Gestão do time: perfis, níveis e desenvolvimento.",
      },
    ],
  }),
  beforeLoad: requireLeadershipReach,
  component: TeamPage,
});

const TEAM_CONTEXTS: readonly ContextScopeRequest[] = [
  ...SELECTOR_CONTEXTS,
  "cycles",
  "mentoringSessions",
];

function TeamPage() {
  const user = useCurrentUser();
  const { t } = useI18n();
  const help = usePageHelp("team");
  const isLeadership = defaultUiAuthorizationPolicy.isLeadership(user);

  if (!isLeadership) {
    return (
      <OutOfReachScreen
        title={t("team.title")}
        help={help}
        reason={t("team.leadershipOnly")}
        hint={t("team.leadershipOnlyHint")}
      />
    );
  }

  return (
    <ContextScope contexts={TEAM_CONTEXTS}>
      <TeamRoster />
    </ContextScope>
  );
}

function TeamRoster() {
  const store = useStore();
  const { t } = useI18n();
  const help = usePageHelp("team");

  const viewModel = useMemo(() => new TeamViewModel(store, defaultUiAuthorizationPolicy), [store]);
  const isAdmin = viewModel.isAdmin(useCurrentUser());

  const actions = useTeamRosterActions();
  const roster = useTeamRoster(isAdmin);
  const cardsAndTableViews = useCardsAndTableViews();

  return (
    <>
      <PageHeader title={t("team.title")} description={t("team.subtitle")} help={help} />

      {store.architectsIncludingInactive.length === 0 ? (
        <EmptyStateCard
          title={t("team.empty.title")}
          hint={t("team.empty.hint")}
          action={
            <Button className="mt-4" asChild>
              <Link to="/users">{t("team.empty.cta")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <DataViewToolbar
            layout="grid-3"
            resultCount={roster.enrichedSorted.length}
            totalCount={roster.filterablePeople.length}
            activeFilters={roster.activeFilterChips}
            onClearFilters={roster.clearFilters}
          >
            {/*
              ONDA 45 — o filtro de PESSOAS oferece só quem está ATIVO.
              Regra do dono (2026-09-04): *"nenhum profissional desativado
              poderia aparecer em filtros na aplicação, em nenhum filtro"*.

              Antes daqui ele recebia `architectsIncludingInactive` — o nome da
              coleção já dizia o que ela faz. O resultado era um menu que
              oferecia alguém que a lista se recusava a desenhar: escolher essa
              pessoa devolvia lista vazia, sem explicar por quê. O contador
              "2 de 3" tinha o mesmo defeito, e denunciava a existência de
              quem a tela esconde.
            */}
            <ArchitectNameCombobox
              architects={roster.filterablePeople}
              selected={roster.nameSelection}
              onChange={roster.setNameSelection}
            />
            {isAdmin && (
              <MultiSelectFilter
                id="team-filter-status"
                label={t("team.filter.status")}
                options={roster.statusOptions}
                selected={roster.statusFilter}
                onChange={roster.setStatusFilter}
                selectAllLabel={t("team.filter.status.all")}
                allSummaryLabel={t("team.filter.status.all")}
                noneSummaryLabel={t("team.filter.chip.none")}
                emptyLabel={t("team.filter.status.empty")}
              />
            )}
            <MultiSelectFilter
              id="team-filter-role"
              label={t("team.filter.role")}
              options={roster.roleOptions}
              selected={roster.roleFilter}
              onChange={roster.setRoleFilter}
              selectAllLabel={t("team.filter.role.all")}
              allSummaryLabel={t("team.filter.role.all")}
              noneSummaryLabel={t("team.filter.chip.none")}
              emptyLabel={t("team.filter.role.empty")}
            />
            <MultiSelectFilter
              id="team-filter-capability"
              label={t("team.filter.capability")}
              options={roster.capabilityOptions}
              selected={roster.capabilityFilter}
              onChange={roster.setCapabilityFilter}
              selectAllLabel={t("team.filter.capability.all")}
              allSummaryLabel={t("team.filter.capability.all")}
              noneSummaryLabel={t("team.filter.chip.none")}
              emptyLabel={t("team.filter.capability.empty")}
            />
            <SingleSelectFilter
              id="team-sort"
              label={t("dataView.sortLabel")}
              options={roster.sortOptions}
              value={roster.sort}
              onChange={(value) => roster.setSort(value as typeof roster.sort)}
            />
          </DataViewToolbar>

          <div className="mb-3 flex justify-end">
            <ViewToggle
              view={roster.view}
              onChange={roster.setViewOverride}
              options={cardsAndTableViews}
            />
          </div>

          {roster.pageItems.length === 0 ? (
            <EmptyState
              hasFilters
              emptyMessage={t("team.empty.noResults")}
              noResultsMessage={t("team.empty.noResults")}
              onClearFilters={roster.clearFilters}
            />
          ) : (
            <TeamRosterView
              pageItems={roster.pageItems}
              view={roster.view}
              isAdmin={isAdmin}
              onTransition={actions.setTransitioning}
              onReactivate={actions.reactivate}
            />
          )}

          <Pagination
            page={roster.clampedPage}
            pageSize={roster.pageSize}
            total={roster.enrichedSorted.length}
            onPageChange={roster.setPage}
            pageSizeOptions={[10, 25, 50]}
            onPageSizeChange={(n) => roster.setPageSize(n)}
          />
        </>
      )}

      {actions.transitioning && (
        <TeamOrLevelChangeDialog
          architect={actions.transitioning}
          teams={actions.teams}
          onClose={() => actions.setTransitioning(null)}
        />
      )}
    </>
  );
}
