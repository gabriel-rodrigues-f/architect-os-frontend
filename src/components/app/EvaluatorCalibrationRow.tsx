import { CardHelp } from "@/components/app/CardHelp";
import { LevelDistributionStrip } from "@/components/app/charts";
import { SectionHeading } from "@/components/app/SectionHeading";
import { Callout, Initials, NameList } from "@/components/app/ui-bits";
import { useI18n } from "@/lib/i18n";
import { useLabels } from "@/lib/labels";
import type { EvaluatorCalibrationView, ScoreLevelRow } from "@/lib/view-models";

/**
 * A GRADE DA LINHA, e a mesma grade do cabeçalho de colunas.
 *
 * Ela mora aqui, num literal só, por dois motivos. O primeiro é o Tailwind v4,
 * que só compila a classe que enxerga inteira no fonte — grade montada por
 * string não existe em tela. O segundo é que cabeçalho e linha PRECISAM medir
 * igual: duas grades escritas em dois arquivos concordam por sorte até o dia
 * em que uma coluna muda de largura e os rótulos deixam de ficar sobre os
 * campos que nomeiam.
 *
 * Em tela estreita a linha vira empilhamento (`grid-cols-1`): cinco campos
 * espremidos em 360 px não são densidade, são ilegibilidade.
 */
export const EVALUATOR_ROW_GRID =
  "grid grid-cols-1 items-center gap-4 " +
  "lg:grid-cols-[minmax(9rem,1.4fr)_6rem_minmax(0,3fr)_4rem_4rem]";

/**
 * A LINHA DE UM AVALIADOR — dono, 2026-09-10, com referência visual: *"Não
 * transformar cada avaliador em um grande dashboard individual. A prioridade é
 * comparação, densidade e leitura rápida."*
 *
 * Até aqui cada avaliador era um CARTÃO numa grade de até três colunas. Numa
 * coluna de 320 px a distribuição fica estreita, e duas distribuições nunca
 * ficam lado a lado na mesma altura da tela — que é a única forma de comparar
 * réguas. É o mesmo movimento do cartão de distância do PDI (`93bef69`), pelo
 * mesmo motivo: coluna estreita mata comparação.
 *
 * Os campos são os que ele escreveu, nesta ordem: avaliador · média e desvio ·
 * distribuição L1–L5 · total de notas · avaliações.
 *
 * O que SAIU da linha e não sumiu do produto: a frase dos eixos, a frase do
 * peso e o "?" de como ler. Repetidos por avaliador eram exatamente o ruído
 * que ele recusou; passaram para o cabeçalho de colunas, onde são ditos UMA
 * vez para a tela inteira.
 *
 * O que FICOU na linha: o aviso de desvio. Ele não é decoração — nomeia com
 * quem conversar e quantas notas reconferir, em qual degrau — e só aparece em
 * quem passa do limiar, que são poucas linhas.
 */
export function EvaluatorCalibrationRow({
  view,
  scoreLevels,
  ceiling,
  overallAverageLabel,
  thresholdLabel,
}: {
  view: EvaluatorCalibrationView;
  scoreLevels: ScoreLevelRow[];
  /** O teto COMUM das barras — a escala é da tela, não da linha. */
  ceiling: number;
  overallAverageLabel: string | null;
  thresholdLabel: string;
}) {
  const { t } = useI18n();
  const labels = useLabels();
  const semNota = view.itemsCount === 0;

  return (
    <li data-evaluator-row className="border-b border-border px-1 py-3 last:border-b-0">
      <div className={EVALUATOR_ROW_GRID}>
        <div data-testid="evaluator-name" className="flex min-w-0 items-center gap-2">
          <Initials name={view.name} />
          <div className="min-w-0">
            <h3 className="truncate font-display text-body font-semibold">{view.name}</h3>
            <p className="truncate text-meta text-muted-foreground">
              {/* O NOME do time. O identificador interno não chega aqui. */}
              <NameList names={view.teamNames} max={2} />
            </p>
          </div>
        </div>

        <div data-testid="evaluator-average" className="tabular-nums">
          <p className="font-display text-section font-semibold tabular-nums">
            {view.average === null ? "—" : view.average.toFixed(2)}
          </p>
          {view.deltaLabel !== null && overallAverageLabel !== null && (
            <p className="text-meta tabular-nums text-muted-foreground">
              {t("calibration.card.deltaVsOverall", {
                delta: view.deltaLabel,
                overall: overallAverageLabel,
              })}
            </p>
          )}
        </div>

        {/*
         * Ausência NÃO é zero. Cinco barras rentes ao chão afirmariam "este
         * avaliador deu zero notas em cada degrau"; quem não avaliou ninguém
         * não tem distribuição nenhuma para desenhar, e a linha diz isso.
         */}
        <div data-testid="evaluator-distribution" className="min-w-0">
          {semNota ? (
            <p className="text-meta text-muted-foreground">{t("calibration.card.noScores")}</p>
          ) : (
            <LevelDistributionStrip data={scoreLevels} ceiling={ceiling} />
          )}
        </div>

        <p
          data-testid="evaluator-items"
          className="font-display text-subtitle font-semibold tabular-nums lg:text-right"
        >
          {view.itemsCount}
        </p>
        <p
          data-testid="evaluator-assessments"
          className="font-display text-subtitle font-semibold tabular-nums lg:text-right"
        >
          {view.assessmentsCount}
        </p>
      </div>

      {view.deviates && view.deltaLabel !== null && (
        <div role="status" className="mt-2">
          <Callout tone="warning">
            <p className="text-meta">
              {t("calibration.deviation.warning", {
                name: view.name,
                delta: view.deltaLabel,
                threshold: thresholdLabel,
              })}{" "}
              {view.standoutLevel !== null &&
                t("calibration.deviation.recheck", {
                  n: view.standoutCount,
                  level: t("level.scale.item", {
                    n: view.standoutLevel,
                    nome: labels.levelName[view.standoutLevel],
                  }),
                })}
            </p>
          </Callout>
        </div>
      )}
    </li>
  );
}

/**
 * O CABEÇALHO DAS COLUNAS — os rótulos que a linha não repete.
 *
 * Ele carrega também as três explicações que saíram de dentro de cada
 * avaliador: o que o eixo conta, o que é L1…L5 e como ler o desvio. Ditas uma
 * vez, valem para as trinta linhas abaixo; ditas trinta vezes, eram o "grande
 * dashboard individual" que o dono recusou.
 */
export function EvaluatorCalibrationHeader({ thresholdLabel }: { thresholdLabel: string }) {
  const { t } = useI18n();
  return (
    <>
      <p className="mb-2 text-meta text-muted-foreground">
        {t("calibration.card.axes")} {t("calibration.column.weight")}
      </p>
      <div className={`${EVALUATOR_ROW_GRID} border-b border-border px-1 pb-2`}>
        <SectionHeading as="p" muted>
          {t("calibration.column.evaluator")}
        </SectionHeading>
        <SectionHeading as="p" muted>
          {t("calibration.column.average")}
        </SectionHeading>
        <div className="flex items-center gap-1">
          <SectionHeading as="p" muted>
            {t("calibration.column.distribution")}
          </SectionHeading>
          <CardHelp
            title={t("calibration.card.help.title")}
            what={t("calibration.card.help.what")}
            how={t("calibration.card.help.how", { threshold: thresholdLabel })}
          />
        </div>
        <SectionHeading as="p" muted className="lg:text-right">
          {t("calibration.column.items")}
        </SectionHeading>
        <SectionHeading as="p" muted className="lg:text-right">
          {t("calibration.column.assessments")}
        </SectionHeading>
      </div>
    </>
  );
}
