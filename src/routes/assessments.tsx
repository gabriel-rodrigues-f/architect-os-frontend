import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import { Callout, PageHeader, SectionCard, StatusBadge } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { ArchitectSelectCombobox } from "@/components/app/ArchitectSelectCombobox";
import { CapabilityCombobox } from "@/components/app/CapabilityCombobox";
import {
  assessmentStatusTone,
  CapabilityAssessmentCard,
  CareerPortfolioSection,
  DevelopmentSummarySection,
  useAssessmentPermissions,
} from "@/components/app/assessments-shared";
import type { Assessment } from "@/lib/domain";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { usePageHelp } from "@/lib/page-help";
import { useLabels } from "@/lib/labels";
import { useSelectors, useStore } from "@/lib/store";
import { useSearchParamString } from "@/hooks";

const assessmentsSearchSchema = z.object({
  architectId: z.string().optional(),
  cycleId: z.string().optional(),
});

export const Route = createFileRoute("/assessments")({
  validateSearch: assessmentsSearchSchema,
  head: () => ({
    meta: [
      { title: "Avaliações — Synapse" },
      {
        name: "description",
        content: "Autoavaliação, avaliação do Tech Lead, nível alvo e nível final por competência.",
      },
      { property: "og:title", content: "Avaliações — Synapse" },
      {
        property: "og:description",
        content: "Conduza assessments de competências com comentários do arquiteto e do Tech Lead.",
      },
    ],
  }),
  component: AssessmentsPage,
});

function AssessmentsPage() {
  const store = useStore();
  const sel = useSelectors();
  const [architectId, setArchitectId] = useSearchParamString(
    "architectId",
    () => sel.activeArchitects[0]?.id ?? "",
  );

  const [cycleId] = useSearchParamString("cycleId", () => store.activeCycleId);
  const isActiveCycle = cycleId === store.activeCycleId;
  const viewedCycle = store.cycles.find((c) => c.id === cycleId);
  const { t } = useI18n();
  const help = usePageHelp("assessments");
  const labels = useLabels();
  const [capabilityIds, setCapabilityIds] = useState<string[]>(() =>
    store.capabilities[0] ? [store.capabilities[0].id] : [],
  );
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const assessment = sel.assessmentFor(architectId, cycleId);
  const selectedArchitect = sel.architectById(architectId);

  const {
    isOwner,
    isLead,
    status,
    isCompleted,
    canEditSelf,
    canEditLeaderFinal,
    canSubmit,
    canComplete,
    canReopen,
    incompleteSelf,
    incompleteLeaderFinal,
  } = useAssessmentPermissions(architectId, selectedArchitect, assessment);

  const selected = store.capabilities.filter((c) => capabilityIds.includes(c.id));

  const toggleCapability = (id: string) =>
    setCapabilityIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const { data: eligibility } = useQuery({
    queryKey: ["assessment-eligibility", assessment?.id],
    queryFn: () => api.assessmentEligibility(assessment!.id),
    enabled: !!assessment,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const MANY_CAPABILITIES_THRESHOLD = 10;
  const manyCapabilitiesSelected = selected.length > MANY_CAPABILITIES_THRESHOLD;
  const [capabilityPage, setCapabilityPage] = useState(0);
  const capabilityIdsKey = capabilityIds.join(",");
  useEffect(() => {
    setCapabilityPage(0);
  }, [capabilityIdsKey]);
  const visibleCapabilities = manyCapabilitiesSelected
    ? selected.slice(capabilityPage, capabilityPage + 1)
    : selected;

  const transition = (nextStatus: Assessment["status"]) => {
    if (!assessment) return;
    setTransitionError(null);
    setTransitioning(true);
    const isReopen = status === "Completed" && nextStatus === "In Review";
    store
      .setAssessmentStatus(assessment.id, nextStatus)
      .catch((error: unknown) =>
        setTransitionError(
          error instanceof Error
            ? error.message
            : t(
                isReopen
                  ? "asmt.reopenError"
                  : nextStatus === "Completed"
                    ? "asmt.completeError"
                    : "asmt.submitError",
              ),
        ),
      )
      .finally(() => setTransitioning(false));
  };

  return (
    <>
      <PageHeader
        title={t("asmt.title")}
        description={t("asmt.subtitle")}
        help={help}
        actions={
          <div className="flex flex-wrap gap-2">
            <ArchitectSelectCombobox
              architects={sel.activeArchitects}
              inactiveArchitects={store.architects.filter((a) => !a.active)}
              selectedId={architectId}
              onChange={setArchitectId}
              label={t("asmt.architect")}
              className="w-48"
            />
            <CapabilityCombobox
              capabilities={store.capabilities}
              selected={selected}
              onToggle={toggleCapability}
              onSelectAll={setCapabilityIds}
            />
            {eligibility && eligibility.capabilities.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCapabilityIds(eligibility.capabilities.map((c) => c.capabilityId))
                }
              >
                {t("asmt.selectPortfolio")}
              </Button>
            )}
          </div>
        }
      />

      {!isActiveCycle && (
        <p className="mb-3 text-xs text-muted-foreground">
          {t("asmt.historicalCycle", { cycle: viewedCycle?.name ?? cycleId })}
        </p>
      )}

      {assessment && (
        <div className="mb-4 flex flex-wrap items-center gap-3 surface-inset px-3 py-2 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("asmt.status")}
          </span>
          <StatusBadge
            tone={assessmentStatusTone[assessment.status]}
            label={labels.assessmentStatus[assessment.status]}
          />
          {isCompleted && <span className="text-xs text-muted-foreground">{t("asmt.locked")}</span>}
          <div className="ml-auto flex items-center gap-2">
            {canSubmit && (
              <Button
                size="sm"
                disabled={transitioning || incompleteSelf}
                title={incompleteSelf ? t("asmt.incompleteSelf") : undefined}
                onClick={() => transition("In Review")}
              >
                {transitioning ? t("asmt.submitting") : t("asmt.submit")}
              </Button>
            )}
            {canComplete && (
              <Button
                size="sm"
                variant="secondary"
                disabled={transitioning || incompleteLeaderFinal}
                title={incompleteLeaderFinal ? t("asmt.incompleteLeaderFinal") : undefined}
                onClick={() => transition("Completed")}
              >
                {transitioning ? t("asmt.completing") : t("asmt.complete")}
              </Button>
            )}
            {canReopen && (
              <Button
                size="sm"
                variant="outline"
                disabled={transitioning}
                onClick={() => transition("In Review")}
              >
                {transitioning ? t("asmt.reopening") : t("asmt.reopen")}
              </Button>
            )}
          </div>
          {canSubmit && incompleteSelf && (
            <p className="w-full text-xs text-muted-foreground">{t("asmt.incompleteSelf")}</p>
          )}
          {canComplete && incompleteLeaderFinal && (
            <p className="w-full text-xs text-muted-foreground">
              {t("asmt.incompleteLeaderFinal")}
            </p>
          )}
          {transitionError && (
            <p className="w-full text-xs text-destructive" role="alert">
              {transitionError}
            </p>
          )}
        </div>
      )}

      {assessment && (
        <CareerPortfolioSection assessment={assessment} isOwner={isOwner} isLead={isLead} />
      )}

      {assessment && (
        <DevelopmentSummarySection assessment={assessment} isOwner={isOwner} isLead={isLead} />
      )}

      {!assessment ? (
        <SectionCard
          title={t("asmt.noAssessment.title")}
          description={t("asmt.noAssessment.subtitle")}
        >
          {store.architects.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("asmt.noAssessment.noArchitects")}</p>
          ) : selectedArchitect && !selectedArchitect.active ? (
            <p className="text-sm text-muted-foreground">{t("asmt.noAssessment.inactive")}</p>
          ) : !isActiveCycle ? (
            <p className="text-sm text-muted-foreground">
              {t("asmt.noAssessment.historicalCycle", { cycle: viewedCycle?.name ?? cycleId })}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("asmt.noAssessment.openExplain")}</p>
              {openError && <p className="mt-2 text-sm text-destructive">{openError}</p>}
              <Button
                className="mt-4"
                disabled={opening || !architectId || !store.activeCycleId}
                onClick={() => {
                  setOpenError(null);
                  setOpening(true);
                  store
                    .openAssessment(architectId, store.activeCycleId)
                    .catch((error: unknown) =>
                      setOpenError(error instanceof Error ? error.message : t("asmt.openError")),
                    )
                    .finally(() => setOpening(false));
                }}
              >
                {opening ? t("asmt.opening") : t("asmt.open")}
              </Button>
            </>
          )}
        </SectionCard>
      ) : selected.length === 0 ? (
        <SectionCard title={t("asmt.noCapability")}>
          <p className="text-sm text-muted-foreground">{t("asmt.pickCapability")}</p>
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {manyCapabilitiesSelected && (
            <Callout tone="warning" className="flex flex-wrap items-center justify-between gap-3">
              <p>{t("asmt.manyCapabilities.warning", { n: selected.length })}</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={capabilityPage === 0}
                  onClick={() => setCapabilityPage((p) => p - 1)}
                >
                  {t("asmt.manyCapabilities.prev")}
                </Button>
                <select
                  aria-label={t("asmt.manyCapabilities.jump")}
                  className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
                  value={capabilityPage}
                  onChange={(e) => setCapabilityPage(Number(e.target.value))}
                >
                  {selected.map((cat, index) => (
                    <option key={cat.id} value={index}>
                      {t("asmt.manyCapabilities.position", {
                        current: index + 1,
                        total: selected.length,
                      })}{" "}
                      — {cat.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={capabilityPage >= selected.length - 1}
                  onClick={() => setCapabilityPage((p) => p + 1)}
                >
                  {t("asmt.manyCapabilities.next")}
                </Button>
              </div>
            </Callout>
          )}
          {visibleCapabilities.map((cat) => (
            <CapabilityAssessmentCard
              key={cat.id}
              capability={cat}
              assessment={assessment}
              status={status}
              canEditSelf={canEditSelf}
              canEditLeaderFinal={canEditLeaderFinal}
              architectId={architectId}
              openComment={openComment}
              onToggleComment={(id) => setOpenComment((prev) => (prev === id ? null : id))}
            />
          ))}
        </div>
      )}
    </>
  );
}
