import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { gapTone, LevelBadge, PageHeader, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { useAsyncSubmit } from "@/hooks/use-async-submit";
import { ACTION_TYPES, EVIDENCE_TYPES, LEVELS, type CareerLevel, type Level } from "@/lib/domain";
import { useCurrentUser } from "@/lib/auth";
import { useLabels } from "@/lib/labels";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import {
  classifyBand,
  messageKeyOrDefault,
  SCORING_SCALES,
  type BandTone,
  type ScoringBand,
  type ScoringScale,
} from "@/lib/scoring-bands";
import {
  useCareerLevelsByRank,
  useCurationPolicy,
  useScoringBands,
  useStore,
  useTextTemplates,
} from "@/lib/store";
import { defaultDateFormatter } from "@/lib/text";
import {
  renderTemplate,
  TEXT_TEMPLATE_KEYS,
  TEXT_TEMPLATE_VARIABLES,
  type TextTemplateKey,
} from "@/lib/text-templates";
import { cn } from "@/lib/utils";
import {
  CURATION_POLICY_FIELDS,
  CurationPolicyEditor,
  type CurationPolicyField,
} from "@/lib/view-models/curation-policy-editor";
import { ScoringBandsEditor } from "@/lib/view-models/scoring-bands-editor";
import { TextTemplateEditor } from "@/lib/view-models/text-template-editor";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Política de Progressão — Synapse" },
      {
        name: "description",
        content:
          "Referência do modelo: escala de proficiência, perfis por cargo, tipos de ação e evidência.",
      },
      { property: "og:title", content: "Política de Progressão — Synapse" },
      {
        property: "og:description",
        content: "Configuração e glossário do modelo de desenvolvimento técnico.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const store = useStore();
  const careerLevels = useCareerLevelsByRank();
  const labels = useLabels();
  const { t, locale } = useI18n();
  const help = usePageHelp("settings");
  const isAdmin = useCurrentUser().role === "admin";

  return (
    <>
      <PageHeader title={t("ref.title")} description={t("ref.subtitle")} help={help} />

      <div className="grid gap-6 xl:grid-cols-2">
        <CareerPolicySection isAdmin={isAdmin} />
        {/* CFG-02 (SPEC-OO3-13, §3.2) — admin-only como o resto da
            configuração editável: quem não é admin nem vê a seção (o PUT é
            recusado no servidor de qualquer forma, AdminGuard). */}
        {isAdmin && <ScoringBandsSection />}
        {/* CFG-03 (SPEC-OO3-13, §3.2) — aba "Textos", mesmo corte admin-only. */}
        {isAdmin && <TextTemplatesSection />}
        {/* CFG-04 (SPEC-OO3-13, §3.2) — aba "Catálogo", mesmo corte admin-only. */}
        {isAdmin && <CurationPolicySection />}
      </div>

      {/* R2-TXT-02 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o menu chama esta
          tela de "Política de Progressão" (título acima já reflete isso); o
          restante da página é glossário read-only, por isso ganha um
          cabeçalho interno próprio em vez de se misturar visualmente com a
          política editável. */}
      <h2 className="mb-4 mt-6 font-display text-lg font-semibold">
        {t("ref.referenceSectionTitle")}
      </h2>
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title={t("ref.scale")} description={t("ref.scale.subtitle")}>
          <ul className="space-y-2">
            {LEVELS.map((l) => (
              <li key={l.level} className="flex items-start gap-3 surface-inset p-3">
                <LevelBadge level={l.level} showName />
                <p className="text-sm text-muted-foreground">{labels.levelDescription[l.level]}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={t("ref.cycles")} description={t("ref.cycles.subtitle")}>
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

        <SectionCard title={t("ref.profiles")} description={t("ref.profiles.subtitle")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2">
                    {t("ref.capability")}
                  </th>
                  {careerLevels.map((cl) => (
                    <th key={cl.id} scope="col" className="py-2 text-center">
                      {labels.roleShort(cl.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {store.capabilities.map((cat) => {
                  const comps = store.competencies.filter((c) => c.capabilityId === cat.id);
                  return (
                    <tr key={cat.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 font-medium">{cat.name}</td>
                      {careerLevels.map((cl) => {
                        // B-38 — `expected` não garante mais a chave presente
                        // (nível de carreira sem curadoria ainda nesta
                        // competência); a média considera só quem TEM valor,
                        // nunca trata ausência como 0 (mesma filosofia de
                        // MISSING ≠ 0 do resto do app).
                        const values = comps
                          .map((c) => c.expected[cl.id])
                          .filter((v): v is Level => v !== undefined);
                        const avg = values.length
                          ? values.reduce((s, v) => s + v, 0) / values.length
                          : undefined;
                        return (
                          <td key={cl.id} className="py-2 text-center tabular-nums">
                            {avg === undefined ? "—" : avg.toFixed(1)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title={t("ref.taxonomies.title")} description={t("ref.taxonomies.subtitle")}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("ref.taxonomies.actionTypes")}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ACTION_TYPES.map((a) => (
              <span key={a} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                {labels.actionType[a]}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("ref.taxonomies.evidenceTypes")}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {EVIDENCE_TYPES.map((a) => (
              <span key={a} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                {labels.evidenceType[a]}
              </span>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

/**
 * ORIENTACAO-NONA-RODADA, Seção 16 (ENT-09-009) — "Política de Progressão":
 * existia API (`PATCH /api/career-levels/:id/policy`) desde a rodada
 * anterior, mas nenhuma tela administrativa. Cada nível edita só a própria
 * linha — otimista o bastante para não precisar de um formulário separado,
 * mas com estado de erro de verdade (o piso global de 3 é aplicado no
 * servidor, `career_level_policies` CHECK, Seção 9).
 */
function CareerPolicySection({ isAdmin }: { isAdmin: boolean }) {
  const store = useStore();
  const careerLevels = useCareerLevelsByRank();
  const readyCapabilities = store.capabilities.filter((c) => c.curation.status === "READY").length;
  const { t } = useI18n();

  return (
    <SectionCard title={t("policy.title")} description={t("policy.subtitle")}>
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
            {careerLevels.map((level) => {
              const policy = store.careerLevelPolicies.find((p) => p.careerLevelId === level.id);
              return (
                <CareerPolicyRow
                  key={level.id}
                  level={level}
                  minimum={policy?.minimumQualifiedCapabilities}
                  readyCapabilities={readyCapabilities}
                  isAdmin={isAdmin}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function CareerPolicyRow({
  level,
  minimum,
  readyCapabilities,
  isAdmin,
}: {
  level: CareerLevel;
  minimum: number | undefined;
  readyCapabilities: number;
  isAdmin: boolean;
}) {
  const store = useStore();
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(minimum ?? 3));
  /** OO3-11/D-6 (reuso final) — ciclo submitting/erro compartilhado; toast e fechar edição ficam aqui. */
  const {
    submitting: saving,
    error,
    clearError,
    run,
  } = useAsyncSubmit("Não foi possível salvar a política.");

  const draftValue = Number(draft);
  const canSave = Number.isInteger(draftValue) && draftValue >= 3;
  const impossible = minimum !== undefined && minimum > readyCapabilities;

  const save = async () => {
    if (!canSave) return;
    const result = await run(() => store.updateCareerLevelPolicy(level.id, draftValue));
    if (result.ok) {
      toast.success(`Política do ${level.name} atualizada.`);
      setEditing(false);
    }
  };

  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <td className="py-2">
        <p className="font-medium">{level.name}</p>
        <p className="text-xs text-muted-foreground">
          {t("policy.row.hint", { nivel: level.name, minimo: minimum ?? "—" })}
        </p>
        {impossible && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {t("policy.row.warning", { minimo: minimum, prontas: readyCapabilities })}
          </p>
        )}
      </td>
      <td className="py-2 text-center">
        {editing ? (
          <input
            type="number"
            min={3}
            step={1}
            disabled={saving}
            className="w-20 rounded-md border border-input bg-card px-2 py-1 text-center text-sm tabular-nums"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : (
          <span className="tabular-nums">{minimum ?? "—"}</span>
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
                  setDraft(String(minimum ?? 3));
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
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              {t("common.edit")}
            </Button>
          )}
        </td>
      )}
    </tr>
  );
}

/** Título i18n de cada escala — mapa literal para o TypeScript garantir que toda escala tem chave. */
const SCALE_TITLE_KEY: Record<ScoringScale, MessageKey> = {
  GAP_SEVERITY: "config.bands.scale.GAP_SEVERITY",
  PROFICIENCY: "config.bands.scale.PROFICIENCY",
  CONCENTRATION_RISK: "config.bands.scale.CONCENTRATION_RISK",
};

/** Rótulo default por tom — fallback de `messageKeyOrDefault` quando o servidor gravou `labelKey` que este build não conhece. */
const TONE_LABEL_KEY: Record<BandTone, MessageKey> = {
  ok: "config.bands.tone.ok",
  low: "config.bands.tone.low",
  high: "config.bands.tone.high",
  critical: "config.bands.tone.critical",
};

/** Valor de exemplo inicial do preview, um por escala (gap 2, média 3, 1 referência). */
const SCALE_SAMPLE: Record<ScoringScale, string> = {
  GAP_SEVERITY: "2",
  PROFICIENCY: "3",
  CONCENTRATION_RISK: "1",
};

/**
 * CFG-02 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.2) — aba "Réguas e limiares":
 * editor das 3 escalas de `scoring_bands`. A montagem/validação do payload
 * vive no ViewModel (`ScoringBandsEditor` — a régua da casa: classe
 * testável, render na tela); aqui é só fiação de inputs, preview e submit.
 */
function ScoringBandsSection() {
  const bands = useScoringBands();
  const { t } = useI18n();

  return (
    <SectionCard title={t("config.bands.title")} description={t("config.bands.subtitle")}>
      <div className="space-y-6">
        {SCORING_SCALES.map((scale) => (
          <ScoringScaleEditor key={scale} scale={scale} current={bands[scale]} />
        ))}
      </div>
    </SectionCard>
  );
}

/** O chip de faixa — mesmo par fundo/texto por tom do `GapBadge` (`gapTone`). */
function BandChip({ band }: { band: ScoringBand }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        gapTone[band.tone],
      )}
    >
      {t(messageKeyOrDefault(band.labelKey, TONE_LABEL_KEY[band.tone]))}
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
  /** `null` = leitura; editar cria o editor a partir da régua efetiva atual. */
  const [editor, setEditor] = useState<ScoringBandsEditor | null>(null);
  const [sample, setSample] = useState(SCALE_SAMPLE[scale]);
  const {
    submitting: saving,
    error,
    clearError,
    run,
  } = useAsyncSubmit(t("config.bands.saveFailed"));

  const editing = editor !== null;
  const rows = editor ? editor.bands : [...current].sort((a, b) => a.sortOrder - b.sortOrder);
  const previewSource = editor ? editor.previewBands() : rows;
  const sampleValue = Number(sample);
  const previewBand =
    sample.trim().length > 0 && Number.isFinite(sampleValue)
      ? classifyBand(previewSource, sampleValue)
      : undefined;

  const save = async () => {
    if (!editor) return;
    const payload = editor.payload();
    if (!payload) return;
    const result = await run(() => store.updateScoringBands(scale, payload));
    if (result.ok) {
      toast.success(t("config.bands.saved", { escala: t(SCALE_TITLE_KEY[scale]) }));
      setEditor(null);
    }
  };

  return (
    <div className="surface-inset p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t(SCALE_TITLE_KEY[scale])}</p>
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

      {/* Preview do efeito: classifica um valor de exemplo com o RASCUNHO
          (quando válido) e mostra o chip resultante — mesmo derivador
          (`classifyBand`) e mesmos tons do `GapBadge`. */}
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

/** Rótulo i18n de cada campo da política de curadoria — mapa literal, mesmo racional de `SCALE_TITLE_KEY`. */
const CURATION_FIELD_LABEL_KEY: Record<CurationPolicyField, MessageKey> = {
  maxActiveCompetencies: "config.curation.field.maxActiveCompetencies",
  requiredRestrictive: "config.curation.field.requiredRestrictive",
  requiredNonRestrictive: "config.curation.field.requiredNonRestrictive",
};

/**
 * CFG-04 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.2) — aba "Catálogo": editor
 * dos três limites de `catalog_curation_policy`. A montagem/validação do
 * payload vive no ViewModel (`CurationPolicyEditor` — a régua da casa:
 * classe testável, render na tela); aqui é só fiação de inputs, aviso de
 * impacto e submit. Salvar invalida a query da política E o snapshot de
 * `/api/state` (`store.updateCurationPolicy`) — o admin VÊ os badges
 * READY/REQUIRES_CURATION recalculados sob a política nova.
 */
function CurationPolicySection() {
  const store = useStore();
  const policy = useCurationPolicy();
  const { t } = useI18n();
  /** `null` = leitura; editar cria o editor a partir da política efetiva atual. */
  const [editor, setEditor] = useState<CurationPolicyEditor | null>(null);
  const {
    submitting: saving,
    error,
    clearError,
    run,
  } = useAsyncSubmit(t("config.curation.saveFailed"));

  const editing = editor !== null;

  const save = async () => {
    if (!editor) return;
    const payload = editor.payload();
    if (!payload) return;
    const result = await run(() => store.updateCurationPolicy(payload));
    if (result.ok) {
      toast.success(t("config.curation.saved"));
      setEditor(null);
    }
  };

  return (
    <SectionCard title={t("config.curation.title")} description={t("config.curation.subtitle")}>
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
                  min={field === "maxActiveCompetencies" ? 1 : 0}
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

        {/* Aviso de impacto — alterar a política recalcula a curadoria
            (READY/REQUIRES_CURATION) de TODAS as capacidades na próxima
            leitura (o recomputo é derivado on-read no backend). */}
        <p className="mt-3 text-xs text-muted-foreground">{t("config.curation.impact")}</p>
      </div>
    </SectionCard>
  );
}

/** Título i18n de cada key de template — mapa literal, mesmo racional de `SCALE_TITLE_KEY`. */
const TEMPLATE_KEY_TITLE: Record<TextTemplateKey, MessageKey> = {
  "pdi.objective.fromGap": "config.templates.key.pdi.objective.fromGap",
};

/** Valores de exemplo do preview, por key — cobrem TODAS as variáveis que a key fornece. */
function sampleVariablesFor(
  key: TextTemplateKey,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
): Record<string, string | number> {
  switch (key) {
    case "pdi.objective.fromGap":
      return { competencia: t("config.templates.sample.competencia"), atual: 2, alvo: 4 };
  }
}

/**
 * CFG-03 (SPEC-OO3-13-HARDCODED-CONFIG.md, §3.2) — aba "Textos": editor de
 * `text_templates` por key/locale, com a lista de variáveis da key e
 * preview renderizado pelo MESMO interpolador do app (`renderTemplate`).
 * A validação client-side vive no ViewModel (`TextTemplateEditor`).
 */
function TextTemplatesSection() {
  const templates = useTextTemplates();
  const { t } = useI18n();

  return (
    <SectionCard title={t("config.templates.title")} description={t("config.templates.subtitle")}>
      <div className="space-y-6">
        {TEXT_TEMPLATE_KEYS.map((key) => {
          const locales = Object.keys(templates[key]).sort();
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
                {locales.map((locale) => (
                  <TemplateLocaleEditor
                    key={`${key}:${locale}`}
                    templateKey={key}
                    locale={locale}
                    current={templates[key][locale]!}
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
  /** `null` = leitura; editar cria o editor a partir do template efetivo atual. */
  const [editor, setEditor] = useState<TextTemplateEditor | null>(null);
  const {
    submitting: saving,
    error,
    clearError,
    run,
  } = useAsyncSubmit(t("config.templates.saveFailed"));

  const editing = editor !== null;
  const samples = sampleVariablesFor(templateKey, t);
  /** Preview SEMPRE visível e reagindo à edição — rascunho quando editando, efetivo quando não. */
  const previewText = renderTemplate(editing ? editor.draft : current, samples);

  const save = async () => {
    if (!editor || !editor.isValid) return;
    const result = await run(() =>
      store.updateTextTemplate(templateKey, editor.locale, editor.draft),
    );
    if (result.ok) {
      toast.success(
        t("config.templates.saved", { key: t(TEMPLATE_KEY_TITLE[templateKey]), locale }),
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
