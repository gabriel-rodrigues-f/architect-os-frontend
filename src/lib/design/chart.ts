export const SERIES_COUNT = 6;

type SeriesSymbol = "circle" | "square" | "triangle" | "diamond" | "cross" | "star" | "wye";

export interface SeriesStyle {
  readonly color: string;

  readonly dash?: string;

  readonly symbol: SeriesSymbol;
}

export class ChartPalette {
  private readonly assigned = new Map<string, number>();

  at(index: number): SeriesStyle {
    const slot = index % SERIES_COUNT;
    const volta = Math.floor(index / SERIES_COUNT);
    const traco = DASHES[(slot + volta) % DASHES.length];
    return {
      color: `var(--chart-${String(slot + 1)})`,
      symbol: SYMBOLS[(slot + volta) % SYMBOLS.length]!,
      ...(traco ? { dash: traco } : {}),
    };
  }

  forKey(key: string): SeriesStyle {
    let index = this.assigned.get(key);
    if (index === undefined) {
      index = this.assigned.size;
      this.assigned.set(key, index);
    }
    return this.at(index);
  }

  forKeys(keys: readonly string[]): SeriesStyle[] {
    return keys.map((chave) => this.forKey(chave));
  }
}

const DASHES = [undefined, "6 3", "2 3", "8 3 2 3", "1 4", "12 4 2 4"] as const;

const SYMBOLS: readonly SeriesSymbol[] = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "cross",
  "star",
  "wye",
];

export const CHART_INK = {
  reference: "var(--chart-reference)",

  grid: "var(--color-border)",

  axis: "var(--color-muted-foreground)",

  surface: "var(--chart-surface)",

  surfaceText: "var(--color-foreground)",
} as const;

export const tooltipStyle = {
  background: CHART_INK.surface,
  color: CHART_INK.surfaceText,
  border: `1px solid ${CHART_INK.grid}`,
  borderRadius: "var(--radius-md)",
  boxShadow: "0 4px 12px oklch(0 0 0 / 0.12)",
  fontSize: "var(--text-label)",
  padding: "var(--space-2) var(--space-3)",
} as const;

export const axisTick = { fontSize: 11, fill: CHART_INK.axis } as const;

/**
 * O rótulo de um eixo carrega o NOME INTEIRO e quebra SÓ em espaço.
 *
 * Pedido do dono (2026-09-03) diante do radar: o eixo mostrava o campo
 * `short` da capacidade, e no catálogo da casa o short é uma palavra só
 * ("Clean" para "Clean Core", "Corporativa" para "Arquitetura
 * Corporativa") — dois eixos vizinhos pareciam duas capacidades distintas e
 * o nome verdadeiro não aparecia em lugar nenhum do gráfico.
 *
 * `LIMITE` é largura de linha em caracteres, não corte: palavra maior que
 * ele fica inteira na própria linha. Nada é elidido; juntar as linhas de
 * volta devolve o nome original.
 */
export class RotuloDeEixo {
  private static readonly LIMITE = 18;

  static emLinhas(texto: string, limite: number = RotuloDeEixo.LIMITE): readonly string[] {
    const palavras = texto
      .trim()
      .split(/\s+/)
      .filter((palavra) => palavra.length > 0);
    return palavras.reduce<string[]>((linhas, palavra) => {
      const ultima = linhas.at(-1);
      if (ultima === undefined) return [palavra];
      if (`${ultima} ${palavra}`.length <= limite) {
        return [...linhas.slice(0, -1), `${ultima} ${palavra}`];
      }
      return [...linhas, palavra];
    }, []);
  }
}

/**
 * O ponto onde o rótulo de um eixo polar é desenhado.
 *
 * Pedido do dono (2026-09-03) diante do radar: *"quero uma margem um pouco
 * maior, pouca coisa, apenas pra que as letras não encostem no gráfico"*. O
 * recharts entrega o ponto colado na borda do polígono; afastar em x ou em y
 * daria folga desigual conforme o lado do eixo. Afastar na direção do RAIO dá
 * a mesma folga nos doze lados.
 */
export class PontoDoEixo {
  static afastadoDoCentro(
    pontoX: number,
    pontoY: number,
    centroX: number | undefined,
    centroY: number | undefined,
    folga: number,
  ): readonly [number, number] {
    if (centroX === undefined || centroY === undefined) return [pontoX, pontoY];
    const distanciaX = pontoX - centroX;
    const distanciaY = pontoY - centroY;
    const raio = Math.hypot(distanciaX, distanciaY);
    if (raio === 0) return [pontoX, pontoY];
    return [pontoX + (distanciaX / raio) * folga, pontoY + (distanciaY / raio) * folga];
  }
}
