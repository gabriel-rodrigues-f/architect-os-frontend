import type { CareerLevel, Competency, LearningPath } from "../domain";
import type { ArchitectAdherence } from "../gateways/career.gateway";
import type { LearningPathsViewModel } from "./learning-paths-view-model";

export interface MissingCompetencyView {
  competencyId: string;
  name: string;
  currentLevel: number;
  requiredLevel: number;
  gap: number;
}

interface LearningPathCoverageView {
  pathId: string;
  name: string;
  covered: MissingCompetencyView[];
  progressPercent: number;
}

export interface RoadmapCoverage {
  paths: LearningPathCoverageView[];
  uncovered: MissingCompetencyView[];
}

export class CareerRoadmapViewModel {
  constructor(
    private readonly careerLevels: readonly CareerLevel[],
    private readonly competencyById: (id: string) => Competency | undefined,
    private readonly learningProgress: Pick<LearningPathsViewModel, "progressPercentFor">,
  ) {}

  levelOf(careerLevelId: string | null | undefined): CareerLevel | null {
    if (!careerLevelId) return null;
    return this.careerLevels.find((level) => level.id === careerLevelId) ?? null;
  }

  nextLevelFor(careerLevelId: string | null | undefined): CareerLevel | null {
    const current = this.levelOf(careerLevelId);
    if (!current) return null;
    const above = this.careerLevels
      .filter((level) => level.rank > current.rank)
      .sort((menor, maior) => menor.rank - maior.rank);
    return above[0] ?? null;
  }

  adherencePercent(adherence: ArchitectAdherence): number {
    return adherence.adherence.percentage * 100;
  }

  missingCompetencies(adherence: ArchitectAdherence): MissingCompetencyView[] {
    return adherence.adherence.missingCompetencies
      .map((missing) => ({
        competencyId: missing.competencyId,
        name: this.competencyById(missing.competencyId)?.name ?? missing.competencyId,
        currentLevel: missing.currentLevel,
        requiredLevel: missing.requiredLevel,
        gap: Math.max(0, missing.requiredLevel - missing.currentLevel),
      }))
      .sort((um, outro) => outro.gap - um.gap || um.name.localeCompare(outro.name));
  }

  coverageFor(
    architectId: string,
    missing: readonly MissingCompetencyView[],
    paths: readonly LearningPath[],
  ): RoadmapCoverage {
    const pathViews = paths
      .map((path) => ({
        pathId: path.id,
        name: path.name,
        covered: missing.filter((item) => path.competencyIds.includes(item.competencyId)),
        progressPercent: this.learningProgress.progressPercentFor(path, architectId),
      }))
      .filter((view) => view.covered.length > 0)
      .sort(
        (um, outro) =>
          outro.covered.length - um.covered.length || um.name.localeCompare(outro.name),
      );
    const coveredIds = new Set(
      pathViews.flatMap((view) => view.covered.map((item) => item.competencyId)),
    );
    return {
      paths: pathViews,
      uncovered: missing.filter((item) => !coveredIds.has(item.competencyId)),
    };
  }
}
