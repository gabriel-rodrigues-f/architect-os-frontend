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

const distributionOf = (counts: [number, number, number, number, number]): LevelDistribution => ({
  "1": counts[0],
  "2": counts[1],
  "3": counts[2],
  "4": counts[3],
  "5": counts[4],
});

const averageOf = (distribution: LevelDistribution): number | null => {
  const entries = Object.entries(distribution);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return null;
  const weighted = entries.reduce((sum, [levelKey, count]) => sum + Number(levelKey) * count, 0);
  return weighted / total;
};

const sumDistributions = (distributions: readonly LevelDistribution[]): LevelDistribution =>
  distributions.reduce(
    (accumulated, current) => ({
      "1": accumulated["1"] + current["1"],
      "2": accumulated["2"] + current["2"],
      "3": accumulated["3"] + current["3"],
      "4": accumulated["4"] + current["4"],
      "5": accumulated["5"] + current["5"],
    }),
    distributionOf([0, 0, 0, 0, 0]),
  );

const itemsCountOf = (distribution: LevelDistribution): number =>
  Object.values(distribution).reduce((sum, count) => sum + count, 0);

const evaluatorFixture = (
  userId: string,
  name: string,
  teamIds: string[],
  counts: [number, number, number, number, number],
  assessmentsCount: number,
): CalibrationEvaluator => {
  const distribution = distributionOf(counts);
  return {
    userId,
    name,
    teamIds,
    distribution,
    average: averageOf(distribution),
    itemsCount: itemsCountOf(distribution),
    assessmentsCount,
  };
};

const fixtureEvaluators = (): CalibrationEvaluator[] => [
  evaluatorFixture("evaluator-lenient", "Marina Lopes", ["team-integration"], [0, 1, 4, 9, 6], 4),
  evaluatorFixture("evaluator-central", "Ricardo Nunes", ["team-architecture"], [1, 3, 8, 3, 1], 3),
  evaluatorFixture("evaluator-severe", "Paula Souza", ["team-platform"], [4, 7, 4, 1, 0], 3),
];

export class InMemoryCalibrationGateway implements CalibrationGateway {
  private readonly evaluators: CalibrationEvaluator[];

  constructor(evaluators: CalibrationEvaluator[] = fixtureEvaluators()) {
    this.evaluators = evaluators;
  }

  calibration = (cycleId: string): Promise<CalibrationSnapshot> => {
    const distribution = sumDistributions(this.evaluators.map((entry) => entry.distribution));
    return Promise.resolve({
      cycleId,
      overall: { distribution, average: averageOf(distribution) },
      evaluators: this.evaluators.map((entry) => ({ ...entry, teamIds: [...entry.teamIds] })),
    });
  };
}
