import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
  Callout,
  EmptyState,
  LevelBadge,
  MultiSelectFilter,
  PageHeader,
  QuerySection,
  SectionCard,
  SingleSelectFilter,
} from "@/components/app";
import { FilterField } from "@/components/app/FilterField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAsyncSubmit, useSuccessToast, useTeamRuleEditorViewModel } from "@/hooks";
import { ApiError, api, teamsApi } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import type { CareerLevel } from "@/lib/domain";
import type { TeamRuleView } from "@/lib/gateways/career.gateway";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { requireLeadReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useCareerLevelsByRank, useOperationalSettings, useStore } from "@/lib/store";

export const Route = createFileRoute("/team-rules")({
  beforeLoad: requireLeadReach,
  head: () => ({
    meta: [
      { title: "Régua do time — Synapse" },
      {
        name: "description",
        content:
          "Para cada time e nível de carreira: capacidades exigidas, competências da régua e nível mínimo de cada uma.",
      },
    ],
  }),
  component: TeamRulesPage,
});

const LEVEL_OPTIONS = [1, 2, 3, 4, 5];

function TeamRulesPage() {
  const { t } = useI18n();
  const help = usePageHelp("teamRules");
  const user = useCurrentUser();
  const canConfigure = defaultUiAuthorizationPolicy.canConfigureAnyTeamRules(user);

  const careerLevels = useCareerLevelsByRank();
  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: teamsApi.teams,
    staleTime: 60_000,
    enabled: canConfigure,
  });

  const [chosenTeamId, setChosenTeamId] = useState<string | null>(null);
  const [chosenLevelId, setChosenLevelId] = useState<string | null>(null);

  if (!canConfigure) {
    return (
      <>
        <PageHeader
          title={t("teamRules.title")}
          description={t("teamRules.description")}
          help={help}
        />
        <EmptyState title={t("teamRules.leadOnly")} hint={t("teamRules.leadOnlyHint")} />
      </>
    );
  }

  const teams = (teamsQuery.data ?? []).filter(
    (team) => team.active && defaultUiAuthorizationPolicy.canConfigureRulesOf(user, team.id),
  );
  const teamId = teams.some((team) => team.id === chosenTeamId)
    ? chosenTeamId
    : (teams[0]?.id ?? null);
  const careerLevel =
    careerLevels.find((level) => level.id === chosenLevelId) ?? careerLevels[0] ?? null;

  return (
    <>
      <PageHeader
        title={t("teamRules.title")}
        description={t("teamRules.description")}
        help={help}
      />

      {teamId === null || careerLevel === null ? (
        <EmptyState title={t("teamRules.noTeam")} />
      ) : (
        <>
          <div className="mb-6 grid max-w-xl gap-4 sm:grid-cols-2">
            <SingleSelectFilter
              id="team-rule-team"
              label={t("teamRules.filter.team")}
              value={teamId}
              onChange={setChosenTeamId}
              options={teams.map((team) => ({ value: team.id, label: team.name }))}
            />
            <SingleSelectFilter
              id="team-rule-career-level"
              label={t("teamRules.filter.careerLevel")}
              value={careerLevel.id}
              onChange={setChosenLevelId}
              options={careerLevels.map((level) => ({ value: level.id, label: level.name }))}
            />
          </div>

          <TeamRuleSection
            key={`${teamId}:${careerLevel.id}`}
            teamId={teamId}
            level={careerLevel}
          />
        </>
      )}
    </>
  );
}

function TeamRuleSection({ teamId, level }: { teamId: string; level: CareerLevel }) {
  const { t } = useI18n();
  const [generation, setGeneration] = useState(0);

  const query = useQuery({
    queryKey: ["team-rule", teamId, level.id],
    queryFn: async () => {
      try {
        return await api.teamRule(teamId, level.id);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    retry: false,
  });

  return (
    <QuerySection
      query={query}
      errorMessage={t("teamRules.error.load")}
      skeleton={<p className="text-sm text-muted-foreground">{t("teamRules.loading")}</p>}
    >
      {(rule) => (
        <TeamRuleEditor
          key={generation}
          teamId={teamId}
          level={level}
          rule={rule}
          onServerChanged={() => setGeneration((previous) => previous + 1)}
        />
      )}
    </QuerySection>
  );
}

function TeamRuleEditor({
  teamId,
  level,
  rule,
  onServerChanged,
}: {
  teamId: string;
  level: CareerLevel;
  rule: TeamRuleView | null;
  onServerChanged: () => void;
}) {
  const { t } = useI18n();
  const store = useStore();
  const queryClient = useQueryClient();
  const notifySuccess = useSuccessToast();
  const floor = useOperationalSettings().careerMinimumQualifiedFloor;
  const { editor, setEditor } = useTeamRuleEditorViewModel(rule);
  const [drafting, setDrafting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const { submitting, error, run } = useAsyncSubmit(t("teamRules.save.error"));

  const capabilities = store.capabilities.filter((capability) => capability.active);
  const chosenCapabilities = capabilities.filter((capability) =>
    editor.capabilityIds.includes(capability.id),
  );
  const competencies = store.competencies.filter(
    (competency) => competency.active && editor.capabilityIds.includes(competency.capabilityId),
  );

  if (!editor.hasRule && !drafting) {
    return (
      <EmptyState
        title={t("teamRules.empty.title", { nivel: level.name })}
        hint={t("teamRules.empty.hint", { piso: floor })}
        action={
          <Button size="sm" className="mt-4" onClick={() => setDrafting(true)}>
            {t("teamRules.empty.action")}
          </Button>
        }
      />
    );
  }

  const save = async () => {
    const definition = editor.definition();
    if (!definition) return;
    setConflict(false);
    const result = await run(async () => {
      const saved = await api.defineTeamRule(teamId, level.id, definition);
      await queryClient.invalidateQueries({ queryKey: ["team-rule", teamId, level.id] });
      return saved;
    });
    if (result.ok) {
      notifySuccess("msg.career.teamRule.define.success", { nome: level.name }, result.value);
      onServerChanged();
      return;
    }
    if (result.error instanceof ApiError && result.error.status === 409) setConflict(true);
  };

  return (
    <div className="space-y-6">
      {conflict && (
        <Callout tone="warning">
          <p>{t("teamRules.conflict")}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={onServerChanged}>
            {t("teamRules.reload")}
          </Button>
        </Callout>
      )}

      <SectionCard
        title={t("teamRules.capabilities.title")}
        description={t("teamRules.capabilities.subtitle")}
      >
        <div className="grid max-w-xl items-start gap-4 sm:grid-cols-2">
          <MultiSelectFilter
            id="team-rule-capabilities"
            label={t("teamRules.capabilities.label")}
            options={capabilities.map((capability) => ({
              id: capability.id,
              label: capability.name,
            }))}
            selected={[...editor.capabilityIds]}
            onChange={(ids) =>
              setEditor((current) =>
                capabilities.reduce(
                  (draft, capability) =>
                    draft.withCapability(capability.id, ids.includes(capability.id)),
                  current,
                ),
              )
            }
            selectAllLabel={t("teamRules.capabilities.selectAll")}
            allSummaryLabel={t("teamRules.capabilities.all")}
            noneSummaryLabel={t("teamRules.capabilities.none")}
          />

          <FilterField label={t("teamRules.minimum.label")} htmlFor="team-rule-minimum">
            <Input
              id="team-rule-minimum"
              type="number"
              min={floor}
              className="h-9 w-28"
              value={String(editor.minimumQualifiedCapabilities)}
              onChange={(event) =>
                setEditor((current) => current.withMinimum(Number(event.target.value)))
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("teamRules.minimum.hint", { piso: floor })}
            </p>
          </FilterField>
        </div>

        {chosenCapabilities.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {chosenCapabilities.map((capability) => (
              <li
                key={capability.id}
                className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 text-sm"
              >
                <span>{capability.name}</span>
                {capability.curation.status === "REQUIRES_CURATION" && (
                  <Badge variant="outline">{t("teamRules.capability.requiresCuration")}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}

        {chosenCapabilities.some(
          (capability) => capability.curation.status === "REQUIRES_CURATION",
        ) && (
          <Callout tone="warning" className="mt-3">
            {t("teamRules.capability.curationNotice")}
          </Callout>
        )}
      </SectionCard>

      <SectionCard
        title={t("teamRules.competencies.title")}
        description={t("teamRules.competencies.subtitle")}
      >
        {competencies.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("teamRules.competencies.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2">
                    {t("teamRules.col.competency")}
                  </th>
                  <th scope="col" className="py-2">
                    {t("teamRules.col.inRule")}
                  </th>
                  <th scope="col" className="py-2">
                    {t("teamRules.col.level")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {competencies.map((competency) => {
                  const inRule = editor.competencies.find(
                    (entry) => entry.competencyId === competency.id,
                  );
                  return (
                    <tr
                      key={competency.id}
                      className="border-b border-border/60 align-top last:border-0"
                    >
                      <td className="py-2 font-medium">{competency.name}</td>
                      <td className="py-2">
                        <SingleSelectFilter
                          id={`team-rule-membership-${competency.id}`}
                          ariaLabel={`${t("teamRules.col.inRule")} — ${competency.name}`}
                          value={inRule ? "in" : ""}
                          onChange={(value) =>
                            setEditor((current) =>
                              value === "in"
                                ? current.withCompetencyInRule(
                                    competency.id,
                                    inRule?.requiredLevel ?? 1,
                                  )
                                : current.withoutCompetency(competency.id),
                            )
                          }
                          options={[
                            { value: "", label: t("teamRules.membership.out") },
                            { value: "in", label: t("teamRules.membership.in") },
                          ]}
                          triggerClassName="min-w-40"
                        />
                      </td>
                      <td className="py-2">
                        {inRule ? (
                          <div className="flex items-center gap-2">
                            <SingleSelectFilter
                              id={`team-rule-level-${competency.id}`}
                              ariaLabel={`${t("teamRules.col.level")} — ${competency.name}`}
                              value={String(inRule.requiredLevel)}
                              onChange={(value) =>
                                setEditor((current) =>
                                  current.withRequiredLevel(competency.id, Number(value)),
                                )
                              }
                              options={LEVEL_OPTIONS.map((option) => ({
                                value: String(option),
                                label: t("teamRules.level.option", { n: option }),
                              }))}
                              triggerClassName="min-w-24"
                            />
                            <LevelBadge level={inRule.requiredLevel} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-sm font-medium tabular-nums">
            {editor.competencyCount === 1
              ? t("teamRules.footer.countOne")
              : t("teamRules.footer.count", { n: editor.competencyCount })}
          </p>
          <Button
            size="sm"
            disabled={!editor.isValid || !editor.isDirty || submitting}
            onClick={() => void save()}
          >
            {submitting ? t("teamRules.saving") : t("teamRules.save")}
          </Button>
        </div>

        {editor.errorKeys.map((key) => (
          <p key={key} className="mt-2 text-sm text-destructive" role="alert">
            {t(key, { minimo: floor })}
          </p>
        ))}
        {error && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </SectionCard>
    </div>
  );
}
