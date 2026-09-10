import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ProgressionCriteriaRefusal, ProgressionCriteriaScreen } from "@/components/app";
import { Button } from "@/components/ui/button";
import { useAsyncSubmit, useSuccessToast } from "@/hooks";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest } from "@/lib/context-scope";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { requireSystemOperatorReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useCurationPolicy, useStore } from "@/lib/store";
import {
  CURATION_POLICY_FIELDS,
  CurationPolicyEditor,
  type CurationPolicyField,
} from "@/lib/view-models";

/**
 * CATÁLOGO — a quarta das seis fatias do grupo Critérios de Progressão (dono,
 * 2026-09-10). É a POLÍTICA de curadoria do catálogo (o teto de competências
 * ativas por capacidade), não o catálogo em si: as competências continuam em
 * Administração → Catálogo de Competências.
 *
 * O DONO DESTA FATIA é quem opera o sistema: o cartão já nascia atrás de
 * `isAdmin`, e a escrita de configuração é administrativa na matriz do
 * backend.
 */
export const Route = createFileRoute("/catalog-policy")({
  head: () => ({
    meta: [
      { title: "Catálogo — Synapse" },
      {
        name: "description",
        content:
          "Política de curadoria do catálogo: o máximo de competências ativas que uma capacidade pode ter.",
      },
      { property: "og:title", content: "Catálogo — Synapse" },
      { property: "og:description", content: "A política de curadoria do catálogo." },
    ],
  }),
  beforeLoad: requireSystemOperatorReach,
  component: CatalogPolicyPage,
});

/**
 * A fatia `capabilities` não é enfeite: mudar o teto de competências ativas
 * recalcula a situação de curadoria de TODA capacidade, e é dessa fatia que
 * `curation.status` vem. Sem pedi-la, o salvamento não teria o que invalidar.
 */
const CATALOG_POLICY_CONTEXTS: readonly ContextScopeRequest[] = ["capabilities"];

function CatalogPolicyPage() {
  const { t } = useI18n();
  const user = useCurrentUser();
  const isAdmin = defaultUiAuthorizationPolicy.operatesTheSystem(user);

  if (!isAdmin) {
    return (
      <ProgressionCriteriaRefusal
        slice="catalogPolicy"
        title={t("config.curation.title")}
        reason={t("config.systemOnly")}
        hint={t("config.systemOnlyHint")}
      />
    );
  }

  return (
    <ContextScope contexts={CATALOG_POLICY_CONTEXTS}>
      <CatalogPolicyScreen />
    </ContextScope>
  );
}

const CURATION_FIELD_LABEL_KEY: Record<CurationPolicyField, MessageKey> = {
  maxActiveCompetencies: "config.curation.field.maxActiveCompetencies",
};

function CatalogPolicyScreen() {
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
    <ProgressionCriteriaScreen
      slice="catalogPolicy"
      title={t("config.curation.title")}
      description={t("config.curation.subtitle")}
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
                  onChange={(evento) => setEditor(editor.withField(field, evento.target.value))}
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
    </ProgressionCriteriaScreen>
  );
}
