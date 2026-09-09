/** Uma capacidade do catálogo, como o radar precisa vê-la. */
interface RadarCapability {
  readonly id: string;
  readonly name: string;
}

/**
 * Uma SÉRIE do radar e as médias que ela tem, por capacidade.
 *
 * No comparativo cada série é uma PESSOA; na ficha são duas, fixas — o que a
 * pessoa tem hoje e o alvo dela. O que não muda é a forma da ausência.
 *
 * O valor é `number | undefined` de propósito: a origem (`capabilityAverages`)
 * devolve a chave da capacidade mesmo quando não há média, com o valor
 * indefinido. Então ausência aqui tem DUAS formas — a chave que falta e a
 * chave presente sem valor — e as duas significam a mesma coisa: não medido.
 * Olhar só a chave deixaria passar metade dos casos, que é como o `?? 0`
 * original conseguia parecer certo.
 */
interface RadarSeries {
  readonly id: string;
  readonly averages: ReadonlyMap<string, number | undefined>;
}

export type ComparisonRadarRow = Record<string, string | number | null>;

/** Uma capacidade medida como a ficha a lê: a média de hoje e o alvo. */
export interface CapabilityMeasure {
  readonly capability: RadarCapability;
  readonly avg: number | undefined;
  readonly target: number | undefined;
}

/** A linha do radar de UMA pessoa: o eixo, o que ela tem hoje, o alvo dela. */
export interface CurrentAgainstTargetRow {
  readonly capability: string;
  readonly atual: number | null;
  readonly alvo: number | null;
}

const CURRENT = "atual";
const TARGET = "alvo";

/**
 * AS LINHAS DE UM RADAR — e a diferença entre zero e ausência.
 *
 * Dono, 2026-09-09, sobre o radar do Comparativo: *"ele não deveria gerar essa
 * ponta assim, deveria conectar os pontos no espaço já ocupado"*. A ponta não
 * era desenho, era um número: capacidade sem média virava `?? 0`, zero é o
 * CENTRO do radar, e a aresta entre duas capacidades avaliadas passava por lá
 * — atravessando o próprio polígono. A tela afirmava "esta pessoa tem zero
 * aqui" onde o certo era "não há medida", e a ponta era essa afirmação
 * desenhada.
 *
 * Duas regras, e as duas são de produto antes de serem de desenho:
 *
 *  1. **Sem medida é `null`, nunca zero.** Zero é uma medição que deu zero;
 *     ausência é não ter sido medido. Com `null` e `connectNulls`, o traço
 *     liga os pontos que existem — o "espaço já ocupado" que o dono pediu.
 *  2. **Eixo que NINGUÉM mediu sai do radar.** Um eixo sem valor em nenhuma
 *     das séries não desenha nada: só acrescenta raio e empurra o polígono
 *     para dentro. Basta UMA série ter medida para o eixo ficar — aí a
 *     diferença é justamente o que se quer ver.
 *
 * A classe nasceu para o Comparativo e a Visão geral da ficha herdou o mesmo
 * `?? 0`. Em vez de uma segunda régua, a régua ficou UMA — `measuredRows` — e
 * ganhou duas formas de linha: a do comparativo (uma coluna por pessoa) e a da
 * ficha (`atual` e `alvo`, do jeito que `CapabilityRadar` desenha).
 */
export class RadarRows {
  private constructor() {}

  /** O comparativo: uma coluna por pessoa comparada. */
  static of(
    capabilities: readonly RadarCapability[],
    series: readonly RadarSeries[],
  ): ComparisonRadarRow[] {
    return RadarRows.measuredRows(capabilities, series, (capability, values) => {
      const row: ComparisonRadarRow = { capability: capability.name };
      series.forEach((serie, ordem) => {
        row[serie.id] = values[ordem] ?? null;
      });
      return row;
    });
  }

  /** A ficha: duas séries fixas — o que a pessoa tem hoje e o alvo dela. */
  static currentAgainstTarget(measures: readonly CapabilityMeasure[]): CurrentAgainstTargetRow[] {
    const averagesOf = (
      read: (measure: CapabilityMeasure) => number | undefined,
    ): ReadonlyMap<string, number | undefined> =>
      new Map(measures.map((measure) => [measure.capability.id, read(measure)]));

    return RadarRows.measuredRows(
      measures.map((measure) => measure.capability),
      [
        { id: CURRENT, averages: averagesOf((measure) => measure.avg) },
        { id: TARGET, averages: averagesOf((measure) => measure.target) },
      ],
      (capability, [atual, alvo]) => ({
        capability: capability.name,
        atual: atual ?? null,
        alvo: alvo ?? null,
      }),
    );
  }

  /**
   * A RÉGUA, uma vez: para cada capacidade, o valor de cada série (ausência é
   * `null`); eixo sem nenhuma medida não vira linha. Quem chama decide só a
   * FORMA da linha.
   */
  private static measuredRows<Row>(
    capabilities: readonly RadarCapability[],
    series: readonly RadarSeries[],
    shape: (capability: RadarCapability, values: readonly (number | null)[]) => Row,
  ): Row[] {
    return capabilities
      .map((capability) => ({
        capability,
        values: series.map((serie) => serie.averages.get(capability.id) ?? null),
      }))
      .filter(({ values }) => values.some((value) => value !== null))
      .map(({ capability, values }) => shape(capability, values));
  }
}
