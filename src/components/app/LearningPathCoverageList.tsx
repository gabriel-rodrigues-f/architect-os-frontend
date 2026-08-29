import { Link } from "@tanstack/react-router";

import { Bar, Callout, EmptyState, NameList } from "@/components/app/ui-bits";
import { useI18n } from "@/lib/i18n";
import type { MissingCompetencyView, RoadmapCoverage } from "@/lib/view-models";

export function LearningPathCoverageList({
  coverage,
  architectId,
}: {
  coverage: RoadmapCoverage;
  architectId: string;
}) {
  const { t } = useI18n();
  if (coverage.paths.length === 0 && coverage.uncovered.length === 0) {
    return <EmptyState title={t("roadmap.coverage.nothingMissing")} />;
  }
  return (
    <div className="space-y-4">
      {coverage.paths.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("roadmap.coverage.noPaths")}</p>
      ) : (
        <ul className="space-y-3">
          {coverage.paths.map((path) => (
            <li key={path.pathId} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{path.name}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {t("roadmap.coverage.progress", { n: path.progressPercent })}
                </p>
              </div>
              <Bar value={path.progressPercent} className="mt-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                {t("roadmap.coverage.covers", { n: path.covered.length })}{" "}
                <NameList names={path.covered.map((item) => item.name)} />
              </p>
            </li>
          ))}
        </ul>
      )}
      {coverage.uncovered.length > 0 && (
        <UncoveredCompetencies uncovered={coverage.uncovered} architectId={architectId} />
      )}
    </div>
  );
}

function UncoveredCompetencies({
  uncovered,
  architectId,
}: {
  uncovered: readonly MissingCompetencyView[];
  architectId: string;
}) {
  const { t } = useI18n();
  return (
    <Callout tone="warning">
      <p className="font-medium">{t("roadmap.coverage.uncovered")}</p>
      <p className="mt-1">
        <NameList names={uncovered.map((item) => item.name)} />
      </p>
      <Link
        to="/development-plans"
        search={{ architectId }}
        className="mt-2 inline-block text-primary underline"
      >
        {t("roadmap.coverage.createPdi")}
      </Link>
    </Callout>
  );
}
