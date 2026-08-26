/**
 * OO3-09b (Fase OO-3) — o app tinha DUAS representações de "recorte de uma
 * coleção" convivendo:
 *
 * 1. `string[]` cru (`ArchitectFilter`/`applyArchitectFilter`, o
 *    `nameSelection` do roster do Time, os chips de capacidade da tela de
 *    Evolução) — com o agravante de `[]` significar "ninguém" em uns fluxos
 *    (gap-analysis/compare/roster, por decisão da ORIENTACAO-NONA-RODADA-
 *    FECHAMENTO, Seção 28) e "todas" em outros (chips de alternância da
 *    Evolução, onde nada marcado = sem filtro).
 *
 * 2. `SelectionScope = { mode } (ALL_VISIBLE | SELECTED)` (`domain.ts`,
 *    Seção 44 — "nunca `[] = todos`"), usado só pelo fluxo de Evolução no
 *    contrato wire com o backend.
 *
 * `Selection<TId>` unifica o TIPO: a semântica de vazio agora é sempre dita
 * por extenso no ponto de construção (`explicit([])` = ninguém de propósito;
 * `fromToggleList([])` = todas, semântica de chips), e `SelectionScope`
 * passa a derivar daqui (`domain.ts` reexporta). O COMPORTAMENTO de cada
 * tela fica exatamente como era — unificar a semântica entre telas é decisão
 * de produto, não desta refatoração.
 */

/**
 * Forma de dados (wire) — exatamente o shape que `/api/evolution/*` já
 * recebe: `{ mode: "ALL_VISIBLE" }` ou `{ mode: "SELECTED", ids }`. O
 * `SelectionScope` de `domain.ts` é este tipo com `TId = string`.
 */
export type SelectionScope<TId extends string = string> =
  | { mode: "ALL_VISIBLE" }
  | {
      mode: "SELECTED";
      ids: TId[];
    };

export class Selection<TId extends string = string> {
  /** `Set` só para consulta — `scope.ids` preserva a ordem original de quem construiu. */
  private readonly idSet: ReadonlySet<TId> | null;

  private constructor(private readonly scope: SelectionScope<TId>) {
    this.idSet = scope.mode === "SELECTED" ? new Set(scope.ids) : null;
  }

  /** Tudo que estiver visível — sem lista de ids (o servidor/da tela decide o universo). */
  static allVisible<TId extends string = string>(): Selection<TId> {
    return new Selection<TId>({ mode: "ALL_VISIBLE" });
  }

  /** Ninguém, de propósito (ex.: `?selected=` presente e vazio na URL). */
  static none<TId extends string = string>(): Selection<TId> {
    return Selection.explicit<TId>([]);
  }

  /**
   * Pertencimento explícito: só os ids listados — `[]` significa "ninguém"
   * (contrato do `ArchitectFilter`: "Todo o time" é a lista inteira escrita
   * por extenso, nunca um vazio-como-atalho).
   */
  static explicit<TId extends string = string>(ids: readonly TId[]): Selection<TId> {
    return new Selection<TId>({ mode: "SELECTED", ids: [...ids] });
  }

  /**
   * Semântica de chips de alternância (tela de Evolução): nada marcado =
   * sem filtro = todas visíveis; qualquer chip marcado = só os marcados.
   * É o único lugar onde `[]` vira "todos" — e agora isso está escrito no
   * nome, não implícito num `length ?` espalhado pela tela.
   */
  static fromToggleList<TId extends string = string>(ids: readonly TId[]): Selection<TId> {
    return ids.length > 0 ? Selection.explicit(ids) : Selection.allVisible<TId>();
  }

  /** Reidrata do shape wire (`SelectionScope`). */
  static fromScope<TId extends string = string>(scope: SelectionScope<TId>): Selection<TId> {
    return scope.mode === "ALL_VISIBLE"
      ? Selection.allVisible<TId>()
      : Selection.explicit(scope.ids);
  }

  get isAllVisible(): boolean {
    return this.scope.mode === "ALL_VISIBLE";
  }

  /** Vazio explícito ("ninguém") — nunca verdadeiro para `allVisible`. */
  get isNone(): boolean {
    return this.idSet !== null && this.idSet.size === 0;
  }

  contains(id: TId): boolean {
    return this.idSet === null || this.idSet.has(id);
  }

  /** Recorta `items` preservando a ordem deles — mesmo contrato do antigo `applyArchitectFilter`. */
  apply<T extends { id: TId }>(items: readonly T[]): T[] {
    return items.filter((item) => this.contains(item.id));
  }

  /**
   * Shape wire, byte-idêntico ao que o fluxo de Evolução sempre mandou:
   * `{ mode: "ALL_VISIBLE" }` sem `ids`; `{ mode: "SELECTED", ids }` com a
   * ordem original.
   */
  toScope(): SelectionScope<TId> {
    return this.scope.mode === "ALL_VISIBLE"
      ? { mode: "ALL_VISIBLE" }
      : { mode: "SELECTED", ids: [...this.scope.ids] };
  }
}
