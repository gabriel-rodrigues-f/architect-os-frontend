import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
  gapTone,
  ProgressionCriteriaRefusal,
  ProgressionCriteriaScreen,
  SectionCard,
  SectionHelp,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useAsyncSubmit, useSuccessToast } from "@/hooks";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest } from "@/lib/context-scope";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { CYCLE_CADENCES, type CycleCadence } from "@/lib/operational-settings";
import { requireSystemOperatorReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import {
  SCORING_SCALES,
  ScoringBandSet,
  type BandTone,
  type ScoringBand,
  type ScoringScale,
} from "@/lib/scoring-bands";
import { useOperationalSettings, useScoringRuler, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  OPERATIONAL_FIELD_MINIMUM,
  OPERATIONAL_NUMBER_FIELDS,
  OperationalSettingsEditor,
  ScoringBandsEditor,
  type OperationalNumberField,
} from "@/lib/view-models";

/**
 * RÉGUAS E LIMIARES — a segunda das seis fatias do grupo Critérios de
 * Progressão (dono, 2026-09-10).
 *
 * Junta os dois cartões que sempre foram a mesma coisa: os CORTES por onde a
 * plataforma lê um número (severidade de distância, proficiência, risco de
 * concentração) e os PARÂMETROS de operação (cadência, piso, limiar de
 * intervenção coletiva, tempo de ociosidade). Um e outro valem para a
 * organização inteira e mudam a leitura de todas as telas na hora.
 *
 * O DONO DESTA FATIA é quem opera o sistema — nunca teve outro: os dois
 * cartões já nasciam atrás de `isAdmin` dentro da tela única, e quem não
 * alcançava via a caixa sumir sem explicação.
 */
export const Route = createFileRoute("/scoring-rulers")({
  head: () => ({
    meta: [
      { title: "Réguas e limiares — Synapse" },
      {
        name: "description",
        content:
          "Cortes numéricos das réguas de severidade, proficiência e risco de concentração, e os parâmetros de operação.",
      },
      { property: "og:title", content: "Réguas e limiares — Synapse" },
      {
        property: "og:description",
        content: "Os cortes e parâmetros por onde a plataforma lê os números.",
      },
    ],
  }),
  beforeLoad: requireSystemOperatorReach,
  component: ScoringRulersPage,
});

/**
 * A fatia `cycles` entra porque a CADÊNCIA muda os ciclos futuros: salvar
 * aqui precisa invalidar a lista de ciclos, senão a tela vizinha continua
 * mostrando a cadência velha até alguém recarregar.
 */
const SCORING_RULERS_CONTEXTS: readonly ContextScopeRequest[] = ["cycles"];

function ScoringRulersPage() {
  const { t } = useI18n();
  const user = useCurrentUser();
  const isAdmin = defaultUiAuthorizationPolicy.operatesTheSystem(user);

  if (!isAdmin) {
    return (
      <ProgressionCriteriaRefusal
        slice="scoringRulers"
        title={t("config.bands.title")}
        reason={t("config.systemOnly")}
        hint={t("config.systemOnlyHint")}
      />
    );
  }

  return (
    <ContextScope contexts={SCORING_RULERS_CONTEXTS}>
      <ScoringRulersScreen />
    </ContextScope>
  );
}

function ScoringRulersScreen() {
  const ruler = useScoringRuler();
  const { t } = useI18n();

  return (
    <ProgressionCriteriaScreen
      slice="scoringRulers"
      title={t("config.bands.title")}
      description={t("config.bands.subtitle")}
    >
      <div className="space-y-6">
        {SCORING_SCALES.map((scale) => (
          <ScoringScaleEditor key={scale} scale={scale} current={ruler.forScale(scale).bands} />
        ))}
      </div>

      <SectionCard
        className="mt-8"
        title={t("config.operational.title")}
        description={t("config.operational.subtitle")}
        help={<SectionHelp section="operational" />}
      >
        <OperationalSettingsEditorCard />
      </SectionCard>
    </ProgressionCriteriaScreen>
  );
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
  const rows = editor
    ? editor.bands
    : [...current].sort((esquerda, direita) => esquerda.sortOrder - direita.sortOrder);
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

      <div className="scroll-visible mt-2 overflow-x-auto">
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
            {rows.map((band, indice) => {
              const isFirst = indice === 0;
              const isLast = indice === rows.length - 1;
              return (
                <tr key={band.key} className="border-b border-border/60 last:border-0">
                  <td className="py-2">
                    <BandChip band={band} />
                    <span className="ml-2 text-xs text-muted-foreground">{band.key}</span>
                  </td>
                  <td className="py-2 text-center tabular-nums">
                    {isFirst
                      ? "−∞"
                      : editing
                        ? (editor.cuts[indice - 1] ?? "")
                        : String(band.minValue)}
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
                        value={editor.cuts[indice] ?? ""}
                        onChange={(evento) =>
                          setEditor(editor.withCut(indice, evento.target.value))
                        }
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
          onChange={(evento) => setSample(evento.target.value)}
        />
        {previewBand && <BandChip band={previewBand} />}
      </div>
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

function OperationalSettingsEditorCard() {
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
              onChange={(evento) =>
                setEditor(editor.withCadence(evento.target.value as CycleCadence))
              }
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
                onChange={(evento) => setEditor(editor.withField(field, evento.target.value))}
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

      <p className="mt-3 text-xs text-muted-foreground">{t("config.operational.cadenceImpact")}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("config.operational.idleTimeoutImpact")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{t("config.operational.pageNote")}</p>
    </div>
  );
}
