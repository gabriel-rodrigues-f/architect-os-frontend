import { ApiError } from "./api-errors";

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

  optimistic<T>(
    applyLocal: (s: S) => S,
    call: () => Promise<T>,
    reconcile?: (result: T) => (s: S) => S,
  ): void {
    this.cache.update(applyLocal);
    void call().then(
      reconcile ? (result) => this.cache.update(reconcile(result)) : undefined,
      (error: unknown) => {
        this.log(error);
        this.notifyError(error instanceof ApiError ? error.message : this.fallbackErrorMessage);
        this.cache.invalidate();
      },
    );
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
