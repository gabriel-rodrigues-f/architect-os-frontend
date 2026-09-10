import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  ProgressionCriteriaRefusal,
  ProgressionCriteriaScreen,
  SectionHelp,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { useAsyncSubmit, useSuccessToast } from "@/hooks";
import { useCurrentUser } from "@/lib/auth";
import { ContextScope, type ContextScopeRequest } from "@/lib/context-scope";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { requireSystemOperatorReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useStore, useVocabularies, useVocabulary } from "@/lib/store";
import { cn } from "@/lib/utils";
import { VOCABULARY_NAMES, type VocabularyItem, type VocabularyName } from "@/lib/vocabularies";
import { NewVocabularyCodeEditor, VocabularyItemEditor } from "@/lib/view-models";

/**
 * VOCABULÁRIOS — a quinta das seis fatias do grupo Critérios de Progressão
 * (dono, 2026-09-10). Os códigos que os formulários oferecem: tipo de item de
 * trilha e tipo de ação do PDI.
 *
 * O DONO DESTA FATIA é quem opera o sistema: o cartão já nascia atrás de
 * `isAdmin`. E o nome na coluna é metade do ganho da decisão do dono — quem
 * procura "tipo de ação do PDI" agora acha de fora, sem abrir uma tela
 * chamada Critérios de Progressão.
 */
export const Route = createFileRoute("/vocabularies")({
  head: () => ({
    meta: [
      { title: "Vocabulários — Synapse" },
      {
        name: "description",
        content:
          "Tipos de item de trilha e de ação do PDI — os códigos que os formulários oferecem.",
      },
      { property: "og:title", content: "Vocabulários — Synapse" },
      { property: "og:description", content: "Os códigos que os formulários oferecem." },
    ],
  }),
  beforeLoad: requireSystemOperatorReach,
  component: VocabulariesPage,
});

const NO_CONTEXT: readonly ContextScopeRequest[] = [];

function VocabulariesPage() {
  const { t } = useI18n();
  const user = useCurrentUser();
  const isAdmin = defaultUiAuthorizationPolicy.operatesTheSystem(user);

  if (!isAdmin) {
    return (
      <ProgressionCriteriaRefusal
        slice="vocabularies"
        title={t("config.vocab.title")}
        reason={t("config.systemOnly")}
        hint={t("config.systemOnlyHint")}
      />
    );
  }

  return (
    <ContextScope contexts={NO_CONTEXT}>
      <VocabulariesScreen />
    </ContextScope>
  );
}

const VOCABULARY_TITLE_KEY: Record<VocabularyName, MessageKey> = {
  LEARNING_ITEM_TYPE: "config.vocab.name.LEARNING_ITEM_TYPE",
  ACTION_TYPE: "config.vocab.name.ACTION_TYPE",
};

function VocabulariesScreen() {
  const vocabularies = useVocabularies();
  const { t } = useI18n();

  return (
    <ProgressionCriteriaScreen
      slice="vocabularies"
      title={t("config.vocab.title")}
      description={t("config.vocab.subtitle")}
    >
      <div className="space-y-6">
        {VOCABULARY_NAMES.map((name) => (
          <VocabularyBlock key={name} name={name} items={vocabularies[name]} />
        ))}
      </div>
    </ProgressionCriteriaScreen>
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

  const rows = [...items].sort(
    (esquerda, direita) =>
      esquerda.sortOrder - direita.sortOrder || esquerda.code.localeCompare(direita.code),
  );

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
                    onChange={(evento) => setEditor(editor.withLabelKey(evento.target.value))}
                  />
                  <input
                    type="number"
                    step={1}
                    aria-label={t("config.vocab.editSortOrder", { code: item.code })}
                    className="w-16 rounded-md border border-input bg-card px-2 py-1 text-center text-xs tabular-nums"
                    disabled={saving}
                    value={editor.sortOrder}
                    onChange={(evento) => setEditor(editor.withSortOrder(evento.target.value))}
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
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 text-meta uppercase">
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
              onChange={(evento) => setDraft(draft.withCode(evento.target.value))}
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
              onChange={(evento) => setDraft(draft.withLabelKey(evento.target.value))}
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
