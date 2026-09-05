import type { RiskState } from "../presenters/capability-coverage-presenter";

export type SortDirection = "asc" | "desc";

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
 * coluna com uma seta ao lado, ascendente ou descendente"). Uma coluna por
 * vez; clicar na mesma coluna inverte a direção, clicar noutra começa em
 * ascendente. Sem coluna escolhida, vale a ordem do catálogo.
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

  private constructor(
    readonly column: string | null,
    readonly direction: SortDirection,
  ) {}

  static catalog(): CoverageTableOrder {
    return new CoverageTableOrder(null, "asc");
  }

  toggled(column: string): CoverageTableOrder {
    if (this.column === column) {
      return new CoverageTableOrder(column, this.direction === "asc" ? "desc" : "asc");
    }
    return new CoverageTableOrder(column, "asc");
  }

  directionOf(column: string): SortDirection | null {
    return this.column === column ? this.direction : null;
  }

  apply<R extends OrderableCoverageRow>(rows: readonly R[]): R[] {
    const column = this.column;
    if (column === null) return [...rows];
    const sign = this.direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => sign * CoverageTableOrder.compare(left, right, column));
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
