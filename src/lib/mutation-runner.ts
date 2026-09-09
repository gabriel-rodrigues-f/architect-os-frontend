import { ApiError } from "./api-errors";

export interface MutationCache<S> {
  update(fn: (s: S) => S): void;

  invalidate(): void;
}

/**
 * A FRASE de uma recusa, já resolvida no idioma de quem lê (fatia IDIOMA, dono
 * 2026-09-08). O runner recebe a decisão pronta em vez de tomá-la: ele não tem
 * `t` em mãos, e a régua de qual frase mostrar é uma só na casa
 * (`MutationRefusal`).
 */
export type RefusalSentence = (failure: unknown) => string;

export class MutationRunner<S> {
  constructor(
    private readonly cache: MutationCache<S>,
    private readonly notifyError: (message: string) => void,
    private readonly sentenceOf: RefusalSentence,
  ) {}

  private log(error: unknown): void {
    if (error instanceof ApiError) console.error(`[api] ${error.status}: ${error.message}`);
    else console.error(error);
  }

  private messageOf(error: unknown): string {
    return this.sentenceOf(error);
  }

  /**
   * `onConfirmed` roda quando a resposta chega bem — é onde mora o aviso de
   * sucesso de uma mutação otimista (inventário 2026-09-08, §5.7): disparado
   * no clique, o toast verde convivia com o `toast.error` da recusa que vinha
   * em seguida; a rede pulsa azul na resposta 2xx, e o aviso acompanha.
   *
   * Ele recebe a RESPOSTA (2026-09-09): a frase do aviso da casa vem do
   * `messageCode` que o serviço publica no envelope, lido por
   * `successMessageOf` — sem o resultado em mãos, a tela só teria a chave de
   * reserva e o idioma do serviço voltaria a mandar. Quem não precisa do
   * corpo continua declarando `() => void`, que é atribuível a este tipo.
   */
  optimistic<T>(
    applyLocal: (s: S) => S,
    call: () => Promise<T>,
    reconcile?: (result: T) => (s: S) => S,
    onConfirmed?: (result: T) => void,
  ): void {
    this.cache.update(applyLocal);
    void call().then(
      (result) => {
        if (reconcile) this.cache.update(reconcile(result));
        onConfirmed?.(result);
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
