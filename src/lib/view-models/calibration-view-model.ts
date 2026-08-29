import type {
  CalibrationEvaluator,
  CalibrationSnapshot,
  LevelDistribution,
} from "../gateways/calibration.gateway";
import type { Level } from "../domain";

export interface EvaluatorCalibrationView extends CalibrationEvaluator {
  delta: number | null;
  deviates: boolean;
}

export interface ScoreLevelRow {
  level: Level;
  count: number;
}

const SCORE_LEVELS: readonly Level[] = [1, 2, 3, 4, 5];

export class CalibrationViewModel {
  static readonly DEVIATION_ALERT_THRESHOLD = 0.5;

  evaluators(snapshot: CalibrationSnapshot): EvaluatorCalibrationView[] {
    return snapshot.evaluators
      .map((evaluator) => {
        const delta =
          evaluator.average === null || snapshot.overall.average === null
            ? null
            : evaluator.average - snapshot.overall.average;
        return {
          ...evaluator,
          delta,
          deviates:
            delta !== null && Math.abs(delta) >= CalibrationViewModel.DEVIATION_ALERT_THRESHOLD,
        };
      })
      .sort(
        (left, right) =>
          this.deviationWeight(right) - this.deviationWeight(left) ||
          left.name.localeCompare(right.name),
      );
  }

  private deviationWeight(view: Pick<EvaluatorCalibrationView, "delta">): number {
    return view.delta === null ? -1 : Math.abs(view.delta);
  }

  scoreLevels(distribution: LevelDistribution): ScoreLevelRow[] {
    return SCORE_LEVELS.map((level) => ({
      level,
      count: distribution[String(level) as keyof LevelDistribution],
    }));
  }
}
