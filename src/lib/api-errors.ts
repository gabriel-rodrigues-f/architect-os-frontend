/**
 * AS PEÇAS DA FRASE DE UMA RECUSA (fatia IDIOMA, dono 2026-09-08).
 *
 * Irmã de `NoticeWording`, e pelo mesmo motivo: a frase não pode nascer no
 * servidor, porque o servidor não sabe em que idioma a pessoa está lendo. O
 * que chega pelo fio é o CÓDIGO da recusa e as PEÇAS que a frase pede; quem
 * compõe é a `RefusalPhrase`, com o dicionário de quem lê.
 *
 * Toda peça é opcional: recusa sem peça nenhuma continua sendo a maioria, e
 * corpo antigo — sem `wording` — não pode virar tela quebrada.
 */
export interface RefusalWording {
  /** A chave estável do recurso recusado (`professional`), nunca o rótulo. */
  entity?: string | undefined;
}

export interface UserFacingErrorOptions {
  cause?: unknown;
}

export interface ApiErrorOptions extends UserFacingErrorOptions {
  wording?: RefusalWording | undefined;
}

export class UserFacingError extends Error {
  constructor(message: string, options?: UserFacingErrorOptions) {
    super(message, options);
    this.name = "UserFacingError";
  }
}

export class ApiError extends UserFacingError {
  /**
   * As peças com que a tela compõe a frase. Elas viajam ao lado do `code` —
   * `message` continua chegando, e continua em português, mas é retaguarda:
   * quem a imprime na tela reintroduz o defeito que esta fatia fechou.
   */
  readonly wording?: RefusalWording | undefined;

  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
    readonly code?: string,
    readonly correlationId?: string,
    options?: ApiErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
    this.wording = options?.wording;
  }
}
