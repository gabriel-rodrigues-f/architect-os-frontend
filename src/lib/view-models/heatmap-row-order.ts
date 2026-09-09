import { TableOrder, type SortDirection } from "./table-order";

/**
 * A ordem das PESSOAS no mapa de calor, coluna de capacidade a coluna de
 * capacidade (dono, 2026-09-08: *"cada coluna de capacidade ganha uma setinha
 * que ordena a tabela por aquela coluna, crescente e decrescente"*).
 *
 * A regra do clique é a do `TableOrder` — a mesma de "Risco de Concentração"
 * e de "Usuários"; o que é DESTE mapa é como uma coluna compara duas pessoas:
 *
 *   - a média da pessoa naquela capacidade é a chave;
 *   - quem não tem avaliação ali ordena ABAIXO do nível 1 — a ausência é o
 *     menor sinal da coluna, e não um zero inventado (a célula continua
 *     mostrando "—", nunca 0);
 *   - o empate desempata pelo NOME, e pelo mesmo nome nos dois sentidos: o
 *     pré-ordenamento entra antes do sort estável, então duas pessoas de
 *     mesmo nível não trocam de lugar a cada clique.
 *
 * Sem coluna escolhida, vale a ordem que a tela entregou — o mapa não impõe
 * uma ordem própria a quem só quer ler a matriz.
 */
export class HeatmapRowOrder {
  /** Abaixo de todo nível da escala (1 a 5), e sem se confundir com o zero. */
  private static readonly SEM_AVALIACAO = -1;

  private constructor(private readonly order: TableOrder) {}

  static none(): HeatmapRowOrder {
    return new HeatmapRowOrder(TableOrder.none());
  }

  get column(): string | null {
    return this.order.column;
  }

  directionOf(column: string): SortDirection | null {
    return this.order.directionOf(column);
  }

  toggled(column: string): HeatmapRowOrder {
    return new HeatmapRowOrder(this.order.toggled(column));
  }

  /**
   * `levelIn` é o que a tela sabe e o objeto não: a média daquela pessoa
   * naquela capacidade, ou `undefined` quando não há avaliação.
   */
  apply<Row extends { name: string }>(
    rows: readonly Row[],
    levelIn: (row: Row, capabilityId: string) => number | undefined,
  ): Row[] {
    if (this.order.column === null) return [...rows];
    const byName = [...rows].sort((left, right) => left.name.localeCompare(right.name));
    return this.order.apply(
      byName,
      (left, right, capabilityId) =>
        HeatmapRowOrder.levelOf(left, capabilityId, levelIn) -
        HeatmapRowOrder.levelOf(right, capabilityId, levelIn),
    );
  }

  private static levelOf<Row>(
    row: Row,
    capabilityId: string,
    levelIn: (row: Row, capabilityId: string) => number | undefined,
  ): number {
    return levelIn(row, capabilityId) ?? HeatmapRowOrder.SEM_AVALIACAO;
  }
}
