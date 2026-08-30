import { Badge } from "@/components/ui/badge";
import type { RequirementType } from "@/lib/domain";
import { useI18n } from "@/lib/i18n";

export function RequirementTypeBadge({ requirementType }: { requirementType: RequirementType }) {
  const { t } = useI18n();
  const required = requirementType === "RESTRICTIVE";
  return (
    <Badge variant={required ? "outline" : "secondary"}>
      {t(required ? "requirement.type.required" : "requirement.type.optional")}
    </Badge>
  );
}
