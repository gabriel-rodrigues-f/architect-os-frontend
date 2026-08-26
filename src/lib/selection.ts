export type SelectionScope<TId extends string = string> =
  | { mode: "ALL_VISIBLE" }
  | {
      mode: "SELECTED";
      ids: TId[];
    };

export class Selection<TId extends string = string> {
  private readonly idSet: ReadonlySet<TId> | null;

  private constructor(private readonly scope: SelectionScope<TId>) {
    this.idSet = scope.mode === "SELECTED" ? new Set(scope.ids) : null;
  }

  static allVisible<TId extends string = string>(): Selection<TId> {
    return new Selection<TId>({ mode: "ALL_VISIBLE" });
  }

  static none<TId extends string = string>(): Selection<TId> {
    return Selection.explicit<TId>([]);
  }

  static explicit<TId extends string = string>(ids: readonly TId[]): Selection<TId> {
    return new Selection<TId>({ mode: "SELECTED", ids: [...ids] });
  }

  static fromToggleList<TId extends string = string>(ids: readonly TId[]): Selection<TId> {
    return ids.length > 0 ? Selection.explicit(ids) : Selection.allVisible<TId>();
  }

  static fromScope<TId extends string = string>(scope: SelectionScope<TId>): Selection<TId> {
    return scope.mode === "ALL_VISIBLE"
      ? Selection.allVisible<TId>()
      : Selection.explicit(scope.ids);
  }

  get isAllVisible(): boolean {
    return this.scope.mode === "ALL_VISIBLE";
  }

  get isNone(): boolean {
    return this.idSet !== null && this.idSet.size === 0;
  }

  contains(id: TId): boolean {
    return this.idSet === null || this.idSet.has(id);
  }

  apply<T extends { id: TId }>(items: readonly T[]): T[] {
    return items.filter((item) => this.contains(item.id));
  }

  toScope(): SelectionScope<TId> {
    return this.scope.mode === "ALL_VISIBLE"
      ? { mode: "ALL_VISIBLE" }
      : { mode: "SELECTED", ids: [...this.scope.ids] };
  }
}
