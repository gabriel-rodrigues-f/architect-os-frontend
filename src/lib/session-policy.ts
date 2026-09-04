import { ApiError } from "./api-errors";

const SESSION_ENDING_STATUS = 401;

export const SESSION_ENDING_CODES = [
  "AUTHENTICATION_REQUIRED",
  "SESSION_INVALID",
  "SESSION_REVOKED",
] as const;

const sessionEndingCodes: ReadonlySet<string> = new Set(SESSION_ENDING_CODES);

function endsSession(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === SESSION_ENDING_STATUS &&
    error.code !== undefined &&
    sessionEndingCodes.has(error.code)
  );
}

export class SessionPolicy {
  /**
   * A recusa que o backend devolve em TODA rota enquanto a marca do primeiro
   * acesso está de pé. A sessão continua válida — não é 401, e encerrá-la aqui
   * mandaria de volta ao login quem só precisa trocar a senha.
   */
  static readonly PASSWORD_CHANGE_REQUIRED_CODE = "PASSWORD_CHANGE_REQUIRED";

  private static readonly PASSWORD_CHANGE_REQUIRED_STATUS = 403;

  private endSessionHandler: (() => void) | null = null;

  private passwordChangeHandler: (() => void) | null = null;

  whenSessionEnded(handler: (() => void) | null): void {
    this.endSessionHandler = handler;
  }

  /**
   * A REDE DE SEGURANÇA da onda 41. O caminho normal é o `AuthGate` ler a
   * marca de `/auth/me` e desenhar a troca antes de qualquer navegação. Se
   * mesmo assim uma rota escapar e recusar por senha pendente, quem chama
   * fica sabendo pelo fato de negócio — e leva a pessoa para a troca em vez
   * de desenhar um erro de permissão que ela não tem como resolver.
   */
  whenPasswordChangeRequired(handler: (() => void) | null): void {
    this.passwordChangeHandler = handler;
  }

  reviewFailure(error: unknown): void {
    if (endsSession(error)) this.endSessionHandler?.();
    if (SessionPolicy.requiresPasswordChange(error)) this.passwordChangeHandler?.();
  }

  private static requiresPasswordChange(error: unknown): boolean {
    return (
      error instanceof ApiError &&
      error.status === SessionPolicy.PASSWORD_CHANGE_REQUIRED_STATUS &&
      error.code === SessionPolicy.PASSWORD_CHANGE_REQUIRED_CODE
    );
  }
}
