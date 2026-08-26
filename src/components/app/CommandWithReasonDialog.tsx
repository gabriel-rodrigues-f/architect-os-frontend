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
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/**
 * OO3-11c — o esqueleto compartilhado dos comandos "com motivo obrigatório":
 * `CareerLevelTransitionDialog` e `DeactivateDialog` (`team-shared.tsx`) e
 * `ReopenPlanDialog` (`development-plans.tsx`) repetiam o mesmo ciclo
 * `reason` + `submitting` + `error` byte a byte, mudando só textos, campo
 * extra e variante do botão.
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
 * - sem `role="alert"` no erro (os originais não têm; adicionar seria
 *   comportamento novo — anotado como melhoria de a11y separada).
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
  extraFields?: (state: { submitting: boolean }) => ReactNode;
  onSubmit: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    setSubmitting(true);
    onSubmit(reason.trim())
      .then(() => {
        onClose();
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : fallbackError);
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
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
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant={confirmVariant}
            disabled={!reason.trim() || !canSubmit || submitting}
            onClick={submit}
          >
            {submitting ? submittingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
