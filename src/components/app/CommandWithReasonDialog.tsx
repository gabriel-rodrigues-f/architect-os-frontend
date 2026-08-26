import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncSubmit } from "@/hooks/use-async-submit";
import { useI18n } from "@/lib/i18n";

/**
 * OO3-11c — o esqueleto compartilhado dos comandos "com motivo obrigatório":
 * `CareerLevelTransitionDialog` e `DeactivateDialog` (`team-shared.tsx`) e
 * `ReopenPlanDialog`/`RescheduleDialog` (`development-plans.tsx`) repetiam o
 * mesmo ciclo `reason` + `submitting` + `error` byte a byte, mudando só
 * textos, campo extra e variante do botão. O ciclo assíncrono em si vem de
 * `useAsyncSubmit` (D-6, reuso final) — este componente só soma o motivo
 * obrigatório e a casca de diálogo.
 *
 * Regras copiadas dos originais, não redesenhadas:
 * - confirmar habilitado sse `reason.trim() && canSubmit && !submitting`;
 * - rejeição → `err instanceof ApiError ? err.message : fallbackError`, e o
 *   diálogo PERMANECE aberto (é o que faz o 409 `ARCHITECT_VERSION_CONFLICT`
 *   aparecer para o usuário em vez de sumir num toast);
 * - `onClose()` só no sucesso — o toast de sucesso fica no `onSubmit` do
 *   chamador, junto do texto específico do comando;
 * - `onSubmit` DEVE devolver a Promise do comando (sem `return`, o diálogo
 *   fecharia antes da confirmação do servidor e o 409 viraria silêncio);
 * - sem `role="alert"` no erro por padrão (os originais de time não têm) —
 *   `errorRole="alert"` preserva o comportamento do `RescheduleDialog`, que
 *   sempre teve.
 */
export function CommandWithReasonDialog({
  title,
  body,
  reasonInputId,
  reasonLabel,
  reasonPlaceholder,
  confirmLabel,
  submittingLabel,
  cancelLabel,
  confirmVariant = "default",
  fallbackError,
  canSubmit = true,
  dismissibleWhileSubmitting = true,
  disableFieldsWhileSubmitting = false,
  errorRole,
  extraFields,
  onSubmit,
  onClose,
}: {
  title: ReactNode;
  body?: ReactNode;
  reasonInputId: string;
  reasonLabel: string;
  reasonPlaceholder?: string;
  confirmLabel: string;
  submittingLabel: string;
  /** Default: `t("common.cancel")`. */
  cancelLabel?: string;
  confirmVariant?: "default" | "destructive";
  fallbackError: string;
  canSubmit?: boolean;
  /** `false` = clicar fora/Esc não fecha enquanto envia (comportamento do `RescheduleDialog`). */
  dismissibleWhileSubmitting?: boolean;
  /** `true` = motivo (e campos extras, via render-prop) desabilitados enquanto envia. */
  disableFieldsWhileSubmitting?: boolean;
  errorRole?: "alert";
  extraFields?: (state: { submitting: boolean }) => ReactNode;
  onSubmit: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  /** OO3-11/D-6 — o ciclo submitting/erro é o `useAsyncSubmit` compartilhado. */
  const { submitting, error, run } = useAsyncSubmit(fallbackError);

  const submit = async () => {
    const result = await run(() => onSubmit(reason.trim()));
    if (result.ok) onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && (dismissibleWhileSubmitting || !submitting)) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {body !== undefined && <p className="text-sm text-muted-foreground">{body}</p>}
        {extraFields?.({ submitting })}
        <div>
          <Label htmlFor={reasonInputId}>{reasonLabel}</Label>
          <Textarea
            id={reasonInputId}
            className="mt-1"
            value={reason}
            disabled={disableFieldsWhileSubmitting && submitting}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
          />
        </div>
        {error && (
          <p className="text-xs text-destructive" role={errorRole}>
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant={confirmVariant}
            disabled={!reason.trim() || !canSubmit || submitting}
            onClick={() => void submit()}
          >
            {submitting ? submittingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
