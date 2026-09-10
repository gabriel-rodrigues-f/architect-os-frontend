import type {
  CalibrationEvaluator,
  CalibrationSnapshot,
  LevelDistribution,
} from "../gateways/calibration.gateway";
import type { Level } from "../domain";
import { TeamNames } from "./team-names";

export interface EvaluatorCalibrationView extends CalibrationEvaluator {
  delta: number | null;
  deltaLabel: string | null;
  deviates: boolean;
  /** O time por NOME. O identificador interno não chega à tela (ver `TeamNames`). */
  teamNames: string[];
  /**
   * O degrau em que ESTA distribuição mais se afasta da do ciclo — a resposta
   * a "o que eu reconfiro com esta pessoa?". A média sozinha diz que há
   * diferença; o degrau diz ONDE ela nasce, e é o que cabe numa conversa.
   */
  standoutLevel: Level | null;
  standoutCount: number;
}

export interface ScoreLevelRow {
  level: Level;
  count: number;
}

const SCORE_LEVELS: readonly Level[] = [1, 2, 3, 4, 5];

export class CalibrationViewModel {
  static readonly DEVIATION_ALERT_THRESHOLD = 0.5;

  /**
   * A lista de times entra pelo construtor porque ela é CONTEXTO da leitura,
   * não parâmetro de cada cálculo: a mesma tela responde sobre os mesmos
   * times o tempo todo. Sem ela (fixture, teste de cálculo, lista ainda
   * carregando) o nome do time simplesmente não existe — e é melhor não
   * existir do que voltar a ser identificador.
   */
  constructor(private readonly teams: TeamNames = TeamNames.of([])) {}

  evaluators(snapshot: CalibrationSnapshot): EvaluatorCalibrationView[] {
    return snapshot.evaluators
      .map((evaluator) => {
        const delta =
          evaluator.average === null || snapshot.overall.average === null
            ? null
            : evaluator.average - snapshot.overall.average;
        const standout = this.standoutOf(evaluator.distribution, snapshot.overall.distribution);
        return {
          ...evaluator,
          delta,
          deltaLabel: this.deltaLabel(delta),
          deviates:
            delta !== null && Math.abs(delta) >= CalibrationViewModel.DEVIATION_ALERT_THRESHOLD,
          teamNames: this.teams.allOf(evaluator.teamIds),
          standoutLevel: standout.level,
          standoutCount: standout.count,
        };
      })
      .sort(
        (left, right) =>
          this.deviationWeight(right) - this.deviationWeight(left) ||
          left.name.localeCompare(right.name),
      );
  }

  /** O número contra o qual o "vs" compara — a tela dizia "vs geral" sem dizê-lo. */
  overallAverageLabel(snapshot: CalibrationSnapshot): string | null {
    return snapshot.overall.average === null ? null : snapshot.overall.average.toFixed(2);
  }

  /**
   * O limiar que acende o aviso, na mesma casa decimal dos outros números da
   * tela. Ele existia só no código: quem via `−0.55` acender e `−0.03` não
   * ficava sem a régua que separa os dois.
   */
  thresholdLabel(): string {
    return CalibrationViewModel.DEVIATION_ALERT_THRESHOLD.toFixed(2);
  }

  private deviationWeight(view: Pick<EvaluatorCalibrationView, "delta">): number {
    return view.delta === null ? -1 : Math.abs(view.delta);
  }

  private deltaLabel(delta: number | null): string | null {
    if (delta === null) return null;
    return `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`;
  }

  /**
   * Compara PROPORÇÕES, não contagens: um avaliador com 54 notas e outro com
   * 6 concentram coisas diferentes, e a contagem crua elegeria sempre o maior.
   * O degrau escolhido é aquele cuja fatia mais se distancia da fatia do
   * ciclo — para mais ou para menos —, e a contagem devolvida é a DELE, que é
   * o que a pessoa vai reconferir.
   */
  private standoutOf(
    distribution: LevelDistribution,
    overall: LevelDistribution,
  ): { level: Level | null; count: number } {
    const mine = CalibrationViewModel.totalOf(distribution);
    const everyone = CalibrationViewModel.totalOf(overall);
    if (mine === 0 || everyone === 0) return { level: null, count: 0 };
    return SCORE_LEVELS.reduce<{ level: Level | null; count: number; distance: number }>(
      (chosen, level) => {
        const count = CalibrationViewModel.countAt(distribution, level);
        const distance = Math.abs(
          count / mine - CalibrationViewModel.countAt(overall, level) / everyone,
        );
        return distance > chosen.distance ? { level, count, distance } : chosen;
      },
      { level: null, count: 0, distance: -1 },
    );
  }

  private static totalOf(distribution: LevelDistribution): number {
    return SCORE_LEVELS.reduce(
      (sum, level) => sum + CalibrationViewModel.countAt(distribution, level),
      0,
    );
  }

  private static countAt(distribution: LevelDistribution, level: Level): number {
    return distribution[String(level) as keyof LevelDistribution];
  }

  /**
   * O TETO COMUM das barras: a maior contagem de um nível em qualquer
   * avaliador do ciclo.
   *
   * Existe porque a tela é de COMPARAÇÃO (dono, 2026-09-10). Se cada linha
   * escalasse pelo próprio máximo, 9 notas em L4 e 8 em L3 desenhariam a mesma
   * altura em linhas vizinhas, e a "concentração excessiva num nível" — o
   * primeiro dos cinco comportamentos que ele quer ver de relance — sumiria
   * justamente na comparação. O número não é escolhido: é o maior que existe
   * no recorte que o servidor mandou.
   *
   * As notas SEM AUTOR ficam de fora, e é de propósito: elas não são linha
   * nenhuma, então esticariam a escala de todo mundo por um dado que a tela
   * não desenha. O aviso de nota órfã continua contando essa história.
   */
  levelCeiling(snapshot: CalibrationSnapshot): number {
    return snapshot.evaluators.reduce(
      (highest, evaluator) =>
        SCORE_LEVELS.reduce(
          (best, level) =>
            Math.max(best, CalibrationViewModel.countAt(evaluator.distribution, level)),
          highest,
        ),
      0,
    );
  }

  scoreLevels(distribution: LevelDistribution): ScoreLevelRow[] {
    return SCORE_LEVELS.map((level) => ({
      level,
      count: CalibrationViewModel.countAt(distribution, level),
    }));
  }
}
