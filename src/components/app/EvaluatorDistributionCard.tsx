import { CardHelp } from "@/components/app/CardHelp";
import { LevelDistribution } from "@/components/app/charts";
import { SectionHeading } from "@/components/app/SectionHeading";
import { Callout, Initials, NameList } from "@/components/app/ui-bits";
import { useI18n } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import type { EvaluatorCalibrationView, ScoreLevelRow } from "@/lib/view-models";

/**
 * O cartão de UM avaliador — e, desde a fatia CALIBRAÇÃO, o cartão que se
 * explica.
 *
 * Quatro coisas estavam implícitas e agora estão escritas: o eixo conta NOTAS
 * (não mede nota), L1…L5 é nível de PROFICIÊNCIA, o "vs geral" compara contra
 * um número que a tela agora mostra, e a linha de contagem é o PESO deste
 * avaliador — três avaliações não pesam como uma. O limiar que acende o aviso
 * era a única régua da tela que só existia no código.
 */
export function EvaluatorDistributionCard({
  view,
  scoreLevels,
  overallAverageLabel,
  thresholdLabel,
}: {
  view: EvaluatorCalibrationView;
  scoreLevels: ScoreLevelRow[];
  overallAverageLabel: string | null;
  thresholdLabel: string;
}) {
  const { t } = useI18n();
  const labels = useLabels();
  const chartTitle = t("calibration.card.help.title");
  return (
    <div data-evaluator-card className="surface-card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Initials name={view.name} />
          <div>
            <h3 className="font-display text-subtitle font-semibold">{view.name}</h3>
            <p className="text-label text-muted-foreground">
              {/* O NOME do time. O identificador interno não chega aqui. */}
              <NameList names={view.teamNames} />
            </p>
          </div>
        </div>
        <div className="flex items-start gap-1">
          <div className="text-right">
            <SectionHeading as="p" muted>
              {t("calibration.card.average")}
            </SectionHeading>
            <p className="font-display text-section font-semibold tabular-nums">
              {view.average === null ? "—" : view.average.toFixed(2)}
            </p>
            {view.deltaLabel !== null && overallAverageLabel !== null && (
              <p className="text-label tabular-nums text-muted-foreground">
                {t("calibration.card.deltaVsOverall", {
                  delta: view.deltaLabel,
                  overall: overallAverageLabel,
                })}
              </p>
            )}
          </div>
          <CardHelp
            title={chartTitle}
            what={t("calibration.card.help.what")}
            how={t("calibration.card.help.how", { threshold: thresholdLabel })}
          />
        </div>
      </div>
      <LevelDistribution data={scoreLevels} />
      <p className="text-label text-muted-foreground">{t("calibration.card.axes")}</p>
      <p className="text-label text-muted-foreground">
        {view.itemsCount === 0
          ? t("calibration.card.noScores")
          : t("calibration.card.items", { n: view.itemsCount, m: view.assessmentsCount })}
      </p>
      {view.deviates && view.deltaLabel !== null && (
        <div role="status">
          <Callout tone="warning">
            <p>
              {t("calibration.deviation.warning", {
                name: view.name,
                delta: view.deltaLabel,
                threshold: thresholdLabel,
              })}
            </p>
            {view.standoutLevel !== null && (
              <p className="mt-1">
                {t("calibration.deviation.recheck", {
                  n: view.standoutCount,
                  level: t("level.scale.item", {
                    n: view.standoutLevel,
                    nome: labels.levelName[view.standoutLevel],
                  }),
                })}
              </p>
            )}
          </Callout>
        </div>
      )}
    </div>
  );
}
