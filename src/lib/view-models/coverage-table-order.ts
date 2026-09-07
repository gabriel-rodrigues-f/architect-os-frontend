import type { RiskState } from "../presenters/capability-coverage-presenter";
import { TableOrder, type SortDirection } from "./table-order";

/**
 * O que a tabela de cobertura precisa saber de uma linha para ordená-la. É um
 * recorte do `CapabilityCoverageArea` do presenter, e não o tipo inteiro, para
 * o teste montar uma linha sem inventar um catálogo.
 */
export interface OrderableCoverageRow {
  cat: { name: string };
  bands: readonly { key: string; people: readonly unknown[] }[];
  notAssessed: number;
  risk: RiskState;
}

/**
 * A ordenação da tabela "De quem o time depende" (dono, 2026-09-05: "cada
 * coluna com uma seta ao lado, ascendente ou descendente"). A regra do clique
 * é a de `TableOrder`; o que é DESTA tabela é como cada coluna compara.
 *
 * O risco ordena pelo quanto pede ação: sem dados < sem referência <
 * concentração < distribuída — em ascendente, o pior vem primeiro.
 */
export class CoverageTableOrder {
  private static readonly RISK_RANK: Readonly<Record<RiskState, number>> = {
    insufficientData: 0,
    noReference: 1,
    concentrationRisk: 2,
    distributedCoverage: 3,
  };

  private constructor(private readonly order: TableOrder) {}

  static catalog(): CoverageTableOrder {
    return new CoverageTableOrder(TableOrder.none());
  }

  get column(): string | null {
    return this.order.column;
  }

  get direction(): SortDirection {
    return this.order.direction;
  }

  toggled(column: string): CoverageTableOrder {
    return new CoverageTableOrder(this.order.toggled(column));
  }

  directionOf(column: string): SortDirection | null {
    return this.order.directionOf(column);
  }

  apply<R extends OrderableCoverageRow>(rows: readonly R[]): R[] {
    return this.order.apply(rows, (left, right, column) =>
      CoverageTableOrder.compare(left, right, column),
    );
  }

  private static compare(
    left: OrderableCoverageRow,
    right: OrderableCoverageRow,
    column: string,
  ): number {
    if (column === "capability") return left.cat.name.localeCompare(right.cat.name);
    if (column === "notAssessed") return left.notAssessed - right.notAssessed;
    if (column === "risk") return this.RISK_RANK[left.risk] - this.RISK_RANK[right.risk];
    return this.peopleIn(left, column) - this.peopleIn(right, column);
  }

  private static peopleIn(row: OrderableCoverageRow, band: string): number {
    return row.bands.find((candidate) => candidate.key === band)?.people.length ?? 0;
  }
}
