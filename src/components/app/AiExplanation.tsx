import { Sparkles } from "lucide-react";

import { useI18n } from "@/lib/i18n";

export function AiExplanation({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles aria-hidden="true" className="size-3.5" />
        {t("ai.explanation.badge")}
      </p>
      <p className="mt-2 max-w-prose text-sm">{text}</p>
      <p className="mt-2 max-w-prose text-xs text-muted-foreground">
        {t("ai.explanation.disclosure")}
      </p>
    </div>
  );
}
