export interface QueryState<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  /** O erro, quando houver — é o que separa "o serviço caiu" de "esta leitura falhou". */
  error?: unknown;
  refetch: () => unknown;
}

export class ObservedQuery<T> implements QueryState<T> {
  readonly data: T | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly refetch: () => unknown;

  constructor(query: QueryState<T>) {
    this.data = query.data;
    this.isPending = query.isPending;
    this.isError = query.isError;
    this.refetch = query.refetch;
  }
}
