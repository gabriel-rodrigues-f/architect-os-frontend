import { ApiError } from "./api-errors";
import { RefusalNumber } from "./refusal-number";

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

  /**
   * REGRA 18 (dono, 2026-09-09): esta marca é recusa de **ATO** e fica em
   * 403. Ela não fala de recurso alheio — fala do estado da PRÓPRIA sessão de
   * quem pergunta, e não conta a existência de nada. Virar 404 desligaria a
   * rede de segurança da onda 41: quem está em primeiro acesso e escapa do
   * `AuthGate` deixaria de ser levado à troca de senha e ficaria sem caminho
   * de saída. O casamento é status **e** código, e é a única coisa que
   * distingue esta recusa de uma recusa qualquer — não é o código separando
   * famílias, é o código nomeando o mecanismo.
   */
  private static readonly PASSWORD_CHANGE_REQUIRED_STATUS = RefusalNumber.ACT;

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
