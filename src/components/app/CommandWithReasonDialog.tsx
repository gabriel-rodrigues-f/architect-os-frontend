import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { CommandVariant, type CommandVariantName } from "@/components/app/CommandVariant";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Callout } from "@/components/app/ui-bits";
import { useAsyncSubmit } from "@/hooks";
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
  confirmVariant = "primary",
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
  confirmVariant?: CommandVariantName;
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
        {body !== undefined && <p className="text-body text-muted-foreground">{body}</p>}
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
          <Callout tone="danger" compact role={errorRole}>
            {error}
          </Callout>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant={CommandVariant.of(confirmVariant)}
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
