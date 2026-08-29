import { calibrationResponseSchema } from "../api-schemas";
import type { ApiClient } from "../api-client";

export type LevelDistribution = Record<"1" | "2" | "3" | "4" | "5", number>;

export interface CalibrationEvaluator {
  userId: string;
  name: string;
  teamIds: string[];
  distribution: LevelDistribution;
  average: number | null;
  itemsCount: number;
  assessmentsCount: number;
}

export interface CalibrationSnapshot {
  cycleId: string;
  overall: {
    distribution: LevelDistribution;
    average: number | null;
  };
  evaluators: CalibrationEvaluator[];
}

export interface CalibrationGateway {
  calibration(cycleId: string): Promise<CalibrationSnapshot>;
}

export class HttpCalibrationGateway implements CalibrationGateway {
  constructor(private readonly client: ApiClient) {}

  calibration = (cycleId: string): Promise<CalibrationSnapshot> => {
    const query = new URLSearchParams({ cycleId });
    return this.client
      .request<CalibrationSnapshot>(`/calibration?${query.toString()}`)
      .then((data) => calibrationResponseSchema.parse(data));
  };
}

export class InMemoryCalibrationGateway implements CalibrationGateway {
  private readonly evaluators: CalibrationEvaluator[];

  constructor(evaluators?: CalibrationEvaluator[]) {
    this.evaluators = evaluators ?? InMemoryCalibrationGateway.fixtureEvaluators();
  }

  calibration = (cycleId: string): Promise<CalibrationSnapshot> => {
    const distribution = InMemoryCalibrationGateway.sumDistributions(
      this.evaluators.map((entry) => entry.distribution),
    );
    return Promise.resolve({
      cycleId,
      overall: { distribution, average: InMemoryCalibrationGateway.averageOf(distribution) },
      evaluators: this.evaluators.map((entry) => ({ ...entry, teamIds: [...entry.teamIds] })),
    });
  };

  private static distributionOf(
    counts: [number, number, number, number, number],
  ): LevelDistribution {
    return { "1": counts[0], "2": counts[1], "3": counts[2], "4": counts[3], "5": counts[4] };
  }

  private static averageOf(distribution: LevelDistribution): number | null {
    const entries = Object.entries(distribution);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    if (total === 0) return null;
    const weighted = entries.reduce((sum, [levelKey, count]) => sum + Number(levelKey) * count, 0);
    return weighted / total;
  }

  private static sumDistributions(
    distributions: readonly LevelDistribution[],
  ): LevelDistribution {
    return distributions.reduce(
      (accumulated, current) => ({
        "1": accumulated["1"] + current["1"],
        "2": accumulated["2"] + current["2"],
        "3": accumulated["3"] + current["3"],
        "4": accumulated["4"] + current["4"],
        "5": accumulated["5"] + current["5"],
      }),
      InMemoryCalibrationGateway.distributionOf([0, 0, 0, 0, 0]),
    );
  }

  private static itemsCountOf(distribution: LevelDistribution): number {
    return Object.values(distribution).reduce((sum, count) => sum + count, 0);
  }

  private static evaluatorFixture(
    userId: string,
    name: string,
    teamIds: string[],
    counts: [number, number, number, number, number],
    assessmentsCount: number,
  ): CalibrationEvaluator {
    const distribution = InMemoryCalibrationGateway.distributionOf(counts);
    return {
      userId,
      name,
      teamIds,
      distribution,
      average: InMemoryCalibrationGateway.averageOf(distribution),
      itemsCount: InMemoryCalibrationGateway.itemsCountOf(distribution),
      assessmentsCount,
    };
  }

  private static fixtureEvaluators(): CalibrationEvaluator[] {
    return [
      InMemoryCalibrationGateway.evaluatorFixture(
        "evaluator-lenient",
        "Marina Lopes",
        ["team-integration"],
        [0, 1, 4, 9, 6],
        4,
      ),
      InMemoryCalibrationGateway.evaluatorFixture(
        "evaluator-central",
        "Ricardo Nunes",
        ["team-architecture"],
        [1, 3, 8, 3, 1],
        3,
      ),
      InMemoryCalibrationGateway.evaluatorFixture(
        "evaluator-severe",
        "Paula Souza",
        ["team-platform"],
        [4, 7, 4, 1, 0],
        3,
      ),
    ];
  }
}
