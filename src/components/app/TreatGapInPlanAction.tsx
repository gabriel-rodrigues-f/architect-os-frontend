import { Link } from "@tanstack/react-router";

import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { PlanWorkflowPolicy } from "@/lib/plan-workflow-policy";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useSelectors } from "@/lib/store";
import { cn } from "@/lib/utils";

const SHAPE = "whitespace-nowrap text-xs";

export function TreatGapInPlanAction({
  professionalId,
  competencyId,
  label,
}: {
  professionalId: string | undefined;
  competencyId: string;
  label: string;
}) {
  const user = useCurrentUser();
  const sel = useSelectors();
  const { t } = useI18n();
  const professional =
    professionalId === undefined ? undefined : sel.professionalById(professionalId);
  const workflow = PlanWorkflowPolicy.forPlan(
    professionalId === undefined ? undefined : sel.planFor(professionalId),
    {
      actsForProfessional: defaultUiAuthorizationPolicy.canActFor(user, professional),
      isLeadOfProfessional: defaultUiAuthorizationPolicy.isLeadOf(user, professional),
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
      search={{ professionalId, competencyId }}
      className={cn(SHAPE, "text-primary hover:underline")}
    >
      {label}
    </Link>
  );
}
