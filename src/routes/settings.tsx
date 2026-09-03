import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  gapTone,
  LevelBadge,
  OutOfReachScreen,
  PageHeader,
  SectionCard,
  SectionGroup,
  SectionHelp,
  SingleSelectFilter,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useAsyncSubmit, useSuccessToast } from "@/hooks";
import { teamsApi } from "@/lib/api";
import { LEVELS, type CareerLevel } from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
import { useLabels } from "@/lib/labels";
import {
  ProgressionMinimumPresenter,
  ProgressionPolicyScope,
  ReadyCompetencyShortfall,
} from "@/lib/presenters";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { requireLeadershipReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import {
  SCORING_SCALES,
  ScoringBandSet,
  type BandTone,
  type ScoringBand,
  type ScoringScale,
} from "@/lib/scoring-bands";
import {
  useCareerLevelsByRank,
  useCurationPolicy,
  useOperationalSettings,
  useScoringRuler,
  useStore,
  useTextTemplates,
  useVocabularies,
  useVocabulary,
} from "@/lib/store";
import { VOCABULARY_NAMES, type VocabularyItem, type VocabularyName } from "@/lib/vocabularies";
import {
  CURATION_POLICY_FIELDS,
  CurationPolicyEditor,
  NewVocabularyCodeEditor,
  OPERATIONAL_FIELD_MINIMUM,
  OPERATIONAL_NUMBER_FIELDS,
  OperationalSettingsEditor,
  ScoringBandsEditor,
  TextTemplateEditor,
  type CurationPolicyField,
  type OperationalNumberField,
  VocabularyItemEditor,
} from "@/lib/view-models";
import { defaultDateFormatter } from "@/lib/text";
import {
  TextTemplate,
  TEXT_TEMPLATE_KEYS,
  TEXT_TEMPLATE_VARIABLES,
  type TextTemplateKey,
} from "@/lib/text-templates";
import { cn } from "@/lib/utils";
import { CYCLE_CADENCES, type CycleCadence } from "@/lib/operational-settings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Política de Progressão — Synapse" },
      {
        name: "description",
        content:
          "A régua da progressão: mínimo de capacidades qualificadas, faixas, textos, catálogo e vocabulários.",
      },
      { property: "og:title", content: "Política de Progressão — Synapse" },
      {
        property: "og:description",
        content: "Configuração e glossário do modelo de desenvolvimento técnico.",
      },
    ],
  }),
  beforeLoad: requireLeadershipReach,
  component: SettingsPage,
});

function SettingsPage() {
  const store = useStore();
  const labels = useLabels();
  const { t, locale } = useI18n();
  const help = usePageHelp("settings");
  const user = useCurrentUser();
  const isAdmin = user.role === "admin";
  const isLeadership = defaultUiAuthorizationPolicy.isLeadership(user);

  if (!isLeadership) {
    return (
      <OutOfReachScreen
        title={t("ref.title")}
        help={help}
        reason={t("ref.leadershipOnly")}
        hint={t("ref.leadershipOnlyHint")}
      />
    );
  }

  return (
    <>
      <PageHeader title={t("ref.title")} description={t("ref.subtitle")} help={help} />

      <SectionGroup title={t("ref.configSectionTitle")}>
        <div className="grid gap-6 xl:grid-cols-2">
          <CareerPolicySection isAdmin={isAdmin} />
          {isAdmin && <ScoringBandsSection />}
          {isAdmin && <TextTemplatesSection />}
          {isAdmin && <CurationPolicySection />}
          {isAdmin && <OperationalSettingsSection />}
          {isAdmin && <VocabulariesSection />}
        </div>
      </SectionGroup>

      <SectionGroup className="mt-8" title={t("ref.referenceSectionTitle")}>
        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard
            title={t("ref.scale")}
            description={t("ref.scale.subtitle")}
            help={<SectionHelp section="scale" />}
          >
            <ul className="space-y-2">
              {LEVELS.map((l) => (
                <li key={l.level} className="flex items-start gap-3 surface-inset p-3">
                  <LevelBadge level={l.level} showName />
                  <p className="text-sm text-muted-foreground">
                    {labels.levelDescription[l.level]}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title={t("ref.cycles")}
            description={t("ref.cycles.subtitle")}
            help={<SectionHelp section="cycles" />}
          >
            <ul className="space-y-2">
              {store.cycles.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between surface-inset p-3 text-sm"
                >
                  <span>
                    <strong>{c.name}</strong>{" "}
                    <span className="text-muted-foreground">
                      {defaultDateFormatter.formatDate(c.start, locale)} →{" "}
                      {defaultDateFormatter.formatDate(c.end, locale)}
                    </span>
                  </span>
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                    {labels.cycleStatus[c.status]}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </SectionGroup>
    </>
  );
}

function CareerPolicySection({ isAdmin }: { isAdmin: boolean }) {
  const store = useStore();
  const careerLevels = useCareerLevelsByRank();
  const readyCapabilities = store.capabilities.filter((c) => c.curation.status === "READY").length;

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
  const [teamChoice, setTeamChoice] = useState(ProgressionPolicyScope.ALL_TEAMS_CHOICE);
  const teams = ProgressionPolicyScope.choosable(teamsQuery.data ?? [], (teamId) =>
    defaultUiAuthorizationPolicy.canConfigureRulesOf(user, teamId),
  );
  const scope = ProgressionPolicyScope.fromChoice(teamChoice, teams);

  return (
    <SectionCard
      title={t("policy.title")}
      description={t("policy.subtitle")}
      help={<SectionHelp section="policy" />}
    >
      {teams.length > 0 && (
        <div className="mb-4 max-w-xs">
          <SingleSelectFilter
            id="policy-team"
            label={t("policy.team")}
            value={scope.choice}
            onChange={setTeamChoice}
            options={[
              { value: ProgressionPolicyScope.ALL_TEAMS_CHOICE, label: t("policy.team.all") },
              ...teams.map((team) => ({ value: team.id, label: team.name })),
            ]}
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2">
                {t("policy.col.careerLevel")}
              </th>
              <th scope="col" className="py-2 text-center">
                {t("policy.col.minimumQualified")}
              </th>
              {isAdmin && <th scope="col" className="py-2" />}
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
                isAdmin={isAdmin}
              />
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function CareerPolicyRow({
  level,
  minimum,
  floor,
  readyCapabilities,
  isAdmin,
}: {
  level: CareerLevel;
  minimum: ProgressionMinimumPresenter;
  floor: number;
  readyCapabilities: number;
  isAdmin: boolean;
}) {
  const editableTeamId = minimum.editableTeamId;
  const store = useStore();
  const { t } = useI18n();
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
  const canSave = Number.isInteger(draftValue) && draftValue >= floor && !shortfall.blocksSaving;

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
            min={floor}
            step={1}
            disabled={saving}
            className="w-20 rounded-md border border-input bg-card px-2 py-1 text-center text-sm tabular-nums"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
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
      {isAdmin && (
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
              {editableTeamId !== undefined && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  {t("common.edit")}
                </Button>
              )}
              {editableTeamId === undefined && (
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
  return <span className="tabular-nums">{reading.minimum}</span>;
}

const SCALE_TITLE_KEY: Record<ScoringScale, MessageKey> = {
  GAP_SEVERITY: "config.bands.scale.GAP_SEVERITY",
  PROFICIENCY: "config.bands.scale.PROFICIENCY",
  CONCENTRATION_RISK: "config.bands.scale.CONCENTRATION_RISK",
};

const TONE_LABEL_KEY: Record<BandTone, MessageKey> = {
  ok: "config.bands.tone.ok",
  low: "config.bands.tone.low",
  high: "config.bands.tone.high",
  critical: "config.bands.tone.critical",
};

const SCALE_SAMPLE: Record<ScoringScale, string> = {
  GAP_SEVERITY: "2",
  PROFICIENCY: "3",
  CONCENTRATION_RISK: "1",
};

function ScoringBandsSection() {
  const ruler = useScoringRuler();
  const { t } = useI18n();

  return (
    <SectionCard
      title={t("config.bands.title")}
      description={t("config.bands.subtitle")}
      help={<SectionHelp section="bands" />}
    >
      <div className="space-y-6">
        {SCORING_SCALES.map((scale) => (
          <ScoringScaleEditor key={scale} scale={scale} current={ruler.forScale(scale).bands} />
        ))}
      </div>
    </SectionCard>
  );
}

function BandChip({ band }: { band: ScoringBand }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        gapTone[band.tone],
      )}
    >
      {t(ScoringBandSet.messageKeyOr(band.labelKey, TONE_LABEL_KEY[band.tone]))}
    </span>
  );
}

function ScoringScaleEditor({
  scale,
  current,
}: {
  scale: ScoringScale;
  current: readonly ScoringBand[];
}) {
  const store = useStore();
  const { t } = useI18n();

  const [editor, setEditor] = useState<ScoringBandsEditor | null>(null);
  const [sample, setSample] = useState(SCALE_SAMPLE[scale]);
  const {
    submitting: saving,
    error,
    clearError,
    run,
  } = useAsyncSubmit(t("config.bands.saveFailed"));
  const notifySuccess = useSuccessToast();

  const editing = editor !== null;
  const rows = editor ? editor.bands : [...current].sort((a, b) => a.sortOrder - b.sortOrder);
  const previewSource = editor ? editor.previewBands() : rows;
  const sampleValue = Number(sample);
  const previewBand =
    previewSource.length > 0 && sample.trim().length > 0 && Number.isFinite(sampleValue)
      ? ScoringBandSet.of(previewSource).classify(sampleValue)
      : undefined;

  const save = async () => {
    if (!editor) return;
    const payload = editor.payload();
    if (!payload) return;
    const result = await run(() => store.updateScoringBands(scale, payload));
    if (result.ok) {
      notifySuccess(
        "msg.config.bands.update.success",
        { escala: t(SCALE_TITLE_KEY[scale]) },
        result.value,
      );
      setEditor(null);
    }
  };

  return (
    <div className="surface-inset p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium">{t(SCALE_TITLE_KEY[scale])}</p>
          <SectionHelp section={`bands.${scale}`} />
        </div>
        {editing ? (
          <div className="flex justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => {
                setEditor(null);
                clearError();
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button size="sm" disabled={!editor.isValid || saving} onClick={() => void save()}>
              {saving ? t("team.transition.submitting") : t("common.save")}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditor(ScoringBandsEditor.from(scale, current))}
          >
            {t("common.edit")}
          </Button>
        )}
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[360px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2">
                {t("config.bands.col.band")}
              </th>
              <th scope="col" className="py-2 text-center">
                {t("config.bands.col.min")}
              </th>
              <th scope="col" className="py-2 text-center">
                {t("config.bands.col.max")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((band, i) => {
              const isFirst = i === 0;
              const isLast = i === rows.length - 1;
              return (
                <tr key={band.key} className="border-b border-border/60 last:border-0">
                  <td className="py-2">
                    <BandChip band={band} />
                    <span className="ml-2 text-xs text-muted-foreground">{band.key}</span>
                  </td>
                  <td className="py-2 text-center tabular-nums">
                    {isFirst ? "−∞" : editing ? (editor.cuts[i - 1] ?? "") : String(band.minValue)}
                  </td>
                  <td className="py-2 text-center tabular-nums">
                    {isLast ? (
                      "+∞"
                    ) : editing ? (
                      <input
                        type="number"
                        step={0.5}
                        disabled={saving}
                        aria-label={t("config.bands.cutLabel", { faixa: band.key })}
                        className="w-20 rounded-md border border-input bg-card px-2 py-1 text-center text-sm tabular-nums"
                        value={editor.cuts[i] ?? ""}
                        onChange={(e) => setEditor(editor.withCut(i, e.target.value))}
                      />
                    ) : (
                      String(band.maxValue)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && editor.errorKey && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {t(editor.errorKey)}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor={`band-sample-${scale}`}>
          {t("config.bands.preview.sample")}
        </label>
        <input
          id={`band-sample-${scale}`}
          type="number"
          step={0.5}
          className="w-20 rounded-md border border-input bg-card px-2 py-1 text-center text-sm tabular-nums"
          value={sample}
          onChange={(e) => setSample(e.target.value)}
        />
        {previewBand && <BandChip band={previewBand} />}
      </div>
    </div>
  );
}

const CURATION_FIELD_LABEL_KEY: Record<CurationPolicyField, MessageKey> = {
  maxActiveCompetencies: "config.curation.field.maxActiveCompetencies",
};

function CurationPolicySection() {
  const store = useStore();
  const policy = useCurationPolicy();
  const { t } = useI18n();

  const [editor, setEditor] = useState<CurationPolicyEditor | null>(null);
  const {
    submitting: saving,
    error,
    clearError,
    run,
  } = useAsyncSubmit(t("config.curation.saveFailed"));
  const notifySuccess = useSuccessToast();

  const editing = editor !== null;

  const save = async () => {
    if (!editor) return;
    const payload = editor.payload();
    if (!payload) return;
    const result = await run(() => store.updateCurationPolicy(payload));
    if (result.ok) {
      notifySuccess("msg.config.curationPolicy.update.success", undefined, result.value);
      setEditor(null);
    }
  };

  return (
    <SectionCard
      title={t("config.curation.title")}
      description={t("config.curation.subtitle")}
      help={<SectionHelp section="curation" />}
    >
      <div className="surface-inset p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{t("config.curation.policyTitle")}</p>
          {editing ? (
            <div className="flex justify-end gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setEditor(null);
                  clearError();
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button size="sm" disabled={!editor.isValid || saving} onClick={() => void save()}>
                {saving ? t("team.transition.submitting") : t("common.save")}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditor(CurationPolicyEditor.from(policy))}
            >
              {t("common.edit")}
            </Button>
          )}
        </div>

        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {CURATION_POLICY_FIELDS.map((field) => (
            <div key={field}>
              <label className="text-xs text-muted-foreground" htmlFor={`curation-${field}`}>
                {t(CURATION_FIELD_LABEL_KEY[field])}
              </label>
              {editing ? (
                <input
                  id={`curation-${field}`}
                  type="number"
                  min={1}
                  step={1}
                  disabled={saving}
                  className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-center text-sm tabular-nums"
                  value={editor.drafts[field]}
                  onChange={(e) => setEditor(editor.withField(field, e.target.value))}
                />
              ) : (
                <p id={`curation-${field}`} className="mt-1 text-sm font-medium tabular-nums">
                  {policy[field]}
                </p>
              )}
            </div>
          ))}
        </div>

        {editing && editor.errorKey && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {t(editor.errorKey)}
          </p>
        )}
        {error && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <p className="mt-3 text-xs text-muted-foreground">{t("config.curation.impact")}</p>
      </div>
    </SectionCard>
  );
}

const TEMPLATE_KEY_TITLE: Record<TextTemplateKey, MessageKey> = {
  "pdi.objective.fromGap": "config.templates.key.pdi.objective.fromGap",
};

function sampleVariablesFor(
  key: TextTemplateKey,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): Record<string, string | number> {
  switch (key) {
    case "pdi.objective.fromGap":
      return { competencia: t("config.templates.sample.competencia"), atual: 2, alvo: 4 };
  }
}

function TextTemplatesSection() {
  const templates = useTextTemplates();
  const { t } = useI18n();

  return (
    <SectionCard
      title={t("config.templates.title")}
      description={t("config.templates.subtitle")}
      help={<SectionHelp section="templates" />}
    >
      <div className="space-y-6">
        {TEXT_TEMPLATE_KEYS.map((key) => {
          const localeTemplates = Object.entries(templates[key]).sort(([a], [b]) =>
            a.localeCompare(b),
          );
          return (
            <div key={key} className="surface-inset p-3">
              <p className="text-sm font-medium">{t(TEMPLATE_KEY_TITLE[key])}</p>
              <p className="text-xs text-muted-foreground">{key}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("config.templates.variables")}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {TEXT_TEMPLATE_VARIABLES[key].map((variable) => (
                  <code key={variable} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                    {`{${variable}}`}
                  </code>
                ))}
              </div>
              <div className="mt-3 space-y-3">
                {localeTemplates.map(([locale, current]) => (
                  <TemplateLocaleEditor
                    key={`${key}:${locale}`}
                    templateKey={key}
                    locale={locale}
                    current={current}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function TemplateLocaleEditor({
  templateKey,
  locale,
  current,
}: {
  templateKey: TextTemplateKey;
  locale: string;
  current: string;
}) {
  const store = useStore();
  const { t } = useI18n();

  const [editor, setEditor] = useState<TextTemplateEditor | null>(null);
  const {
    submitting: saving,
    error,
    clearError,
    run,
  } = useAsyncSubmit(t("config.templates.saveFailed"));
  const notifySuccess = useSuccessToast();

  const editing = editor !== null;
  const samples = sampleVariablesFor(templateKey, t);

  const previewText = TextTemplate.of(editing ? editor.draft : current).render(samples);

  const save = async () => {
    if (!editor || !editor.isValid) return;
    const result = await run(() =>
      store.updateTextTemplate(templateKey, editor.locale, editor.draft),
    );
    if (result.ok) {
      notifySuccess(
        "msg.config.template.update.success",
        { key: t(TEMPLATE_KEY_TITLE[templateKey]), locale },
        result.value,
      );
      setEditor(null);
    }
  };

  return (
    <div className="rounded-md border border-border/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium uppercase">
          {locale}
        </span>
        {editing ? (
          <div className="flex justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => {
                setEditor(null);
                clearError();
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button size="sm" disabled={!editor.isValid || saving} onClick={() => void save()}>
              {saving ? t("team.transition.submitting") : t("common.save")}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditor(TextTemplateEditor.from(templateKey, locale, current))}
          >
            {t("common.edit")}
          </Button>
        )}
      </div>

      {editing ? (
        <textarea
          rows={2}
          disabled={saving}
          aria-label={t("config.templates.editLabel", { locale })}
          className="mt-2 w-full rounded-md border border-input bg-card px-2 py-1 text-sm"
          value={editor.draft}
          onChange={(e) => setEditor(editor.withDraft(e.target.value))}
        />
      ) : (
        <p className="mt-2 text-sm">{current}</p>
      )}

      {editing && editor.isEmpty && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {t("config.templates.error.empty")}
        </p>
      )}
      {editing && editor.unknownVariables.length > 0 && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {t("config.templates.error.unknownVariable", {
            variavel: editor.unknownVariables.map((name) => `{${name}}`).join(", "),
          })}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("config.templates.preview")}
      </p>
      <p className="text-sm italic text-muted-foreground">{previewText}</p>
    </div>
  );
}

const CADENCE_LABEL_KEY: Record<CycleCadence, MessageKey> = {
  SEMIANNUAL: "config.operational.cadence.SEMIANNUAL",
  QUARTERLY: "config.operational.cadence.QUARTERLY",
  ANNUAL: "config.operational.cadence.ANNUAL",
};

const OPERATIONAL_FIELD_LABEL_KEY: Record<OperationalNumberField, MessageKey> = {
  floor: "config.operational.field.floor",
  threshold: "config.operational.field.threshold",
  idleTimeout: "config.operational.field.idleTimeout",
};

function OperationalSettingsSection() {
  const store = useStore();
  const settings = useOperationalSettings();
  const { t } = useI18n();

  const [editor, setEditor] = useState<OperationalSettingsEditor | null>(null);
  const {
    submitting: saving,
    error,
    clearError,
    run,
  } = useAsyncSubmit(t("config.operational.saveFailed"));
  const notifySuccess = useSuccessToast();

  const editing = editor !== null;

  const save = async () => {
    if (!editor) return;
    const changes = editor.payload();
    if (!changes) return;

    const result = await run(async () => {
      for (const change of changes) await store.updateAppSetting(change.key, change.value);
    });
    if (result.ok) {
      notifySuccess("config.operational.saved");
      setEditor(null);
    }
  };

  const effectiveValues: Record<OperationalNumberField, number> = {
    floor: settings.careerMinimumQualifiedFloor,
    threshold: settings.trainingCollectiveInterventionThreshold,
    idleTimeout: settings.sessionIdleTimeoutMinutes,
  };

  return (
    <SectionCard
      title={t("config.operational.title")}
      description={t("config.operational.subtitle")}
      help={<SectionHelp section="operational" />}
    >
      <div className="surface-inset p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{t("config.operational.policyTitle")}</p>
          {editing ? (
            <div className="flex justify-end gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setEditor(null);
                  clearError();
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button size="sm" disabled={!editor.isValid || saving} onClick={() => void save()}>
                {saving ? t("team.transition.submitting") : t("common.save")}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditor(OperationalSettingsEditor.from(settings))}
            >
              {t("common.edit")}
            </Button>
          )}
        </div>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="operational-cadence">
              {t("config.operational.field.cadence")}
            </label>
            {editing ? (
              <select
                id="operational-cadence"
                disabled={saving}
                className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-sm"
                value={editor.cadence}
                onChange={(e) => setEditor(editor.withCadence(e.target.value as CycleCadence))}
              >
                {CYCLE_CADENCES.map((cadence) => (
                  <option key={cadence} value={cadence}>
                    {t(CADENCE_LABEL_KEY[cadence])}
                  </option>
                ))}
              </select>
            ) : (
              <p id="operational-cadence" className="mt-1 text-sm font-medium">
                {t(CADENCE_LABEL_KEY[settings.cycleCadence])}
              </p>
            )}
          </div>
          {OPERATIONAL_NUMBER_FIELDS.map((field) => (
            <div key={field}>
              <label className="text-xs text-muted-foreground" htmlFor={`operational-${field}`}>
                {t(OPERATIONAL_FIELD_LABEL_KEY[field])}
              </label>
              {editing ? (
                <input
                  id={`operational-${field}`}
                  type="number"
                  min={OPERATIONAL_FIELD_MINIMUM[field]}
                  step={1}
                  disabled={saving}
                  className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1 text-center text-sm tabular-nums"
                  value={editor.drafts[field]}
                  onChange={(e) => setEditor(editor.withField(field, e.target.value))}
                />
              ) : (
                <p id={`operational-${field}`} className="mt-1 text-sm font-medium tabular-nums">
                  {effectiveValues[field]}
                </p>
              )}
            </div>
          ))}
        </div>

        {editing && editor.errorKey && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {t(editor.errorKey)}
          </p>
        )}
        {error && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {t("config.operational.cadenceImpact")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("config.operational.idleTimeoutImpact")}
        </p>
      </div>
    </SectionCard>
  );
}

const VOCABULARY_TITLE_KEY: Record<VocabularyName, MessageKey> = {
  EVIDENCE_TYPE: "config.vocab.name.EVIDENCE_TYPE",
  LEARNING_ITEM_TYPE: "config.vocab.name.LEARNING_ITEM_TYPE",
  ACTION_TYPE: "config.vocab.name.ACTION_TYPE",
};

function VocabulariesSection() {
  const vocabularies = useVocabularies();
  const { t } = useI18n();

  return (
    <SectionCard
      title={t("config.vocab.title")}
      description={t("config.vocab.subtitle")}
      help={<SectionHelp section="vocab" />}
    >
      <div className="space-y-6">
        {VOCABULARY_NAMES.map((name) => (
          <VocabularyBlock key={name} name={name} items={vocabularies[name]} />
        ))}
      </div>
    </SectionCard>
  );
}

function VocabularyBlock({ name, items }: { name: VocabularyName; items: VocabularyItem[] }) {
  const store = useStore();
  const { t } = useI18n();
  const { label } = useVocabulary(name);

  const [editor, setEditor] = useState<VocabularyItemEditor | null>(null);
  const [draft, setDraft] = useState<NewVocabularyCodeEditor | null>(null);
  const {
    submitting: saving,
    error,
    clearError,
    run,
  } = useAsyncSubmit(t("config.vocab.saveFailed"));
  const notifySuccess = useSuccessToast();

  const rows = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

  const toggleActive = async (item: VocabularyItem) => {
    const result = await run(() =>
      store.updateVocabularyItem(name, item.code, { active: !item.active }),
    );
    if (result.ok) {
      toast.success(
        item.active
          ? t("config.vocab.deactivated", { code: item.code })
          : t("config.vocab.activated", { code: item.code }),
      );
    }
  };

  const saveEdit = async () => {
    if (!editor) return;
    const patch = editor.payload();
    if (!patch) return;
    if (Object.keys(patch).length === 0) {
      setEditor(null);
      return;
    }
    const result = await run(() => store.updateVocabularyItem(name, editor.code, patch));
    if (result.ok) {
      notifySuccess("msg.config.vocabulary.update.success", { code: editor.code }, result.value);
      setEditor(null);
    }
  };

  const addCode = async () => {
    if (!draft) return;
    const payload = draft.payload();
    if (!payload) return;
    const result = await run(() => store.addVocabularyItem(name, payload.code, payload.input));
    if (result.ok) {
      notifySuccess("msg.config.vocabulary.create.success", { code: payload.code }, result.value);
      setDraft(null);
    }
  };

  return (
    <div className="surface-inset p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium">{t(VOCABULARY_TITLE_KEY[name])}</p>
          <SectionHelp section={`vocab.${name}`} />
        </div>
        {draft === null && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(NewVocabularyCodeEditor.empty());
              clearError();
            }}
          >
            {t("config.vocab.addCode")}
          </Button>
        )}
      </div>

      <ul className="mt-2 space-y-1.5">
        {rows.map((item) => {
          const isEditing = editor !== null && editor.code === item.code;
          return (
            <li
              key={item.code}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm"
            >
              {isEditing ? (
                <>
                  <span className="font-medium">{label(item.code)}</span>
                  <input
                    aria-label={t("config.vocab.editLabelKey", { code: item.code })}
                    className="min-w-0 flex-1 rounded-md border border-input bg-card px-2 py-1 text-xs"
                    disabled={saving}
                    value={editor.labelKey}
                    onChange={(e) => setEditor(editor.withLabelKey(e.target.value))}
                  />
                  <input
                    type="number"
                    step={1}
                    aria-label={t("config.vocab.editSortOrder", { code: item.code })}
                    className="w-16 rounded-md border border-input bg-card px-2 py-1 text-center text-xs tabular-nums"
                    disabled={saving}
                    value={editor.sortOrder}
                    onChange={(e) => setEditor(editor.withSortOrder(e.target.value))}
                  />
                  <div className="ml-auto flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => {
                        setEditor(null);
                        clearError();
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      size="sm"
                      disabled={!editor.isValid || saving}
                      onClick={() => void saveEdit()}
                    >
                      {saving ? t("team.transition.submitting") : t("common.save")}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span
                    className={cn(
                      "font-medium",
                      !item.active && "text-muted-foreground line-through",
                    )}
                  >
                    {label(item.code)}
                  </span>
                  <span
                    className="text-xs text-muted-foreground"
                    title={t("config.vocab.technical", {
                      labelKey: item.labelKey,
                      sortOrder: item.sortOrder,
                    })}
                  >
                    {t("config.vocab.code", { code: item.code })}
                  </span>
                  {!item.active && (
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] uppercase">
                      {t("config.vocab.inactive")}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={() => {
                        setEditor(VocabularyItemEditor.from(item));
                        clearError();
                      }}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => void toggleActive(item)}
                    >
                      {item.active ? t("config.vocab.deactivate") : t("config.vocab.activate")}
                    </Button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {editor?.errorKey && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {t(editor.errorKey)}
        </p>
      )}

      {draft !== null && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-border/60 p-2.5">
          <div className="min-w-[140px] flex-1">
            <label className="text-xs text-muted-foreground" htmlFor={`vocab-new-code-${name}`}>
              {t("config.vocab.field.code")}
            </label>
            <input
              id={`vocab-new-code-${name}`}
              className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
              disabled={saving}
              value={draft.code}
              onChange={(e) => setDraft(draft.withCode(e.target.value))}
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="text-xs text-muted-foreground" htmlFor={`vocab-new-labelkey-${name}`}>
              {t("config.vocab.field.labelKey")}
            </label>
            <input
              id={`vocab-new-labelkey-${name}`}
              className="mt-1 w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm"
              disabled={saving}
              value={draft.labelKey}
              onChange={(e) => setDraft(draft.withLabelKey(e.target.value))}
            />
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => {
                setDraft(null);
                clearError();
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button size="sm" disabled={!draft.isValid || saving} onClick={() => void addCode()}>
              {saving ? t("team.transition.submitting") : t("config.vocab.add")}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <p className="mt-2 text-xs text-muted-foreground">{t("config.vocab.noDeleteHint")}</p>
    </div>
  );
}
