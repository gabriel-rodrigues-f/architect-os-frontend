import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  Callout,
  DataOriginCallout,
  EmptyState,
  EvaluatorDistributionCard,
  PageHeader,
  QuerySection,
  SingleSelectFilter,
  StatCard,
} from "@/components/app";
import { calibrationApi } from "@/lib/api";
import { useCurrentUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { requireCalibrationReach } from "@/lib/route-guards";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { useStore } from "@/lib/store";
import { CalibrationViewModel } from "@/lib/view-models";

export const Route = createFileRoute("/calibration")({
  head: () => ({
    meta: [
      { title: "Calibração — Synapse" },
      {
        name: "description",
        content:
          "Distribuição de notas por avaliador, lado a lado. Visível para gestores e administradores (CONTRATO PRD-03).",
      },
    ],
  }),
  beforeLoad: requireCalibrationReach,
  component: CalibrationPage,
});

function useCalibrationViewModel(): CalibrationViewModel {
  return useMemo(() => new CalibrationViewModel(), []);
}

const CARDS_SKELETON = (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    <div className="h-64 animate-pulse rounded-md bg-secondary" />
    <div className="h-64 animate-pulse rounded-md bg-secondary" />
    <div className="h-64 animate-pulse rounded-md bg-secondary" />
  </div>
);

function CalibrationPage() {
  const { t } = useI18n();
  const vm = useCalibrationViewModel();
  const store = useStore();
  const user = useCurrentUser();
  const canCalibrate = defaultUiAuthorizationPolicy.canCalibrate(user);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const cycleId = selectedCycleId ?? store.activeCycleId ?? store.cycles[0]?.id ?? null;

  const query = useQuery({
    queryKey: ["calibration", cycleId],
    queryFn: () => calibrationApi.calibration(cycleId ?? ""),
    enabled: canCalibrate && cycleId !== null,
  });

  if (!canCalibrate) {
    return (
      <>
        <PageHeader title={t("calibration.title")} description={t("calibration.description")} />
        <EmptyState title={t("calibration.restricted")} hint={t("calibration.restrictedHint")} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("calibration.title")} description={t("calibration.description")} />

      {cycleId === null ? (
        <EmptyState title={t("calibration.noCycle")} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <SingleSelectFilter
              id="calibration-cycle"
              label={t("calibration.cycle.label")}
              value={cycleId}
              onChange={setSelectedCycleId}
              options={store.cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
            />
          </div>

          <QuerySection
            query={query}
            skeleton={CARDS_SKELETON}
            errorMessage={t("calibration.error")}
          >
            {(data) => (
              <>
                <DataOriginCallout origin={data.dataOrigin} className="mb-6" />
                {data.evaluators.length === 0 ? (
                  (data.unattributed?.itemsCount ?? 0) > 0 ? (
                    <Callout tone="warning">
                      <strong>{t("calibration.unattributed.title")}</strong>{" "}
                      {t("calibration.unattributed.hint", {
                        n: data.unattributed?.itemsCount ?? 0,
                      })}
                    </Callout>
                  ) : (
                    <EmptyState title={t("calibration.empty")} hint={t("calibration.emptyHint")} />
                  )
                ) : (
                  <>
                    <div className="mb-6 grid gap-4 sm:grid-cols-3">
                      <StatCard
                        label={t("calibration.kpi.overallAverage")}
                        value={
                          data.overall.average === null ? "—" : data.overall.average.toFixed(2)
                        }
                      />
                      <StatCard
                        label={t("calibration.kpi.evaluators")}
                        value={String(data.evaluators.length)}
                      />
                      <StatCard
                        label={t("calibration.kpi.assessments")}
                        value={String(
                          data.evaluators.reduce((sum, entry) => sum + entry.assessmentsCount, 0),
                        )}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {vm.evaluators(data).map((view) => (
                        <EvaluatorDistributionCard
                          key={view.userId}
                          view={view}
                          scoreLevels={vm.scoreLevels(view.distribution)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </QuerySection>
        </>
      )}
    </>
  );
}
