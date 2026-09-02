import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  Callout,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  QuerySection,
  SectionCard,
  SingleSelectFilter,
  StatusBadge,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsyncSubmit, useSuccessToast } from "@/hooks";
import { authApi, teamsApi, type SessionUser } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { TeamMemberRoles, type TeamMemberRole } from "@/lib/gateways/auth.gateway";
import type { TeamSummary } from "@/lib/gateways/teams.gateway";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { requireLeadReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useStore } from "@/lib/store";
import {
  SessionBondLedger,
  TeamRegistryViewModel,
  TeamStatusFilters,
  type TeamStatusFilter,
} from "@/lib/view-models";

export const Route = createFileRoute("/teams")({
  beforeLoad: requireLeadReach,
  head: () => ({
    meta: [
      { title: "Times — Synapse" },
      {
        name: "description",
        content:
          "Cadastro de times: quem é o gestor, o tech lead e as pessoas de cada um, com os vínculos que o serviço confirma.",
      },
    ],
  }),
  component: TeamsPage,
});

const TEAMS_QUERY_KEY = ["teams"] as const;
const ACCOUNTS_QUERY_KEY = ["auth-users"] as const;

function useTeamRegistryViewModel(): TeamRegistryViewModel {
  return useMemo(() => new TeamRegistryViewModel(defaultUiAuthorizationPolicy), []);
}

function TeamsPage() {
  const { t } = useI18n();
  const help = usePageHelp("teams");
  const user = useCurrentUser();
  const registry = useTeamRegistryViewModel();
  const canCompose = registry.canCompose(user);
  const canAdminister = registry.canAdminister(user);
  const queryClient = useQueryClient();
  const notifySuccess = useSuccessToast();
  const [status, setStatus] = useState<TeamStatusFilter>("active");
  const [chosenTeamId, setChosenTeamId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<TeamSummary | null>(null);
  const [deactivating, setDeactivating] = useState<TeamSummary | null>(null);
  const [refusal, setRefusal] = useState<{ team: TeamSummary; activeArchitects: number } | null>(
    null,
  );
  const [ledger, setLedger] = useState(() => SessionBondLedger.empty());
  const { error: deactivationError, run: runDeactivation } = useAsyncSubmit(
    t("teams.deactivate.error"),
  );

  const teamsQuery = useQuery({
    queryKey: TEAMS_QUERY_KEY,
    queryFn: teamsApi.teams,
    staleTime: 60_000,
    enabled: canCompose,
  });

  if (!canCompose) {
    return (
      <>
        <PageHeader title={t("teams.title")} description={t("teams.subtitle")} help={help} />
        <EmptyState title={t("teams.restricted")} hint={t("teams.restrictedHint")} />
      </>
    );
  }

  const reloadTeams = () => queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY });

  const deactivate = async (team: TeamSummary) => {
    setDeactivating(null);
    setRefusal(null);
    const result = await runDeactivation(async () => {
      const deactivated = await teamsApi.deactivateTeam(team.id);
      await reloadTeams();
      return deactivated;
    });
    if (result.ok) {
      notifySuccess("msg.team.deactivate.success", { nome: team.name }, result.value);
      return;
    }
    const explained = registry.deactivationRefusalOf(result.error);
    if (explained) setRefusal({ team, activeArchitects: explained.activeArchitects });
  };

  return (
    <>
      <PageHeader
        title={t("teams.title")}
        description={t("teams.subtitle")}
        help={help}
        actions={
          canAdminister && (
            <Button size="sm" onClick={() => setCreating(true)}>
              {t("teams.create.action")}
            </Button>
          )
        }
      />

      <div className="mb-6 max-w-xs">
        <SingleSelectFilter
          id="teams-status"
          label={t("teams.filter.status")}
          value={status}
          onChange={(value) => TeamStatusFilters.includes(value) && setStatus(value)}
          options={TeamStatusFilters.ALL.map((filter) => ({
            value: filter,
            label: t(`teams.status.${filter}`),
          }))}
        />
      </div>

      {refusal && (
        <Callout tone="warning" className="mb-4">
          {t("teams.deactivate.stillHasPeople", {
            n: refusal.activeArchitects,
            nome: refusal.team.name,
          })}
        </Callout>
      )}
      {!refusal && deactivationError && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {deactivationError}
        </p>
      )}

      <QuerySection
        query={teamsQuery}
        title={t("teams.list.title")}
        description={t("teams.list.subtitle")}
        errorMessage={t("teams.error.load")}
        skeleton={<p className="text-sm text-muted-foreground">{t("teams.loading")}</p>}
      >
        {(teams) => {
          const reachable = registry.reachableTeams(user, teams);
          const listed = registry.filterByStatus(reachable, status);
          const chosen = reachable.find((team) => team.id === chosenTeamId) ?? null;
          return (
            <div className="space-y-6">
              <TeamTable
                teams={listed}
                registry={registry}
                canAdminister={canAdminister}
                onRoster={(team) => setChosenTeamId(team.id)}
                onRename={setRenaming}
                onDeactivate={setDeactivating}
              />
              {chosen && (
                <TeamRoster
                  key={chosen.id}
                  team={chosen}
                  user={user}
                  registry={registry}
                  ledger={ledger}
                  onLedgerChange={setLedger}
                />
              )}
            </div>
          );
        }}
      </QuerySection>

      {creating && (
        <TeamNameDialog
          title={t("teams.create.title")}
          initialName=""
          errorFallback={t("teams.create.error")}
          onCancel={() => setCreating(false)}
          onSave={async (name) => {
            const created = await teamsApi.registerTeam(name);
            await reloadTeams();
            notifySuccess("msg.team.register.success", { nome: created.name }, created);
            setCreating(false);
          }}
        />
      )}

      {renaming && (
        <TeamNameDialog
          title={t("teams.rename.title", { nome: renaming.name })}
          initialName={renaming.name}
          errorFallback={t("teams.rename.error")}
          onCancel={() => setRenaming(null)}
          onSave={async (name) => {
            const renamed = await teamsApi.renameTeam(renaming.id, name);
            await reloadTeams();
            notifySuccess("msg.team.rename.success", { nome: renamed.name }, renamed);
            setRenaming(null);
          }}
        />
      )}

      <ConfirmDialog
        open={deactivating !== null}
        title={deactivating && t("teams.deactivate.confirmTitle", { nome: deactivating.name })}
        description={t("teams.deactivate.confirmDescription")}
        confirmLabel={t("teams.deactivate.confirm")}
        onCancel={() => setDeactivating(null)}
        onConfirm={() => deactivating && void deactivate(deactivating)}
      />
    </>
  );
}

function TeamTable({
  teams,
  registry,
  canAdminister,
  onRoster,
  onRename,
  onDeactivate,
}: {
  teams: readonly TeamSummary[];
  registry: TeamRegistryViewModel;
  canAdminister: boolean;
  onRoster: (team: TeamSummary) => void;
  onRename: (team: TeamSummary) => void;
  onDeactivate: (team: TeamSummary) => void;
}) {
  const { t } = useI18n();
  const store = useStore();

  if (teams.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("teams.list.empty")}</p>;
  }

  return (
    <SectionCard title={t("teams.list.title")} description={t("teams.list.subtitle")}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2">
                {t("teams.col.name")}
              </th>
              <th scope="col" className="py-2">
                {t("teams.col.status")}
              </th>
              <th scope="col" className="py-2">
                {t("teams.col.people")}
              </th>
              <th scope="col" className="py-2">
                {t("teams.col.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-b border-border/60 last:border-0">
                <td className="py-2 font-medium">{team.name}</td>
                <td className="py-2">
                  <StatusBadge
                    tone={team.active ? "done" : "neutral"}
                    label={team.active ? t("teams.badge.active") : t("teams.badge.inactive")}
                  />
                </td>
                <td className="py-2 tabular-nums">
                  {registry.activePeopleOf(team.id, store.architects).length}
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={t("teams.roster.actionFor", { nome: team.name })}
                      onClick={() => onRoster(team)}
                    >
                      {t("teams.roster.action")}
                    </Button>
                    {canAdminister && (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={t("teams.rename.actionFor", { nome: team.name })}
                        onClick={() => onRename(team)}
                      >
                        {t("teams.rename.action")}
                      </Button>
                    )}
                    {canAdminister && team.active && (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={t("teams.deactivate.actionFor", { nome: team.name })}
                        onClick={() => onDeactivate(team)}
                      >
                        {t("teams.deactivate.action")}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function TeamRoster({
  team,
  user,
  registry,
  ledger,
  onLedgerChange,
}: {
  team: TeamSummary;
  user: SessionUser;
  registry: TeamRegistryViewModel;
  ledger: SessionBondLedger;
  onLedgerChange: (ledger: SessionBondLedger) => void;
}) {
  const { t } = useI18n();
  const store = useStore();
  const canReadDirectory = registry.canReadAccountDirectory(user);
  const people = registry.activePeopleOf(team.id, store.architects);
  const bonds = ledger.bondsOf(team.id);

  const accountsQuery = useQuery({
    queryKey: ACCOUNTS_QUERY_KEY,
    queryFn: authApi.users,
    staleTime: 30_000,
    enabled: canReadDirectory,
  });
  const accounts = registry.linkableAccounts(accountsQuery.data ?? []);
  const accountName = (userId: string): string =>
    (accountsQuery.data ?? []).find((account) => account.id === userId)?.name ?? userId;

  return (
    <SectionCard
      title={t("teams.roster.title", { nome: team.name })}
      description={t("teams.roster.subtitle")}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={t("teams.roster.people.title")}
          description={t("teams.roster.people.subtitle")}
        >
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("teams.roster.people.empty")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {people.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-2">
                  <span className="font-medium">{person.name}</span>
                  <span className="text-muted-foreground">{person.role}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t("teams.roster.bonds.title")}
          description={t("teams.roster.bonds.subtitle")}
        >
          {bonds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("teams.roster.bonds.empty")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {bonds.map((bond) => (
                <li
                  key={`${bond.userId}:${bond.role}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="font-medium">{accountName(bond.userId)}</span>
                  <StatusBadge
                    tone={bond.role === TeamMemberRoles.MANAGER ? "done" : "progress"}
                    label={t(`users.role.${bond.role}`)}
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {canReadDirectory ? (
        <MembershipForm
          team={team}
          accounts={accounts}
          roles={registry.membershipRolesOfferedTo(user)}
          ledger={ledger}
          onLedgerChange={onLedgerChange}
        />
      ) : (
        <Callout tone="warning" className="mt-4">
          {t("teams.membership.directoryOnlyAdmin")}
        </Callout>
      )}
    </SectionCard>
  );
}

function MembershipForm({
  team,
  accounts,
  roles,
  ledger,
  onLedgerChange,
}: {
  team: TeamSummary;
  accounts: readonly SessionUser[];
  roles: readonly TeamMemberRole[];
  ledger: SessionBondLedger;
  onLedgerChange: (ledger: SessionBondLedger) => void;
}) {
  const { t } = useI18n();
  const notifySuccess = useSuccessToast();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<TeamMemberRole>(roles[0] ?? "member");
  const [newRole, setNewRole] = useState<TeamMemberRole>(roles[0] ?? "member");
  const { submitting, error, run } = useAsyncSubmit(t("teams.membership.error"));

  const roleOptions = roles.map((option) => ({ value: option, label: t(`users.role.${option}`) }));
  const chooseRole = (setter: (role: TeamMemberRole) => void) => (value: string) => {
    if (TeamMemberRoles.includes(value)) setter(value);
  };
  const ready = userId !== "" && !submitting;

  const assign = async () => {
    const result = await run(() => teamsApi.assignTeamMembership(team.id, userId, role));
    if (!result.ok) return;
    onLedgerChange(ledger.withBond(result.value));
    notifySuccess("msg.team.membership.assign.success", {}, result.value);
  };

  const reassign = async () => {
    const result = await run(() =>
      teamsApi.reassignTeamMembershipRole(team.id, userId, role, newRole),
    );
    if (!result.ok) return;
    onLedgerChange(ledger.withReassignedBond(role, result.value));
    notifySuccess("msg.team.membership.reassign.success", {}, result.value);
  };

  const release = async () => {
    const result = await run(() => teamsApi.releaseTeamMembership(team.id, userId, role));
    if (!result.ok) return;
    onLedgerChange(ledger.withoutBond(team.id, userId, role));
    notifySuccess("teams.membership.released");
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="font-display text-sm font-semibold">{t("teams.membership.title")}</p>
      <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
        {t("teams.membership.subtitle")}
      </p>
      <div className="mt-3 grid items-end gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <SingleSelectFilter
          id={`team-membership-user-${team.id}`}
          label={t("teams.membership.person")}
          value={userId}
          onChange={setUserId}
          options={[
            { value: "", label: t("teams.membership.choosePerson") },
            ...accounts.map((account) => ({ value: account.id, label: account.name })),
          ]}
        />
        <SingleSelectFilter
          id={`team-membership-role-${team.id}`}
          label={t("teams.membership.role")}
          value={role}
          onChange={chooseRole(setRole)}
          options={roleOptions}
        />
        <div className="flex gap-2">
          <Button size="sm" disabled={!ready} onClick={() => void assign()}>
            {t("teams.membership.assign")}
          </Button>
          <Button size="sm" variant="outline" disabled={!ready} onClick={() => void release()}>
            {t("teams.membership.release")}
          </Button>
        </div>
      </div>
      <div className="mt-3 grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <SingleSelectFilter
          id={`team-membership-new-role-${team.id}`}
          label={t("teams.membership.newRole")}
          value={newRole}
          onChange={chooseRole(setNewRole)}
          options={roleOptions}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!ready || newRole === role}
          onClick={() => void reassign()}
        >
          {t("teams.membership.reassign")}
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function TeamNameDialog({
  title,
  initialName,
  errorFallback,
  onCancel,
  onSave,
}: {
  title: string;
  initialName: string;
  errorFallback: string;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const { submitting, error, run } = useAsyncSubmit(errorFallback);
  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== initialName && !submitting;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="team-name">{t("teams.name.label")}</Label>
            <Input
              id="team-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {t("teams.name.cancel")}
          </Button>
          <Button disabled={!canSave} onClick={() => void run(() => onSave(trimmed))}>
            {submitting ? t("teams.name.saving") : t("teams.name.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
