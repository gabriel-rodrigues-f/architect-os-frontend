export type SortDirection = "asc" | "desc";

/**
 * ORDENAÇÃO POR CABEÇALHO CLICÁVEL — coluna + direção, com a regra do clique.
 *
 * Nasceu na tabela "De quem o time depende" (dono, 2026-09-05: "cada coluna
 * com uma seta ao lado, ascendente ou descendente") e voltou a ser pedida em
 * Usuários (dono, 2026-09-06). Duas ocorrências = um objeto. Uma coluna por
 * vez; clicar na mesma coluna inverte a direção, clicar noutra começa em
 * ascendente. Sem coluna escolhida, vale a ordem de entrada.
 *
 * O objeto não sabe comparar linhas — cada tabela traz o seu `compare`; o
 * sort é estável, então um pré-ordenamento (por nome, por exemplo) vira o
 * desempate nos dois sentidos.
 */
export class TableOrder<Column extends string = string> {
  private constructor(
    readonly column: Column | null,
    readonly direction: SortDirection,
  ) {}

  static none<C extends string = string>(): TableOrder<C> {
    return new TableOrder<C>(null, "asc");
  }

  static by<C extends string = string>(column: C, direction: SortDirection = "asc"): TableOrder<C> {
    return new TableOrder<C>(column, direction);
  }

  toggled(column: Column): TableOrder<Column> {
    if (this.column === column) {
      return new TableOrder<Column>(column, this.direction === "asc" ? "desc" : "asc");
    }
    return new TableOrder<Column>(column, "asc");
  }

  directionOf(column: Column): SortDirection | null {
    return this.column === column ? this.direction : null;
  }

  apply<R>(rows: readonly R[], compare: (left: R, right: R, column: Column) => number): R[] {
    const column = this.column;
    if (column === null) return [...rows];
    const sign = this.direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => sign * compare(left, right, column));
  }
}
