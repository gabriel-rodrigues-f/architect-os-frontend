import { ApiError, UserFacingError } from "./api-errors";

export interface MutationCache<S> {
  update(fn: (s: S) => S): void;

  invalidate(): void;
}

export class MutationRunner<S> {
  constructor(
    private readonly cache: MutationCache<S>,
    private readonly notifyError: (message: string) => void,
    private readonly fallbackErrorMessage: string,
  ) {}

  private log(error: unknown): void {
    if (error instanceof ApiError) console.error(`[api] ${error.status}: ${error.message}`);
    else console.error(error);
  }

  private messageOf(error: unknown): string {
    return error instanceof UserFacingError ? error.message : this.fallbackErrorMessage;
  }

  /**
   * `onConfirmed` roda quando a resposta chega bem — é onde mora o aviso de
   * sucesso de uma mutação otimista (inventário 2026-09-08, §5.7): disparado
   * no clique, o toast verde convivia com o `toast.error` da recusa que vinha
   * em seguida; a rede pulsa azul na resposta 2xx, e o aviso acompanha.
   */
  optimistic<T>(
    applyLocal: (s: S) => S,
    call: () => Promise<T>,
    reconcile?: (result: T) => (s: S) => S,
    onConfirmed?: () => void,
  ): void {
    this.cache.update(applyLocal);
    void call().then(
      (result) => {
        if (reconcile) this.cache.update(reconcile(result));
        onConfirmed?.();
      },
      (error: unknown) => {
        this.log(error);
        this.notifyError(this.messageOf(error));
        this.cache.invalidate();
      },
    );
  }

  refuse(error: unknown): void {
    this.log(error);
    this.notifyError(this.messageOf(error));
    this.cache.invalidate();
  }

  async command<T>(call: () => Promise<T>, applyLocal: (result: T) => (s: S) => S): Promise<T> {
    const result = await call();
    this.cache.update(applyLocal(result));
    return result;
  }

  async guarded<T>(call: () => Promise<T>, applyLocal: (result: T) => (s: S) => S): Promise<T> {
    try {
      const result = await call();
      this.cache.update(applyLocal(result));
      return result;
    } catch (error) {
      this.log(error);
      this.cache.invalidate();
      throw error;
    }
  }
}
