/** Uma capacidade do catálogo, como o radar precisa vê-la. */
interface RadarCapability {
  readonly id: string;
  readonly name: string;
}

/**
 * Uma pessoa comparada e as médias que ela tem.
 *
 * O valor é `number | undefined` de propósito: a origem (`capabilityAverages`)
 * devolve a chave da capacidade mesmo quando não há média, com o valor
 * indefinido. Então ausência aqui tem DUAS formas — a chave que falta e a
 * chave presente sem valor — e as duas significam a mesma coisa: não medido.
 * Olhar só a chave deixaria passar metade dos casos, que é como o `?? 0`
 * original conseguia parecer certo.
 */
interface RadarSubject {
  readonly id: string;
  readonly averages: ReadonlyMap<string, number | undefined>;
}

export type ComparisonRadarRow = Record<string, string | number | null>;

/**
 * AS LINHAS DO RADAR COMPARATIVO — e a diferença entre zero e ausência.
 *
 * Dono, 2026-09-09: *"ele não deveria gerar essa ponta assim, deveria conectar
 * os pontos no espaço já ocupado"*. A ponta não era desenho, era um número:
 * capacidade sem média virava `?? 0`, zero é o CENTRO do radar, e a aresta
 * entre duas capacidades avaliadas passava por lá — atravessando o próprio
 * polígono. A tela afirmava "esta pessoa tem zero aqui" onde o certo era "não
 * há medida", e a ponta era essa afirmação desenhada.
 *
 * Duas regras, e as duas são de produto antes de serem de desenho:
 *
 *  1. **Sem medida é `null`, nunca zero.** Zero é uma medição que deu zero;
 *     ausência é não ter sido medido. Com `null` e `connectNulls`, o traço
 *     liga os pontos que existem — o "espaço já ocupado" que o dono pediu.
 *  2. **Eixo que NINGUÉM mediu sai do radar.** Num comparativo, um eixo sem
 *     valor para nenhuma das pessoas não compara nada: só acrescenta raio e
 *     empurra o polígono para dentro. Basta UMA das pessoas ter medida para o
 *     eixo ficar — aí a diferença é justamente o que se quer ver.
 */
export class ComparisonRadarRows {
  private constructor() {}

  static of(
    capabilities: readonly RadarCapability[],
    subjects: readonly RadarSubject[],
  ): ComparisonRadarRow[] {
    return capabilities
      .filter((capability) => ComparisonRadarRows.measured(capability, subjects))
      .map((capability) => {
        const row: ComparisonRadarRow = { capability: capability.name };
        for (const subject of subjects) {
          row[subject.id] = subject.averages.get(capability.id) ?? null;
        }
        return row;
      });
  }

  private static measured(capability: RadarCapability, subjects: readonly RadarSubject[]): boolean {
    return subjects.some((subject) => subject.averages.get(capability.id) !== undefined);
  }
}
