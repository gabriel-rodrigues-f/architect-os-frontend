import { Link } from "@tanstack/react-router";

import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { PlanWorkflowPolicy } from "@/lib/plan-workflow-policy";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useSelectors } from "@/lib/store";
import { cn } from "@/lib/utils";

const SHAPE = "whitespace-nowrap text-xs";

export function TreatGapInPlanAction({
  architectId,
  competencyId,
  label,
}: {
  architectId: string | undefined;
  competencyId: string;
  label: string;
}) {
  const user = useCurrentUser();
  const sel = useSelectors();
  const { t } = useI18n();
  const architect = architectId === undefined ? undefined : sel.architectById(architectId);
  const workflow = PlanWorkflowPolicy.forPlan(
    architectId === undefined ? undefined : sel.planFor(architectId),
    {
      actsForArchitect: defaultUiAuthorizationPolicy.canActFor(user, architect),
      isLeadOfArchitect: defaultUiAuthorizationPolicy.isLeadOf(user, architect),
      isAssignedTechLead: defaultUiAuthorizationPolicy.isAssignedTechLeadOf(user, architect),
    },
  );
  const blockedReasonKey = workflow.newActionBlockedReasonKey;

  if (blockedReasonKey) {
    return (
      <button
        type="button"
        disabled
        title={t(blockedReasonKey)}
        className={cn(SHAPE, "cursor-not-allowed text-muted-foreground")}
      >
        {label}
      </button>
    );
  }

  return (
    <Link
      to="/development-plans"
      search={{ architectId, competencyId }}
      className={cn(SHAPE, "text-primary hover:underline")}
    >
      {label}
    </Link>
  );
}
