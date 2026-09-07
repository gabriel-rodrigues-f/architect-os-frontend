import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { SupportAccess } from "@/lib/support-access";

/**
 * O MODO DE SUPORTE (revisão de papéis, 2026-09-05, D1): o administrador não
 * abre a ficha de alguém sem dizer por quê. O motivo vai em cada requisição,
 * fica no audit_log e o time é avisado — é o preço declarado do passe.
 */
export function SupportAccessDialog({
  architectId,
  personName,
  onGranted,
  onCancel,
}: {
  architectId: string;
  personName: string;
  onGranted: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const longEnough = reason.trim().length >= SupportAccess.MIN_REASON_LENGTH;

  return (
    <div
      className="surface-card mx-auto max-w-xl p-6"
      role="dialog"
      aria-labelledby="support-title"
    >
      <h1 id="support-title" className="font-display text-section font-semibold">
        {t("support.dialog.title")}
      </h1>
      <p className="mt-2 text-body text-muted-foreground">
        {t("support.dialog.lead", { nome: personName })}
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (SupportAccess.grant(architectId, reason)) onGranted();
        }}
      >
        <div>
          <Label htmlFor="support-reason">{t("support.dialog.reason")}</Label>
          <Textarea
            id="support-reason"
            rows={3}
            className="mt-1"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="mt-1 text-label text-muted-foreground">{t("support.dialog.reasonHint")}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("support.dialog.cancel")}
          </Button>
          <Button type="submit" disabled={!longEnough}>
            {t("support.dialog.confirm")}
          </Button>
        </div>
      </form>
    </div>
  );
}
