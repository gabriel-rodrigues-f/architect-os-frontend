import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Callout,
  ConfirmDialog,
  DataOriginCallout,
  EmptyState,
  PageAction,
  PageHeader,
  QuerySection,
  SectionAction,
  SectionCard,
  Seniority,
  SingleSelectFilter,
  StatusBadge,
  TeamCareerLadderField,
} from "@/components/app";
import { EmptyFieldInvite } from "@/components/app/EmptySelection";
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
import { Textarea } from "@/components/ui/textarea";
import { useAsyncSubmit, useSuccessToast } from "@/hooks";
import { authApi, teamRosterApi, teamsApi, teamTransitionsApi, type SessionUser } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest } from "@/lib/context-scope";
import type { Professional } from "@/lib/domain";
import { TeamMemberRoles, type TeamMemberRole } from "@/lib/gateways/auth.gateway";
import type { TeamRosterMember } from "@/lib/gateways/team-roster.gateway";
import type {
  CalendarPeriod,
  TeamTransitions,
  TeamTransitionsRow,
} from "@/lib/gateways/team-transitions.gateway";
import type { TeamSummary } from "@/lib/gateways/teams.gateway";
import { useI18n } from "@/lib/i18n";
import { Registration } from "@/lib/registration";
import { initialSearchParam } from "@/lib/search-params";
import { usePageHelp } from "@/lib/page-help";
import { requirePeopleAdministrationReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { TeamCareerLevelsQuery } from "@/lib/configuration-queries";
import { useCareerLevelsByRank, useStore } from "@/lib/store";
import {
  TeamCareerLadderDraft,
  TeamRegistryViewModel,
  TeamStatusFilters,
  TeamTransitionsViewModel,
  type TeamStatusFilter,
} from "@/lib/view-models";

/**
 * Dono (2026-09-08, item 12): o seletor de time vazio leva ao FORMULÁRIO de
 * cadastro — "não só à tela". É este parâmetro que a `Registration.TEAM`
 * escreve no link, e é ele que abre o diálogo assim que a tela monta.
 */
const teamsSearchSchema = z.object({
  cadastrar: z.literal("time").optional(),
});

export const Route = createFileRoute("/teams")({
  validateSearch: teamsSearchSchema,
  beforeLoad: requirePeopleAdministrationReach,
  head: () => ({
    meta: [
      { title: "Estrutura de Times — Synapse" },
      {
        name: "description",
        content:
          "Cadastro de times: quem é o gerente, o tech lead e as pessoas de cada um, com os vínculos que o serviço registra.",
      },
    ],
  }),
  component: TeamsPage,
});

const TEAMS_QUERY_KEY = ["teams"] as const;
const ACCOUNTS_QUERY_KEY = ["auth-users"] as const;

const ROLE_BADGE_TONE: Record<TeamMemberRole, "done" | "progress" | "neutral"> = {
  manager: "done",
  tech_lead: "progress",
  member: "neutral",
};

function useTeamRegistryViewModel(): TeamRegistryViewModel {
  return useMemo(() => new TeamRegistryViewModel(defaultUiAuthorizationPolicy), []);
}

function useTeamTransitionsViewModel(): TeamTransitionsViewModel {
  return useMemo(() => new TeamTransitionsViewModel(defaultUiAuthorizationPolicy), []);
}

const TEAMS_CONTEXTS: readonly ContextScopeRequest[] = ["professionals"];

function TeamsPage() {
  const { t } = useI18n();
  const help = usePageHelp("teams");
  const user = useCurrentUser();
  const registry = useTeamRegistryViewModel();
  const comparison = useTeamTransitionsViewModel();
  // Usuários e Times: administrador e gerente com vínculo (`canAdministerPeople`).
  const canAdministerPeople =
    defaultUiAuthorizationPolicy.canAdministerPeople(user) && registry.canCompose(user);
  const canCompare = comparison.canCompare(user);

  if (!canAdministerPeople) {
    return (
      <>
        <PageHeader title={t("teams.title")} description={t("teams.subtitle")} help={help} />
        <EmptyState title={t("teams.restricted")} hint={t("teams.restrictedHint")} />
        {canCompare && (
          <div className="mt-6">
            <TeamTransitionsSection comparison={comparison} />
          </div>
        )}
      </>
    );
  }

  return (
    <ContextScope contexts={TEAMS_CONTEXTS}>
      <TeamsScreen />
    </ContextScope>
  );
}

function TeamsScreen() {
  const { t } = useI18n();
  const help = usePageHelp("teams");
  const user = useCurrentUser();
  const registry = useTeamRegistryViewModel();
  const comparison = useTeamTransitionsViewModel();
  const canCompare = comparison.canCompare(user);
  const canAdminister = registry.canAdminister(user);
  const queryClient = useQueryClient();
  const notifySuccess = useSuccessToast();
  const [status, setStatus] = useState<TeamStatusFilter>("active");
  const [chosenTeamId, setChosenTeamId] = useState<string | null>(null);
  // O link do seletor de time vazio chega com `?cadastrar=time`: o diálogo
  // de cadastro já nasce aberto (dono, 2026-09-08, item 12). A leitura é a
  // da casa (`initialSearchParam`), a mesma de Avaliações e PDI — ela não
  // exige o roteador montado, e a tela é montada sem ele em teste.
  const [creating, setCreating] = useState(() => initialSearchParam("cadastrar") === "time");
  const [renaming, setRenaming] = useState<TeamSummary | null>(null);
  const [redrawingLadder, setRedrawingLadder] = useState<TeamSummary | null>(null);
  const [deactivating, setDeactivating] = useState<TeamSummary | null>(null);
  const [refusal, setRefusal] = useState<{ team: TeamSummary; activeProfessionals: number } | null>(
    null,
  );
  const { error: deactivationError, run: runDeactivation } = useAsyncSubmit(
    t("teams.deactivate.error"),
  );

  const teamsQuery = useQuery({
    queryKey: TEAMS_QUERY_KEY,
    queryFn: teamsApi.teams,
    staleTime: 60_000,
  });

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
    if (explained) setRefusal({ team, activeProfessionals: explained.activeProfessionals });
  };

  return (
    <>
      <PageHeader
        title={t("teams.title")}
        description={t("teams.subtitle")}
        help={help}
        actions={
          canAdminister && (
            <PageAction label={t("teams.create.action")} onClick={() => setCreating(true)} />
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
          empty={{ message: t("teams.filter.status.empty") }}
        />
      </div>

      {refusal && (
        <Callout tone="warning" className="mb-4">
          {t("teams.deactivate.stillHasPeople", {
            n: refusal.activeProfessionals,
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
                onCareerLadder={setRedrawingLadder}
                onDeactivate={setDeactivating}
              />
              {chosen && (
                <TeamRoster
                  key={chosen.id}
                  team={chosen}
                  teams={teams}
                  user={user}
                  registry={registry}
                />
              )}
              {canCompare && <TeamTransitionsSection comparison={comparison} />}
            </div>
          );
        }}
      </QuerySection>

      {creating && (
        <TeamRegistrationDialog
          onCancel={() => setCreating(false)}
          onSaved={(created) => {
            notifySuccess("msg.team.register.success", { nome: created.name }, created);
            setCreating(false);
          }}
          reloadTeams={reloadTeams}
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

      {redrawingLadder && (
        <TeamCareerLadderDialog
          team={redrawingLadder}
          onCancel={() => setRedrawingLadder(null)}
          onSaved={() => setRedrawingLadder(null)}
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
  onCareerLadder,
  onDeactivate,
}: {
  teams: readonly TeamSummary[];
  registry: TeamRegistryViewModel;
  canAdminister: boolean;
  onRoster: (team: TeamSummary) => void;
  onRename: (team: TeamSummary) => void;
  onCareerLadder: (team: TeamSummary) => void;
  onDeactivate: (team: TeamSummary) => void;
}) {
  const { t } = useI18n();
  const store = useStore();

  return (
    <SectionCard
      title={t("teams.list.title")}
      description={t("teams.list.subtitle")}
      collapsible
      storageKey="teams.registry"
    >
      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("teams.list.empty")}</p>
      ) : (
        <div className="scroll-visible overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm" aria-label={t("teams.list.title")}>
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
                    {registry.activePeopleOf(team.id, store.professionals).length}
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
                      {canAdminister && (
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={t("teams.careerLadder.actionFor", { nome: team.name })}
                          onClick={() => onCareerLadder(team)}
                        >
                          {t("teams.careerLadder.action")}
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
      )}
    </SectionCard>
  );
}

function TeamTransitionsSection({ comparison }: { comparison: TeamTransitionsViewModel }) {
  const { t } = useI18n();
  const [period, setPeriod] = useState<CalendarPeriod>(() => comparison.defaultPeriod());
  const periodIsValid = comparison.periodIsValid(period);

  const transitionsQuery = useQuery({
    queryKey: comparison.queryKey(period),
    queryFn: () => teamTransitionsApi.compareTeamTransitions({ period }),
    staleTime: 60_000,
    enabled: periodIsValid,
  });

  return (
    <SectionCard
      title={t("teams.transitions.title")}
      description={t("teams.transitions.subtitle")}
      collapsible
      storageKey="teams.transitions"
    >
      <div className="mb-4 grid max-w-md gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="teams-transitions-from">{t("teams.transitions.from")}</Label>
          <Input
            id="teams-transitions-from"
            type="date"
            value={period.from}
            onChange={(event) => setPeriod({ ...period, from: event.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="teams-transitions-to">{t("teams.transitions.to")}</Label>
          <Input
            id="teams-transitions-to"
            type="date"
            value={period.to}
            onChange={(event) => setPeriod({ ...period, to: event.target.value })}
          />
        </div>
      </div>
      {periodIsValid ? (
        <QuerySection
          query={transitionsQuery}
          errorMessage={
            comparison.readingFailureOf(transitionsQuery.error) ?? t("teams.transitions.error")
          }
          skeleton={
            <p className="text-sm text-muted-foreground">{t("teams.transitions.loading")}</p>
          }
        >
          {(transitions) => (
            <TeamTransitionsTable transitions={transitions} comparison={comparison} />
          )}
        </QuerySection>
      ) : (
        <p className="text-sm text-destructive" role="alert">
          {t("teams.transitions.invalidPeriod")}
        </p>
      )}
    </SectionCard>
  );
}

function TeamTransitionsTable({
  transitions,
  comparison,
}: {
  transitions: TeamTransitions;
  comparison: TeamTransitionsViewModel;
}) {
  const { t, locale } = useI18n();
  const rows = comparison.ranked(transitions.teams);

  return (
    <>
      <DataOriginCallout origin={transitions.dataOrigin} className="mb-3" />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("teams.transitions.empty")}</p>
      ) : (
        <div className="scroll-visible overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm" aria-label={t("teams.transitions.title")}>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2">
                  {t("teams.transitions.col.team")}
                </th>
                <th scope="col" className="py-2 text-center">
                  {t("teams.transitions.col.transitions")}
                </th>
                <th scope="col" className="py-2 text-center">
                  {t("teams.transitions.col.pairs")}
                </th>
                <th scope="col" className="py-2 text-center">
                  {t("teams.transitions.col.averageDays")}
                </th>
                <th scope="col" className="py-2 text-center">
                  {t("teams.transitions.col.activePeople")}
                </th>
                <th scope="col" className="py-2 text-center">
                  {t("teams.transitions.col.rate")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <TeamTransitionsRowView
                  key={row.teamId}
                  row={row}
                  comparison={comparison}
                  locale={locale}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {transitions.withoutRecordedTeam !== null && (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("teams.transitions.withoutRecordedTeam", { n: transitions.withoutRecordedTeam })}
        </p>
      )}
    </>
  );
}

function TeamTransitionsRowView({
  row,
  comparison,
  locale,
}: {
  row: TeamTransitionsRow;
  comparison: TeamTransitionsViewModel;
  locale: string;
}) {
  const { t } = useI18n();
  const pairs = comparison.pairsOf(row);
  const averageDays = comparison.averageDaysOf(row, locale);
  const rate = comparison.rateOf(row, locale);

  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      {/* Dono (2026-09-06): só o Time à esquerda; o resto centralizado — "Arquitetura 0" não é um nome. */}
      <td className="py-2 pr-4 font-medium">{row.teamName}</td>
      <td className="py-2 text-center tabular-nums">{row.transitions}</td>
      <td className="py-2 text-center">
        {pairs.length === 0 ? (
          "—"
        ) : (
          <ul className="space-y-0.5">
            {pairs.map((pair) => (
              <li key={`${pair.fromRole}→${pair.toRole}`}>
                {t("teams.transitions.pair", {
                  de: pair.fromRole,
                  para: pair.toRole,
                  n: pair.transitions,
                })}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="py-2 text-center tabular-nums">
        {averageDays === null ? (
          "—"
        ) : (
          <>
            {t("teams.transitions.days", { n: averageDays })}
            <span className="ml-1 text-xs text-muted-foreground">
              ({t("teams.transitions.measured", { n: row.measuredOrigins, total: row.transitions })}
              )
            </span>
          </>
        )}
      </td>
      <td className="py-2 text-center tabular-nums">{row.activeProfessionals}</td>
      <td className="py-2 text-center tabular-nums">{rate ?? "—"}</td>
    </tr>
  );
}

function TeamRoster({
  team,
  teams,
  user,
  registry,
}: {
  team: TeamSummary;
  teams: readonly TeamSummary[];
  user: SessionUser;
  registry: TeamRegistryViewModel;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const canReadDirectory = registry.canReadAccountDirectory(user);

  const accountsQuery = useQuery({
    queryKey: ACCOUNTS_QUERY_KEY,
    queryFn: authApi.users,
    staleTime: 30_000,
    enabled: canReadDirectory,
  });
  const accounts = registry.linkableAccounts(accountsQuery.data ?? []);
  const reloadRoster = () =>
    queryClient.invalidateQueries({ queryKey: registry.rosterQueryKey(team.id) });

  /**
   * O quadro abre ABAIXO da lista de times — e a lista pode ser longa. Quem
   * clica em "Quadro" precisa ver o quadro: a tela rola até ele, e ele abre
   * ABERTO — o recolhimento não é lembrado entre visitas, porque uma vez
   * recolhido o botão passava a "não fazer nada" (dono, 2026-09-05).
   */
  const rosterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rosterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [team.id]);

  return (
    <div ref={rosterRef} className="scroll-mt-4">
      <SectionCard
        title={t("teams.roster.title", { nome: team.name })}
        description={t("teams.roster.subtitle")}
        collapsible
      >
        <div className="space-y-4">
          <TeamRosterRows team={team} user={user} registry={registry} onChanged={reloadRoster} />

          <TeamPeople
            team={team}
            teams={teams}
            registry={registry}
            canCompose={registry.canComposeTeam(user, team.id)}
          />
        </div>

        {canReadDirectory ? (
          <MembershipForm
            team={team}
            accounts={accounts}
            roles={registry.membershipRolesOfferedTo(user)}
            onChanged={reloadRoster}
          />
        ) : (
          <Callout tone="warning" className="mt-4">
            {t("teams.membership.directoryOnlyAdmin")}
          </Callout>
        )}
      </SectionCard>
    </div>
  );
}

function TeamRosterRows({
  team,
  user,
  registry,
  onChanged,
}: {
  team: TeamSummary;
  user: SessionUser;
  registry: TeamRegistryViewModel;
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const notifySuccess = useSuccessToast();
  const [releasing, setReleasing] = useState<TeamRosterMember | null>(null);
  const [reassigning, setReassigning] = useState<TeamRosterMember | null>(null);
  const { error, run } = useAsyncSubmit(t("teams.membership.error"));

  const rosterQuery = useQuery({
    queryKey: registry.rosterQueryKey(team.id),
    queryFn: () => teamRosterApi.rosterOf(team.id),
    staleTime: 30_000,
  });

  const release = async (member: TeamRosterMember) => {
    setReleasing(null);
    const result = await run(() =>
      teamsApi.releaseTeamMembership(team.id, member.userId, member.role),
    );
    if (!result.ok) return;
    await onChanged();
    notifySuccess("teams.membership.released");
  };

  const roleLabel = (role: TeamMemberRole) => t(`users.role.${role}`);

  const rows = () => {
    if (rosterQuery.isPending) {
      return <p className="text-sm text-muted-foreground">{t("teams.roster.rows.loading")}</p>;
    }
    if (rosterQuery.isError || rosterQuery.data === undefined) {
      return (
        <>
          <p className="text-sm text-destructive" role="alert">
            {registry.readingFailureOf(rosterQuery.error) ?? t("teams.roster.rows.error")}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => void rosterQuery.refetch()}
          >
            {t("common.retry")}
          </Button>
        </>
      );
    }
    const roster = rosterQuery.data;
    return (
      <>
        <DataOriginCallout origin={roster.dataOrigin} className="mb-3" />
        {roster.reading === "unavailable" ? (
          <Callout tone="warning">{t("teams.roster.rows.unavailable")}</Callout>
        ) : roster.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("teams.roster.rows.empty")}</p>
        ) : (
          <div className="scroll-visible overflow-x-auto">
            <table
              className="w-full min-w-[640px] text-sm"
              aria-label={t("teams.roster.rows.title")}
            >
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2">
                    {t("teams.roster.col.person")}
                  </th>
                  <th scope="col" className="py-2">
                    {t("teams.roster.col.email")}
                  </th>
                  <th scope="col" className="py-2">
                    {t("teams.roster.col.role")}
                  </th>
                  <th scope="col" className="py-2">
                    {t("teams.roster.col.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {roster.members.map((member) => (
                  <tr
                    key={`${member.userId}:${member.role}`}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-2 font-medium">{member.name}</td>
                    <td className="py-2 text-muted-foreground">{member.email}</td>
                    <td className="py-2">
                      <StatusBadge
                        tone={ROLE_BADGE_TONE[member.role]}
                        label={roleLabel(member.role)}
                      />
                    </td>
                    <td className="py-2">
                      {registry.canAlterBondWithRole(user, member.role) && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={t("teams.membership.reassignFor", { nome: member.name })}
                            onClick={() => setReassigning(member)}
                          >
                            {t("teams.membership.reassign")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={t("teams.membership.releaseFor", { nome: member.name })}
                            onClick={() => setReleasing(member)}
                          >
                            {t("teams.membership.release")}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  };

  return (
    <SectionCard title={t("teams.roster.rows.title")} description={t("teams.roster.rows.subtitle")}>
      {rows()}
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={releasing !== null}
        title={releasing && t("teams.membership.releaseConfirmTitle", { nome: releasing.name })}
        description={
          releasing &&
          t("teams.membership.releaseConfirmDescription", {
            nome: releasing.name,
            papel: roleLabel(releasing.role),
          })
        }
        confirmLabel={t("teams.membership.release")}
        onCancel={() => setReleasing(null)}
        onConfirm={() => releasing && void release(releasing)}
      />

      {reassigning && (
        <MembershipRoleDialog
          team={team}
          member={reassigning}
          roles={registry.rolesToMoveTo(user, reassigning.role)}
          onCancel={() => setReassigning(null)}
          onMoved={async (bond) => {
            await onChanged();
            notifySuccess("msg.team.membership.reassign.success", {}, bond);
            setReassigning(null);
          }}
        />
      )}
    </SectionCard>
  );
}

function MembershipRoleDialog({
  team,
  member,
  roles,
  onCancel,
  onMoved,
}: {
  team: TeamSummary;
  member: TeamRosterMember;
  roles: readonly TeamMemberRole[];
  onCancel: () => void;
  onMoved: (bond: unknown) => Promise<void>;
}) {
  const { t } = useI18n();
  const [role, setRole] = useState<TeamMemberRole | "">("");
  const { submitting, error, run } = useAsyncSubmit(t("teams.membership.error"));
  const roleLabel = (value: TeamMemberRole) => t(`users.role.${value}`);

  const move = () =>
    run(async () => {
      if (role === "") return;
      const bond = await teamsApi.reassignTeamMembershipRole(
        team.id,
        member.userId,
        member.role,
        role,
      );
      await onMoved(bond);
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("teams.membership.reassignFor", { nome: member.name })}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("teams.membership.reassignDescription", {
            nome: member.name,
            papel: roleLabel(member.role),
          })}
        </p>
        <div className="grid gap-3">
          <SingleSelectFilter
            id={`team-membership-move-${team.id}-${member.userId}`}
            label={t("teams.membership.newRole")}
            value={role}
            onChange={(value) => TeamMemberRoles.includes(value) && setRole(value)}
            options={[
              { value: "", label: t("teams.membership.chooseRole") },
              ...roles.map((option) => ({ value: option, label: roleLabel(option) })),
            ]}
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button disabled={role === "" || submitting} onClick={() => void move()}>
            {t("teams.membership.reassign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembershipForm({
  team,
  accounts,
  roles,
  onChanged,
}: {
  team: TeamSummary;
  accounts: readonly SessionUser[];
  roles: readonly TeamMemberRole[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useI18n();
  const notifySuccess = useSuccessToast();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<TeamMemberRole>(roles[0] ?? "member");
  const { submitting, error, run } = useAsyncSubmit(t("teams.membership.error"));

  const ready = userId !== "" && !submitting;

  const assign = async () => {
    const result = await run(() => teamsApi.assignTeamMembership(team.id, userId, role));
    if (!result.ok) return;
    await onChanged();
    setUserId("");
    notifySuccess("msg.team.membership.assign.success", {}, result.value);
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="font-display text-sm font-semibold">{t("teams.membership.title")}</p>
      <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
        {t("teams.membership.subtitle")}
      </p>
      {accounts.length === 0 ? (
        <div className="mt-3">
          <EmptyFieldInvite registration={Registration.PROFESSIONAL} />
        </div>
      ) : (
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
            onChange={(value) => TeamMemberRoles.includes(value) && setRole(value)}
            options={roles.map((option) => ({ value: option, label: t(`users.role.${option}`) }))}
            empty={{ message: t("teams.membership.role.empty") }}
          />
          <Button size="sm" disabled={!ready} onClick={() => void assign()}>
            {t("teams.membership.assign")}
          </Button>
        </div>
      )}
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function RegisterPersonPrompt({ message, to }: { message: string; to: "/users" | "/team" }) {
  const { t } = useI18n();
  return (
    <p className="text-sm text-muted-foreground">
      <span>{message}</span>{" "}
      <Link to={to} className="font-medium text-primary underline-offset-4 hover:underline">
        {t("teams.people.registerCta")}
      </Link>
    </p>
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

/**
 * O CADASTRO DO TIME (dono, 2026-09-08): nome e ESCADA DE CARREIRA no mesmo
 * formulário. *"Ao cadastrar/editar um time, quem administra escolhe quais dos
 * cinco níveis aquele time usa e em que ordem."*
 *
 * A escada nasce com o catálogo inteiro marcado — é o que o time tinha antes
 * desta fatia, e a decisão de encurtar é de quem administra, não um efeito de
 * o formulário abrir vazio.
 */
function TeamRegistrationDialog({
  onCancel,
  onSaved,
  reloadTeams,
}: {
  onCancel: () => void;
  onSaved: (team: TeamSummary) => void;
  reloadTeams: () => Promise<void>;
}) {
  const { t } = useI18n();
  const catalog = useCareerLevelsByRank();
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<TeamCareerLadderDraft | null>(null);
  const { submitting, error, run } = useAsyncSubmit(t("teams.create.error"));
  const ladder =
    draft ??
    TeamCareerLadderDraft.of(
      catalog,
      catalog.map((level) => level.id),
    );
  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && ladder.isValid && !submitting;

  const save = () =>
    run(async () => {
      const created = await teamsApi.registerTeam(trimmed, ladder.careerLevelIds);
      await reloadTeams();
      onSaved(created);
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("teams.create.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="team-name">{t("teams.name.label")}</Label>
            <Input
              id="team-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <TeamCareerLadderField
            id="team-career-ladder"
            draft={ladder}
            onChange={setDraft}
            disabled={submitting}
          />
          {error && (
            <p className="text-body text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {t("teams.name.cancel")}
          </Button>
          <Button disabled={!canSave} onClick={() => void save()}>
            {submitting ? t("teams.name.saving") : t("teams.name.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A ESCADA DE UM TIME QUE JÁ EXISTE. Encurtar não move ninguém: o serviço
 * recusa tirar um degrau que alguém ocupa (ou que já tem régua), e a recusa
 * chega aqui com os níveis nomeados.
 */
function TeamCareerLadderDialog({
  team,
  onCancel,
  onSaved,
}: {
  team: TeamSummary;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const notifySuccess = useSuccessToast();
  const catalog = useCareerLevelsByRank();
  const [draft, setDraft] = useState<TeamCareerLadderDraft | null>(null);
  const { submitting, error, run } = useAsyncSubmit(t("teams.careerLadder.error"));

  const ladderQuery = useQuery({
    queryKey: TeamCareerLevelsQuery.keyOf(team.id),
    queryFn: () => teamsApi.careerLadderOf(team.id),
  });
  const saved = ladderQuery.data?.levels.map((level) => level.id) ?? [];
  const ladder = draft ?? TeamCareerLadderDraft.of(catalog, saved);
  const canSave = ladder.isValid && ladder.differsFrom(saved) && !submitting;

  const save = () =>
    run(async () => {
      await teamsApi.defineCareerLadder(team.id, ladder.careerLevelIds);
      await queryClient.invalidateQueries({ queryKey: TeamCareerLevelsQuery.keyOf(team.id) });
      notifySuccess("msg.team.careerLadder.define.success", { nome: team.name });
      onSaved();
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("teams.careerLadder.title", { nome: team.name })}</DialogTitle>
        </DialogHeader>
        <QuerySection
          query={ladderQuery}
          errorMessage={t("teams.careerLadder.load.error")}
          skeleton={
            <p className="text-body text-muted-foreground">{t("teams.careerLadder.loading")}</p>
          }
        >
          {(loaded) => (
            <div className="grid gap-3">
              {!loaded.declared && (
                <Callout tone="info">{t("teams.careerLadder.undeclared")}</Callout>
              )}
              <TeamCareerLadderField
                id={`team-career-ladder-${team.id}`}
                draft={ladder}
                onChange={setDraft}
                disabled={submitting}
              />
              {error && (
                <p className="text-body text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
        </QuerySection>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {t("teams.name.cancel")}
          </Button>
          <Button disabled={!canSave} onClick={() => void save()}>
            {submitting ? t("teams.name.saving") : t("teams.name.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamPeople({
  team,
  teams,
  registry,
  canCompose,
}: {
  team: TeamSummary;
  teams: readonly TeamSummary[];
  registry: TeamRegistryViewModel;
  canCompose: boolean;
}) {
  const { t } = useI18n();
  const store = useStore();
  const notifySuccess = useSuccessToast();
  const [allocating, setAllocating] = useState(false);
  const [releasing, setReleasing] = useState<Professional | null>(null);
  const { error, run } = useAsyncSubmit(
    (failure) => registry.allocationRefusalOf(failure) ?? t("teams.people.error"),
  );
  const people = registry.activePeopleOf(team.id, store.professionals);

  const release = async (person: Professional) => {
    setReleasing(null);
    const result = await run(() => store.releaseProfessionalFromTeam(person.id));
    if (!result.ok) return;
    notifySuccess(
      "msg.people.release.success",
      { nome: person.name, time: team.name },
      result.value,
    );
  };

  return (
    <SectionCard
      title={t("teams.roster.people.title")}
      description={t("teams.roster.people.subtitle")}
      actions={
        canCompose && (
          <SectionAction label={t("teams.people.allocate")} onClick={() => setAllocating(true)} />
        )
      }
    >
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("teams.roster.people.empty")}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {people.map((person) => (
            <li key={person.id} className="flex items-center justify-between gap-2">
              <span className="font-medium">{person.name}</span>
              <span className="flex items-center gap-3">
                <Seniority role={person.role} className="text-muted-foreground" />
                {canCompose && (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={t("teams.people.releaseFor", { nome: person.name })}
                    onClick={() => setReleasing(person)}
                  >
                    {t("teams.people.release")}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={releasing !== null}
        title={releasing && t("teams.people.releaseConfirmTitle", { nome: releasing.name })}
        description={
          releasing && t("teams.people.releaseConfirmDescription", { nome: releasing.name })
        }
        confirmLabel={t("teams.people.release")}
        onCancel={() => setReleasing(null)}
        onConfirm={() => releasing && void release(releasing)}
      />

      {allocating && (
        <AllocatePersonDialog
          team={team}
          candidates={registry.allocatableTo(team.id, store.professionals)}
          teams={teams}
          registry={registry}
          onCancel={() => setAllocating(false)}
          onAllocated={(person, allocated) => {
            notifySuccess(
              "msg.people.allocate.success",
              { nome: person.name, time: team.name },
              allocated,
            );
            setAllocating(false);
          }}
        />
      )}
    </SectionCard>
  );
}

function AllocatePersonDialog({
  team,
  candidates,
  teams,
  registry,
  onCancel,
  onAllocated,
}: {
  team: TeamSummary;
  candidates: readonly Professional[];
  teams: readonly TeamSummary[];
  registry: TeamRegistryViewModel;
  onCancel: () => void;
  onAllocated: (person: Professional, allocated: Professional) => void;
}) {
  const { t } = useI18n();
  const store = useStore();
  const [professionalId, setProfessionalId] = useState("");
  const [reason, setReason] = useState("");
  const { submitting, error, run } = useAsyncSubmit(
    (failure) => registry.allocationRefusalOf(failure) ?? t("teams.people.error"),
  );
  const chosen = candidates.find((candidate) => candidate.id === professionalId);
  const justified = reason.trim() !== "";

  const allocate = async () => {
    if (!chosen || !justified) return;
    const result = await run(() =>
      store.allocateProfessionalToTeam(chosen.id, team.id, reason.trim()),
    );
    if (result.ok) onAllocated(chosen, result.value);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("teams.people.allocateTitle", { nome: team.name })}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("teams.people.allocateDescription")}</p>
        <div className="grid gap-3">
          {candidates.length === 0 ? (
            <RegisterPersonPrompt message={t("teams.people.nobodyToAllocate")} to="/team" />
          ) : (
            <>
              <SingleSelectFilter
                id={`team-allocate-${team.id}`}
                label={t("teams.people.person")}
                value={professionalId}
                onChange={setProfessionalId}
                options={[
                  { value: "", label: t("teams.people.choosePerson") },
                  ...candidates.map((candidate) => ({
                    value: candidate.id,
                    label: t("teams.people.candidate", {
                      nome: candidate.name,
                      time:
                        registry.teamNameOf(candidate.teamId, teams) ?? t("teams.people.noTeam"),
                    }),
                  })),
                ]}
              />
              <div>
                <Label htmlFor={`team-allocate-reason-${team.id}`}>
                  {t("teams.people.reasonLabel")}
                </Label>
                <Textarea
                  id={`team-allocate-reason-${team.id}`}
                  className="mt-1"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t("teams.people.reasonPlaceholder")}
                />
              </div>
            </>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!chosen || !justified || submitting} onClick={() => void allocate()}>
            {t("teams.people.confirmAllocate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
