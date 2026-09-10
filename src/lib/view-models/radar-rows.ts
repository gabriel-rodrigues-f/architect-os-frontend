/** Uma capacidade do catálogo, como o radar precisa vê-la. */
interface RadarCapability {
  readonly id: string;
  readonly name: string;
}

/**
 * Uma SÉRIE do radar e as médias que ela tem, por capacidade.
 *
 * Na ficha, no Painel e no radar de TIME são duas séries fixas — o que se tem
 * hoje e o alvo. O que não muda é a forma da ausência.
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

/**
 * Quantas pessoas do recorte têm medida num eixo — só o radar de TIME informa
 * isto. A média de um time é a média de quem foi medido, e "3,25" com 2 de 8
 * pessoas não diz a mesma coisa que "3,25" com 8 de 8. Numa ficha é uma
 * pessoa só: seria sempre 1 de 1, e por isso a cobertura fica ausente lá.
 */
export interface AxisCoverage {
  readonly covered: number;
  readonly total: number;
}

/** Uma capacidade medida como a ficha a lê: a média de hoje e o alvo. */
export interface CapabilityMeasure {
  readonly capability: RadarCapability;
  readonly avg: number | undefined;
  readonly target: number | undefined;
  readonly coverage?: AxisCoverage;
}

/** A linha do radar de UMA pessoa: o eixo, o que ela tem hoje, o alvo dela. */
export interface CurrentAgainstTargetRow {
  readonly capability: string;
  readonly atual: number | null;
  readonly alvo: number | null;
  readonly covered?: number;
  readonly total?: number;
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
 * A classe nasceu para o Comparativo (Perfis lado a lado) e a Visão geral da
 * ficha herdou o mesmo `?? 0`. Em vez de uma segunda régua, a régua ficou UMA
 * — `measuredRows`. O Comparativo saiu do produto em 2026-09-10 e levou junto
 * a forma dele (`RadarRows.of`, uma coluna por pessoa); a régua FICA, com a
 * forma da ficha (`atual` e `alvo`, do jeito que `CapabilityRadar` desenha),
 * e é ela que os três radares restantes usam.
 *
 * Os outros DOIS lugares com o mesmo defeito — o radar do próprio profissional
 * no Painel e o radar de TIME da Análise de Lacunas — entraram na segunda
 * forma, sem terceira régua. O time só pediu uma generalização: o eixo carrega
 * COBERTURA (`AxisCoverage`), porque média de time se lê junto com quantas
 * pessoas ela resume. E ela é OPCIONAL de propósito: quem desenha uma pessoa
 * só não tem o que informar aí.
 */
export class RadarRows {
  private constructor() {}

  /**
   * Duas séries fixas — o que se tem hoje e o alvo. É a forma da ficha (uma
   * pessoa), do Painel do próprio profissional e do radar de TIME da Análise
   * de Lacunas, onde cada eixo é a média do recorte. A única diferença do
   * time é a COBERTURA, que viaja com o eixo quando quem chama a informa.
   */
  static currentAgainstTarget(measures: readonly CapabilityMeasure[]): CurrentAgainstTargetRow[] {
    const averagesOf = (
      read: (measure: CapabilityMeasure) => number | undefined,
    ): ReadonlyMap<string, number | undefined> =>
      new Map(measures.map((measure) => [measure.capability.id, read(measure)]));

    const coverageOf = new Map(
      measures.flatMap((measure) =>
        measure.coverage ? [[measure.capability.id, measure.coverage] as const] : [],
      ),
    );

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
        ...(coverageOf.get(capability.id) ?? {}),
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
