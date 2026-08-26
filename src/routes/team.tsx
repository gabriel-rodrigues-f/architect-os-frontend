import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import {
  CareerLevelTransitionDialog,
  DeactivateDialog,
  LeadCombobox,
  TeamRosterView,
  useArchitectForm,
  useTeamRoster,
} from "@/components/app/team-shared";
import { DataViewToolbar, EmptyState, Pagination } from "@/components/app/DataView";
import { EmptyState as EmptyStateCard, PageHeader } from "@/components/app/ui-bits";
import { ArchitectNameCombobox } from "@/components/app/ArchitectNameCombobox";
import { ViewToggle } from "@/components/app/ViewToggle";
import { MultiSelectFilter } from "@/components/app/MultiSelectFilter";
import { SingleSelectFilter } from "@/components/app/SingleSelectFilter";
import { SpecializationCombobox } from "@/components/app/SpecializationCombobox";
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
import { authApi } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useCareerLevelsByRank, useStore } from "@/lib/store";
import { TeamViewModel } from "@/lib/view-models/team-view-model";

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

function TeamPage() {
  const store = useStore();
  const { t } = useI18n();
  const help = usePageHelp("team");

  const viewModel = useMemo(() => new TeamViewModel(store, defaultUiAuthorizationPolicy), [store]);
  const isAdmin = viewModel.isAdmin(useCurrentUser());

  const { data: users } = useQuery({
    queryKey: ["auth-users"],
    queryFn: authApi.users,
    staleTime: 30_000,
    enabled: isAdmin,
  });
  const leadOptions = (users ?? []).filter((u) => u.role === "lead" || u.role === "admin");

  const form = useArchitectForm();
  const roster = useTeamRoster(isAdmin);

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
          {}
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
            {}
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
            {}
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
              cardsLabel={t("team.view.cards")}
              tableLabel={t("team.view.table")}
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
              leadOptions={leadOptions}
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

      {}
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
            {}
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
            {form.editing && (
              <div>
                <Label htmlFor="leadUserId">{t("team.form.lead")}</Label>
                <div className="mt-1">
                  <LeadCombobox
                    id="leadUserId"
                    options={leadOptions}
                    selectedId={form.form.leadUserId}
                    onChange={(id) => form.setForm({ ...form.form, leadUserId: id })}
                    label={t("team.form.lead")}
                  />
                </div>
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
        <CareerLevelTransitionDialog
          architect={form.transitioning}
          onClose={() => form.setTransitioning(null)}
        />
      )}
    </>
  );
}
