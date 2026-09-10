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
import { useStore, useTextTemplates } from "@/lib/store";
import {
  TextTemplate,
  TEXT_TEMPLATE_KEYS,
  TEXT_TEMPLATE_VARIABLES,
  type TextTemplateKey,
} from "@/lib/text-templates";
import { TextTemplateEditor } from "@/lib/view-models";

/**
 * TEXTOS — a terceira das seis fatias do grupo Critérios de Progressão (dono,
 * 2026-09-10). É o texto que a plataforma ESCREVE e GRAVA — não rótulo de
 * tela, que mora nos catálogos de idioma.
 *
 * O DONO DESTA FATIA é quem opera o sistema: o cartão já nascia atrás de
 * `isAdmin`, e a escrita (`PUT /config/text-templates`) é administrativa na
 * matriz do backend.
 */
export const Route = createFileRoute("/text-templates")({
  head: () => ({
    meta: [
      { title: "Textos — Synapse" },
      {
        name: "description",
        content:
          "Modelos de texto do domínio: o texto que a plataforma gera e grava, um por idioma.",
      },
      { property: "og:title", content: "Textos — Synapse" },
      { property: "og:description", content: "Os modelos de texto que a plataforma grava." },
    ],
  }),
  beforeLoad: requireSystemOperatorReach,
  component: TextTemplatesPage,
});

const NO_CONTEXT: readonly ContextScopeRequest[] = [];

function TextTemplatesPage() {
  const { t } = useI18n();
  const user = useCurrentUser();
  const isAdmin = defaultUiAuthorizationPolicy.operatesTheSystem(user);

  if (!isAdmin) {
    return (
      <ProgressionCriteriaRefusal
        slice="textTemplates"
        title={t("config.templates.title")}
        reason={t("config.systemOnly")}
        hint={t("config.systemOnlyHint")}
      />
    );
  }

  return (
    <ContextScope contexts={NO_CONTEXT}>
      <TextTemplatesScreen />
    </ContextScope>
  );
}

const TEMPLATE_KEY_TITLE: Record<TextTemplateKey, MessageKey> = {
  "pdi.objective.fromGap": "config.templates.key.pdi.objective.fromGap",
};

/**
 * Os valores de exemplo da prévia, um por modelo. Tabela, não `switch` solto:
 * a catraca de idioma por categoria cobra que a variação por caso seja DADO
 * indexado pela chave, e não uma função livre no meio do arquivo.
 */
const TEMPLATE_SAMPLE_VARIABLES: Record<
  TextTemplateKey,
  (
    t: (key: MessageKey, vars?: Record<string, string | number>) => string,
  ) => Record<string, string | number>
> = {
  "pdi.objective.fromGap": (t) => ({
    competencia: t("config.templates.sample.competencia"),
    atual: 2,
    alvo: 4,
  }),
};

function TextTemplatesScreen() {
  const templates = useTextTemplates();
  const { t } = useI18n();

  return (
    <ProgressionCriteriaScreen
      slice="textTemplates"
      title={t("config.templates.title")}
      description={t("config.templates.subtitle")}
    >
      <div className="space-y-6">
        {TEXT_TEMPLATE_KEYS.map((key) => {
          const localeTemplates = Object.entries(templates[key]).sort(([esquerda], [direita]) =>
            esquerda.localeCompare(direita),
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
    </ProgressionCriteriaScreen>
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
  const samples = TEMPLATE_SAMPLE_VARIABLES[templateKey](t);

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
          onChange={(evento) => setEditor(editor.withDraft(evento.target.value))}
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
