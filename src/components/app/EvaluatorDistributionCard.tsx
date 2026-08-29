import { LevelDistribution } from "@/components/app/charts";
import { Callout, Initials, NameList } from "@/components/app/ui-bits";
import { useI18n } from "@/lib/i18n";
import type { EvaluatorCalibrationView, ScoreLevelRow } from "@/lib/view-models";

const signedAverage = (delta: number): string => `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`;

export function EvaluatorDistributionCard({
  view,
  scoreLevels,
}: {
  view: EvaluatorCalibrationView;
  scoreLevels: ScoreLevelRow[];
}) {
  const { t } = useI18n();
  return (
    <div data-evaluator-card className="surface-card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Initials name={view.name} />
          <div>
            <h3 className="font-display text-base font-semibold">{view.name}</h3>
            <p className="text-xs text-muted-foreground">
              <NameList names={view.teamIds} />
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("calibration.card.average")}
          </p>
          <p className="font-display text-xl font-semibold tabular-nums">
            {view.average === null ? "—" : view.average.toFixed(2)}
          </p>
          {view.delta !== null && (
            <p className="text-xs tabular-nums text-muted-foreground">
              {t("calibration.card.deltaVsOverall", { delta: signedAverage(view.delta) })}
            </p>
          )}
        </div>
      </div>
      <LevelDistribution data={scoreLevels} />
      <p className="text-xs text-muted-foreground">
        {view.itemsCount === 0
          ? t("calibration.card.noScores")
          : t("calibration.card.items", { n: view.itemsCount, m: view.assessmentsCount })}
      </p>
      {view.deviates && view.delta !== null && (
        <div role="status">
          <Callout tone="warning">
            {t("calibration.deviation.warning", { delta: signedAverage(view.delta) })}
          </Callout>
        </div>
      )}
    </div>
  );
}
