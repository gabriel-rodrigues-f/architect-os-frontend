import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";

import {
  ArchitectNameCombobox,
  DataViewToolbar,
  DeactivateDialog,
  MultiSelectFilter,
  OutOfReachScreen,
  PageHeader,
  Pagination,
  SingleSelectFilter,
  SpecializationCombobox,
  TeamOrLevelChangeDialog,
  TeamRosterView,
  useArchitectForm,
  useCardsAndTableViews,
  useTeamRoster,
  ViewToggle,
} from "@/components/app";
import { EmptyState } from "@/components/app/DataView";
import { EmptyState as EmptyStateCard } from "@/components/app/ui-bits";
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
import { type RoleName } from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest } from "@/lib/context-scope";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { requireLeadershipReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useCareerLevelsByRank, useStore } from "@/lib/store";
import { TeamViewModel } from "@/lib/view-models";

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
  beforeLoad: requireLeadershipReach,
  component: TeamPage,
});

const TEAM_CONTEXTS: readonly ContextScopeRequest[] = [
  "architects",
  "assessments",
  "capabilities",
  "competencies",
  "cycles",
  "activeCycle",
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

  const form = useArchitectForm();
  const roster = useTeamRoster(isAdmin);
  const cardsAndTableViews = useCardsAndTableViews();

  const careerLevels = useCareerLevelsByRank();

  return (
    <>
      <PageHeader
        title={t("team.title")}
        description={t("team.subtitle")}
        help={help}
        actions={isAdmin ? <Button onClick={form.openCreate}>{t("team.new")}</Button> : undefined}
      />

      {store.architects.length === 0 ? (
        <EmptyStateCard
          title={t("team.empty.title")}
          hint={t("team.empty.hint")}
          action={
            isAdmin && (
              <Button className="mt-4" onClick={form.openCreate}>
                {t("team.empty.cta")}
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataViewToolbar
            layout="grid-3"
            resultCount={roster.enrichedSorted.length}
            totalCount={store.architects.length}
            activeFilters={roster.activeFilterChips}
            onClearFilters={roster.clearFilters}
          >
            <ArchitectNameCombobox
              architects={store.architects}
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
              id="team-filter-specialization"
              label={t("team.filter.specialization")}
              options={roster.specializationOptions}
              selected={roster.specializationFilter}
              onChange={roster.setSpecializationFilter}
              selectAllLabel={t("team.filter.specialization.all")}
              allSummaryLabel={t("team.filter.specialization.all")}
              noneSummaryLabel={t("team.filter.chip.none")}
              emptyLabel={t("team.filter.specialization.empty")}
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
              onTransition={form.setTransitioning}
              onEdit={form.openEdit}
              onDeactivate={form.setConfirmDeactivate}
              onReactivate={form.reactivate}
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

      <Dialog open={form.editing !== null} onOpenChange={(open) => !open && form.setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.editing ? t("team.form.edit") : t("team.form.create")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">{t("team.form.name")}</Label>
              <Input
                id="name"
                value={form.form.name}
                onChange={(e) => form.setForm({ ...form.form, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && form.submit()}
              />
            </div>
            <div>
              <Label htmlFor="email">{t("team.form.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("team.form.email.placeholder")}
                value={form.form.email}
                onChange={(e) => form.setForm({ ...form.form, email: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && form.submit()}
              />
            </div>
            {!form.editing && (
              <div>
                <Label htmlFor="role">{t("team.form.role")}</Label>
                <select
                  id="role"
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.form.role}
                  onChange={(e) => form.setForm({ ...form.form, role: e.target.value as RoleName })}
                >
                  {careerLevels.map((l) => (
                    <option key={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}
            {!form.editing && (
              <div>
                <Label htmlFor="team">{t("team.form.team")}</Label>
                <select
                  id="team"
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  value={form.form.teamId ?? ""}
                  onChange={(event) =>
                    form.setForm({
                      ...form.form,
                      teamId: event.target.value === "" ? null : event.target.value,
                    })
                  }
                >
                  <option value="">{t("team.form.team.none")}</option>
                  {form.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
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
                    selectedId={form.form.primarySpecializationCompetencyId}
                    onSelect={(id) =>
                      form.setForm({ ...form.form, primarySpecializationCompetencyId: id })
                    }
                  />
                </div>
                {!form.form.primarySpecializationCompetencyId && form.form.specialization && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("team.form.spec.legacyPending", { texto: form.form.specialization })}
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
                  value={form.form.years}
                  onChange={(e) => form.setForm({ ...form.form, years: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && form.submit()}
                />
              </div>
            </div>
          </div>
          {!form.canSubmit && (
            <p className="mt-3 text-xs text-muted-foreground">{t("team.form.requiredHint")}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => form.setEditing(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={form.submit} disabled={!form.canSubmit || form.submitting}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {form.confirmDeactivate && (
        <DeactivateDialog
          architect={form.confirmDeactivate}
          onClose={() => form.setConfirmDeactivate(null)}
        />
      )}

      {form.transitioning && (
        <TeamOrLevelChangeDialog
          architect={form.transitioning}
          teams={form.teams}
          onClose={() => form.setTransitioning(null)}
        />
      )}
    </>
  );
}
