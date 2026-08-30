import { useMemo } from "react";

import { Callout } from "@/components/app/ui-bits";
import { DataOriginPolicy, type DataOrigin } from "@/lib/gateways/data-origin";
import { useI18n } from "@/lib/i18n";

export function DataOriginCallout({
  origin,
  className = "",
}: {
  origin: DataOrigin;
  className?: string;
}) {
  const { t } = useI18n();
  const policy = useMemo(() => new DataOriginPolicy(), []);
  if (!policy.requiresDisclosure(origin)) return null;
  return (
    <Callout tone="warning" className={className}>
      {t("dataOrigin.demonstration")}
    </Callout>
  );
}
