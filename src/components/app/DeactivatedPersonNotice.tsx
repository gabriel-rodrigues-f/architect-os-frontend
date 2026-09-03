import { Link } from "@tanstack/react-router";

import { useI18n } from "@/lib/i18n";

export function DeactivatedPersonNotice({ active }: { active: boolean }) {
  const { t } = useI18n();
  if (active) return null;
  return (
    <div
      role="status"
      className="mb-6 rounded-md border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground"
    >
      {t("arch.deactivated.notice")}{" "}
      <Link to="/team" className="text-primary underline underline-offset-2">
        {t("arch.deactivated.action")}
      </Link>
    </div>
  );
}
