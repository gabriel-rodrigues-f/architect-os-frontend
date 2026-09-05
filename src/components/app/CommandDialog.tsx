import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAsyncSubmit } from "@/hooks";
import { useI18n } from "@/lib/i18n";

/**
 * O irmão sem motivo de `CommandWithReasonDialog`: um comando que só pede
 * confirmação — devolver o acesso, ativar uma conta, desativar uma conta sem
 * profissional. Nasceu quando o terceiro diálogo com a mesma forma apareceu
 * em Usuários (regra: duas ocorrências viram componente).
 */
export function CommandDialog({
  title,
  body,
  confirmLabel,
  submittingLabel,
  cancelLabel,
  confirmVariant = "default",
  fallbackError,
  canSubmit = true,
  onSubmit,
  onClose,
}: {
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: string;
  submittingLabel: string;
  cancelLabel?: string;
  confirmVariant?: "default" | "destructive";
  fallbackError: string;
  canSubmit?: boolean;
  onSubmit: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { submitting, error, run } = useAsyncSubmit(fallbackError);

  const submit = async () => {
    const result = await run(onSubmit);
    if (result.ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {body !== undefined && <p className="text-sm text-muted-foreground">{body}</p>}
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant={confirmVariant}
            disabled={!canSubmit || submitting}
            onClick={() => void submit()}
          >
            {submitting ? submittingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
