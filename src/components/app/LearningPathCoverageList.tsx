import { Link } from "@tanstack/react-router";

import { OutOfReachNote } from "@/components/app/OutOfReachNote";
import { Bar, Callout, EmptyState, NameList } from "@/components/app/ui-bits";
import { useI18n } from "@/lib/i18n";
import type { MissingCompetencyView, RoadmapCoverage } from "@/lib/view-models";

/**
 * `pathsAreKnown` é a pergunta que faltava. A cobertura é calculada sobre as
 * trilhas DA PESSOA, uma listagem que passou a responder `200 []` a quem não
 * a alcança — e, com a lista vazia, TODA competência faltante caía em
 * "não coberta". A tela então ALERTAVA, em warning, que nenhuma trilha cobre
 * a pessoa, com a lista inteira de competências dela: uma afirmação forte
 * construída sobre silêncio. Sem saber as trilhas, não há cobertura a afirmar.
 */
export function LearningPathCoverageList({
  coverage,
  professionalId,
  pathsAreKnown,
}: {
  coverage: RoadmapCoverage;
  professionalId: string;
  pathsAreKnown: boolean;
}) {
  const { t } = useI18n();
  if (!pathsAreKnown) {
    return <OutOfReachNote subject="arch.outOfReach.subject.learningPaths" />;
  }
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
        <UncoveredCompetencies uncovered={coverage.uncovered} professionalId={professionalId} />
      )}
    </div>
  );
}

function UncoveredCompetencies({
  uncovered,
  professionalId,
}: {
  uncovered: readonly MissingCompetencyView[];
  professionalId: string;
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
        search={{ professionalId }}
        className="mt-2 inline-block text-primary underline"
      >
        {t("roadmap.coverage.createPdi")}
      </Link>
    </Callout>
  );
}
