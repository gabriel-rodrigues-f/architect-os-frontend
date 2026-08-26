import { ApiError } from "./api-errors";

/**
 * OO3-09 (Fase OO-3) — o par `local(fn)`/`remote(call)` de `buildApi()`
 * (`store.tsx`) se repetia em ~45 métodos, cada um reimplementando na mão o
 * mesmo ciclo de mutação otimista. Esta classe captura o ciclo uma vez:
 *
 *   aplicar mudança local otimista → chamada remota → reconciliar → erro.
 *
 * Três verbos, porque `buildApi()` sempre teve três semânticas distintas —
 * e a distinção é de negócio, não acidente de implementação:
 *
 * 1. `optimistic` — a UI muda na hora (sliders/selects não podem travar);
 *    a escrita é "dispara e esquece". Em erro, a mudança otimista não pode
 *    ficar mentindo sozinha na tela: revalida a partir do servidor (volta o
 *    dado real) e avisa quem clicou via `notifyError`, em vez de falhar em
 *    silêncio. Ver AUDITORIA-TERCEIRA-RODADA-RECONSTRUCAO-PRODUTO-SYNAPSE.md,
 *    EPIC L.
 *
 *    B-09 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1-10, "409
 *    espúrios") — `reconcile` opcional: quando o otimismo local escreveu um
 *    campo que o servidor também recalcula (o caso concreto: `version`, base
 *    de concorrência otimista), o sucesso precisa gravar a resposta real por
 *    cima do palpite otimista. Sem isto, `expectedVersion` da PRÓXIMA edição
 *    lia o `version` antigo do cache — nunca atualizado por um sucesso
 *    anterior — e o servidor recusava com 409 mesmo sem conflito real nenhum.
 *    Reconciliar no sucesso fecha essa janela sem precisar de `await` no
 *    chamador: a escrita continua "dispara e esquece" pra UI.
 *
 * 2. `command` — sem otimismo: o resultado só existe depois que o servidor
 *    confirma (id gerado no servidor, transição de negócio que pode ser
 *    negada, concorrência otimista que precisa do erro de verdade). O erro
 *    sobe cru para o chamador — a tela decide como mostrar; nenhum toast nem
 *    revalidação automática aqui (mesmo contrato de antes).
 *
 * 3. `guarded` — como `command`, mas para operações cujo efeito local
 *    depende da resposta E cujo erro deve revalidar o snapshot antes de
 *    subir (ex.: excluir-ou-arquivar competência/capacidade, troca de
 *    requirement em par): o cache pode ter ficado a meio caminho de uma
 *    decisão que só o servidor conhece.
 *
 * A classe não conhece React, React Query nem `sonner`: recebe um
 * `MutationCache` (atualizar/invalidar o snapshot) e um `notifyError`
 * injetados — testável com fakes `vi.fn()`, sem montar componente (mesmo
 * padrão dos ViewModels).
 */
export interface MutationCache<S> {
  /** Aplica uma transformação no snapshot local imediatamente. */
  update(fn: (s: S) => S): void;
  /** Descarta o palpite local e revalida a partir do servidor. */
  invalidate(): void;
}

export class MutationRunner<S> {
  constructor(
    private readonly cache: MutationCache<S>,
    private readonly notifyError: (message: string) => void,
    private readonly fallbackErrorMessage: string,
  ) {}

  /** Mesmo formato de log das rodadas anteriores — `[api] <status>: <mensagem>` para `ApiError`, o erro cru para o resto. */
  private log(error: unknown): void {
    if (error instanceof ApiError) console.error(`[api] ${error.status}: ${error.message}`);
    else console.error(error);
  }

  /**
   * Mudança local otimista → escrita remota "dispara e esquece". `call` é um
   * thunk (não uma Promise) de propósito: a requisição só é criada DEPOIS da
   * mudança local aplicada — mesma ordem observável do par `local`/`remote`
   * original.
   */
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

  /**
   * Sem otimismo: espera o servidor confirmar, grava a resposta real no
   * snapshot e a devolve. Erro sobe cru — a tela precisa do erro de verdade.
   */
  async command<T>(call: () => Promise<T>, applyLocal: (result: T) => (s: S) => S): Promise<T> {
    const result = await call();
    this.cache.update(applyLocal(result));
    return result;
  }

  /**
   * Como `command`, mas revalida o snapshot antes de propagar o erro —
   * para operações cujo efeito local só o servidor sabe decidir.
   */
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
