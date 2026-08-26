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

  cancelLabel?: string;
  confirmVariant?: "default" | "destructive";
  fallbackError: string;
  canSubmit?: boolean;

  dismissibleWhileSubmitting?: boolean;

  disableFieldsWhileSubmitting?: boolean;
  errorRole?: "alert";
  extraFields?: (state: { submitting: boolean }) => ReactNode;
  onSubmit: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");

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
