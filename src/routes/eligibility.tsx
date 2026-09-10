import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import {
  ProgressionCriteriaRefusal,
  ProgressionCriteriaScreen,
  TeamChoiceField,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useAsyncSubmit, useSuccessToast } from "@/hooks";
import { teamsApi } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest } from "@/lib/context-scope";
import type { CareerLevel } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";
import {
  ProgressionMinimumPresenter,
  ProgressionPolicyScope,
  QualifiedCapabilityMinimum,
  ReadyCompetencyShortfall,
} from "@/lib/presenters";
import { requireLeadReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useCareerLevelsByRank, useOperationalSettings, useStore } from "@/lib/store";
import { TeamChoice } from "@/lib/team-choice";

/**
 * ELEGIBILIDADE — a primeira das seis fatias do grupo Critérios de Progressão
 * (dono, 2026-09-10). Era o primeiro cartão da tela de 1390 linhas.
 *
 * O DONO DESTA FATIA é quem rege a régua do time: gerente ou tech lead COM
 * VÍNCULO, e quem opera o sistema (que alcança todos os times). É o mesmo
 * alcance de Perfil de Competências do Time — e é o conserto do achado (C) do
 * inventário de alcance de 2026-09-05: a tela única era de LIDERANÇA, o que
 * fazia o tech lead sem vínculo entrar e encontrar uma tabela que ele não
 * pode mexer, sem saber se era falta de permissão ou falta de configuração.
 */
export const Route = createFileRoute("/eligibility")({
  head: () => ({
    meta: [
      { title: "Elegibilidade — Synapse" },
      {
        name: "description",
        content:
          "Mínimo de capacidades qualificadas para elegibilidade a cada nível de carreira do time.",
      },
      { property: "og:title", content: "Elegibilidade — Synapse" },
      {
        property: "og:description",
        content: "A régua de elegibilidade por nível de carreira.",
      },
    ],
  }),
  beforeLoad: requireLeadReach,
  component: EligibilityPage,
});

const ELIGIBILITY_CONTEXTS: readonly ContextScopeRequest[] = ["capabilities", "teamLevelRules"];

function EligibilityPage() {
  const { t } = useI18n();
  const user = useCurrentUser();
  const canConfigure = defaultUiAuthorizationPolicy.canConfigureAnyTeamRules(user);

  if (!canConfigure) {
    return (
      <ProgressionCriteriaRefusal
        slice="eligibility"
        title={t("eligibility.title")}
        reason={t("eligibility.leadOnly")}
        hint={t("eligibility.leadOnlyHint")}
      />
    );
  }

  return (
    <ContextScope contexts={ELIGIBILITY_CONTEXTS}>
      <EligibilityScreen />
    </ContextScope>
  );
}

function EligibilityScreen() {
  const { t } = useI18n();
  return (
    <ProgressionCriteriaScreen
      slice="eligibility"
      title={t("eligibility.title")}
      description={t("policy.subtitle")}
    >
      <CareerPolicySection />
    </ProgressionCriteriaScreen>
  );
}

function CareerPolicySection() {
  const store = useStore();
  const readyCapabilities = store.capabilities.filter(
    (capacidade) => capacidade.curation.status === "READY",
  ).length;

  const floor = useOperationalSettings().careerMinimumQualifiedFloor;
  const { t } = useI18n();
  const user = useCurrentUser();
  const canChooseTeam = defaultUiAuthorizationPolicy.canConfigureAnyTeamRules(user);
  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: teamsApi.teams,
    staleTime: 60_000,
    enabled: canChooseTeam,
  });
  const [chosenTeam, setChosenTeam] = useState(ProgressionPolicyScope.ALL_TEAMS_CHOICE);
  const teams = ProgressionPolicyScope.choosable(teamsQuery.data ?? [], (teamId) =>
    defaultUiAuthorizationPolicy.canConfigureRulesOf(user, teamId),
  );
  // Dono (2026-09-06): quem lidera UM time não escolhe — a política mostrada é
  // a dele, e o seletor fica fixado nele, sem "Todos os times".
  const teamChoice = TeamChoice.for(user, teams);
  const scope = ProgressionPolicyScope.fromChoice(
    teamChoice.resolve(chosenTeam, ProgressionPolicyScope.ALL_TEAMS_CHOICE) ??
      ProgressionPolicyScope.ALL_TEAMS_CHOICE,
    teams,
  );
  // REGRA 19 (dono, 2026-09-09): todo time tem os cinco níveis, então as
  // linhas são sempre o catálogo da organização — com um time escolhido ou em
  // "Todos os times", a lista de níveis é a mesma.
  const careerLevels = useCareerLevelsByRank();

  return (
    <>
      {teams.length > 0 && (
        <div className="mb-4 max-w-xs">
          <TeamChoiceField
            id="policy-team"
            label={t("policy.team")}
            choice={teamChoice}
            value={scope.choice}
            onChange={setChosenTeam}
            emptyOption={{
              value: ProgressionPolicyScope.ALL_TEAMS_CHOICE,
              label: t("policy.team.all"),
            }}
            lockedExplanation={t("policy.team.locked")}
          />
        </div>
      )}
      <div className="scroll-visible overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2">
                {t("policy.col.careerLevel")}
              </th>
              <th scope="col" className="py-2 text-center">
                {t("policy.col.minimumQualified")}
              </th>
              {teams.length > 0 && <th scope="col" className="py-2" />}
            </tr>
          </thead>
          <tbody>
            {careerLevels.map((level) => (
              <CareerPolicyRow
                key={`${scope.choice}:${level.id}`}
                level={level}
                minimum={ProgressionMinimumPresenter.forCareerLevel(
                  store.teamLevelRules,
                  level.id,
                  scope,
                )}
                floor={floor}
                readyCapabilities={readyCapabilities}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CareerPolicyRow({
  level,
  minimum,
  floor,
  readyCapabilities,
}: {
  level: CareerLevel;
  minimum: ProgressionMinimumPresenter;
  floor: number;
  readyCapabilities: number;
}) {
  const editableTeamId = minimum.editableTeamId;
  const store = useStore();
  const { t } = useI18n();
  // Revisão de papéis (2026-09-05): a régua é de quem lidera o time com
  // vínculo; o administrador a lê.
  const user = useCurrentUser();
  const configuresSomeTeam = defaultUiAuthorizationPolicy.canConfigureAnyTeamRules(user);
  const canEdit =
    typeof editableTeamId === "string" &&
    defaultUiAuthorizationPolicy.canConfigureRulesOf(user, editableTeamId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(minimum.agreedMinimum ?? floor));

  const {
    submitting: saving,
    error,
    clearError,
    run,
  } = useAsyncSubmit("Não foi possível salvar a política.");
  const notifySuccess = useSuccessToast();

  const draftValue = Number(draft);
  const shortfall = editing
    ? ReadyCompetencyShortfall.between(draftValue, readyCapabilities)
    : minimum.shortfall(readyCapabilities);
  const canSave = QualifiedCapabilityMinimum.admits(draftValue) && !shortfall.blocksSaving;

  const save = async () => {
    if (!canSave || editableTeamId === undefined) return;
    const result = await run(() =>
      store.defineTeamRuleMinimum(editableTeamId, level.id, draftValue),
    );
    if (result.ok) {
      notifySuccess("msg.career.teamRule.define.success", { nome: level.name }, result.value);
      setEditing(false);
    }
  };

  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <td className="py-2">
        <p className="font-medium">{level.name}</p>
        <p className="text-xs text-muted-foreground">
          <CareerPolicyHint level={level} minimum={minimum} />
        </p>
        <ReadyCompetencyShortfallNotice shortfall={shortfall} />
      </td>
      <td className="py-2 text-center">
        {editing ? (
          <input
            type="number"
            min={QualifiedCapabilityMinimum.FLOOR}
            step={1}
            disabled={saving}
            className="w-20 rounded-md border border-input bg-card px-2 py-1 text-center text-sm tabular-nums"
            value={draft}
            onChange={(evento) => setDraft(evento.target.value)}
          />
        ) : (
          <CareerPolicyMinimumCell minimum={minimum} />
        )}
        {error && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </td>
      {configuresSomeTeam && (
        <td className="py-2 text-right">
          {editing ? (
            <div className="flex justify-end gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setDraft(String(minimum.agreedMinimum ?? floor));
                  clearError();
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button size="sm" disabled={!canSave || saving} onClick={() => void save()}>
                {saving ? t("team.transition.submitting") : t("common.save")}
              </Button>
            </div>
          ) : (
            <>
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  {t("common.edit")}
                </Button>
              )}
              {!canEdit && (
                <p className="text-xs text-muted-foreground">{t("policy.row.perTeamRule")}</p>
              )}
            </>
          )}
        </td>
      )}
    </tr>
  );
}

function ReadyCompetencyShortfallNotice({ shortfall }: { shortfall: ReadyCompetencyShortfall }) {
  const { t } = useI18n();
  if (!shortfall.blocksSaving) return null;
  return (
    <p className="mt-1 text-xs" role="alert">
      <Link
        to="/competency-matrix"
        className="font-medium text-destructive underline underline-offset-2 hover:text-destructive/80"
      >
        {t(shortfall.messageKey, { n: shortfall.missing })}
      </Link>
    </p>
  );
}

const NO_TEAM_RULE_MARK = "—";

function CareerPolicyHint({
  level,
  minimum,
}: {
  level: CareerLevel;
  minimum: ProgressionMinimumPresenter;
}) {
  const { t } = useI18n();
  const reading = minimum.reading;

  if (reading.kind === "absent") {
    return minimum.team ? (
      <>{t("policy.row.hint.absentForTeam", { time: minimum.team.name, nivel: level.name })}</>
    ) : (
      <>{t("policy.row.hint.absent", { nivel: level.name })}</>
    );
  }
  if (reading.kind === "divergent") {
    return (
      <>
        {t("policy.row.hint.varies", {
          nivel: level.name,
          menor: reading.lowest,
          maior: reading.highest,
        })}
      </>
    );
  }
  // Dono (2026-09-08): zero é valor válido, e a frase precisa dizer isso sem
  // parecer régua faltando — "—" é régua ausente, zero é régua que não exige
  // capacidade qualificada nenhuma.
  if (QualifiedCapabilityMinimum.demandsNothing(reading.minimum)) {
    return <>{t("policy.row.hint.none", { nivel: level.name })}</>;
  }
  return <>{t("policy.row.hint", { nivel: level.name, minimo: reading.minimum })}</>;
}

function CareerPolicyMinimumCell({ minimum }: { minimum: ProgressionMinimumPresenter }) {
  const { t } = useI18n();
  const reading = minimum.reading;

  if (reading.kind === "absent") return <span className="tabular-nums">{NO_TEAM_RULE_MARK}</span>;
  if (reading.kind === "divergent") {
    return (
      <>
        <span className="tabular-nums">{reading.listed}</span>
        <p className="text-xs font-normal text-muted-foreground">{t("policy.row.variesByTeam")}</p>
      </>
    );
  }
  if (QualifiedCapabilityMinimum.demandsNothing(reading.minimum)) {
    return <span>{t("policy.row.noMinimum")}</span>;
  }
  return <span className="tabular-nums">{reading.minimum}</span>;
}
