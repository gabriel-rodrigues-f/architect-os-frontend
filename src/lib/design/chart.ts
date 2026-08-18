/**
 * Paleta e vocabulário visual dos gráficos.
 *
 * ## O problema que isto resolve
 *
 * Antes, cada tela montava seu próprio array de `var(--chart-N)` e passava
 * cores soltas para o componente. Duas consequências: a mesma competência
 * saía de cores diferentes em telas diferentes, e a paleta se esgotava em
 * silêncio — a sexta série reaparecia com a cor da primeira sem que nada
 * avisasse.
 *
 * Aqui a paleta é um objeto: ela sabe quantas cores tem, distribui em ordem
 * estável e diz quando acabou.
 *
 * ## Por que devolve `var(--token)` e não a cor
 *
 * Resolver OKLCH em runtime obrigaria o gráfico a re-renderizar na troca de
 * tema e a adivinhar o tema no SSR, onde ele ainda não existe. Devolvendo a
 * variável, quem troca a cor é a cascata do CSS — de graça, sem re-render e
 * sem primeiro quadro errado.
 */

/** Quantas séries a paleta distingue antes de repetir. */
export const SERIES_COUNT = 6;

export interface SeriesStyle {
  /** Cor do traço — sempre uma `var()`, resolvida pelo tema ativo. */
  readonly color: string;
  /**
   * Traçado. A segunda metade da paleta vira tracejada de propósito: com seis
   * linhas no mesmo gráfico, a cor sozinha deixa de bastar — e quem não
   * distingue matiz passa a ter a forma como segunda pista.
   */
  readonly dash?: string;
}

/**
 * Distribui as cores das séries.
 *
 * É uma classe, e não uma função, porque a atribuição precisa ser *estável por
 * gráfico*: a mesma chave tem de receber a mesma cor em toda renderização, e
 * isso é estado.
 */
export class ChartPalette {
  private readonly assigned = new Map<string, number>();

  /** Índice → estilo. Percorre as cores e só então recorre ao tracejado. */
  at(index: number): SeriesStyle {
    const slot = index % SERIES_COUNT;
    const volta = Math.floor(index / SERIES_COUNT);
    return {
      color: `var(--chart-${String(slot + 1)})`,
      ...(volta > 0 ? { dash: DASHES[(volta - 1) % DASHES.length] } : {}),
    };
  }

  /**
   * Estilo estável para uma chave. Duas séries com o mesmo nome recebem a
   * mesma cor, mesmo que a ordem dos dados mude entre renderizações.
   */
  forKey(key: string): SeriesStyle {
    let index = this.assigned.get(key);
    if (index === undefined) {
      index = this.assigned.size;
      this.assigned.set(key, index);
    }
    return this.at(index);
  }

  /** Estilos para uma lista de chaves, na ordem em que aparecem. */
  forKeys(keys: readonly string[]): SeriesStyle[] {
    return keys.map((k) => this.forKey(k));
  }
}

const DASHES = ["6 3", "2 3", "8 3 2 3"] as const;

/**
 * Papéis fixos — não são séries de dados, são a moldura contra a qual o dado
 * é lido. Ficam nomeados aqui para que nenhum componente volte a escrever
 * `var(--color-border)` direto e o significado se perca.
 */
export const CHART_INK = {
  /** Nível esperado / meta: referência quase acromática, não compete com o dado. */
  reference: "var(--chart-reference)",
  /** Grade e eixos. */
  grid: "var(--color-border)",
  /** Texto de eixo, tick e legenda. */
  axis: "var(--color-muted-foreground)",
  /** Fundo do tooltip e do plano do gráfico. */
  surface: "var(--chart-surface)",
  /** Texto do tooltip. */
  surfaceText: "var(--color-foreground)",
} as const;

/**
 * Estilo do tooltip.
 *
 * O Recharts injeta `background: #fff` no estilo inline do container, então
 * omitir a cor de fundo não deixava o padrão do tema valer — exibia uma caixa
 * branca sobre o gráfico escuro. Todo campo aqui existe para sobrescrever um
 * padrão do Recharts que ignora o tema.
 */
export const tooltipStyle = {
  background: CHART_INK.surface,
  color: CHART_INK.surfaceText,
  border: `1px solid ${CHART_INK.grid}`,
  borderRadius: "var(--radius-md)",
  boxShadow: "0 4px 12px oklch(0 0 0 / 0.12)",
  fontSize: "var(--text-label)",
  padding: "var(--space-2) var(--space-3)",
} as const;

/** Tick de eixo — tamanho e cor iguais nos dois gráficos. */
export const axisTick = { fontSize: 11, fill: CHART_INK.axis } as const;
