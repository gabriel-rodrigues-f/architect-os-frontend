import { ApiError } from "./api-errors";
import { ApiFailureReading } from "./api-failure-reading";
import type { MessageKey } from "./i18n";
import { PasswordRefusal, type PasswordRequirement } from "./password-safety";

/**
 * A RECUSA NA PORTA — login, primeiro acesso, definir senha, recuperação.
 *
 * Ordem do dono (2026-09-09): *"os erros do frontend precisam ser o mais
 * genéricos possível. No login, por exemplo, precisamos mostrar 'Não é
 * possível acessar a aplicação agora. Entre em contato com um
 * administrador.'"*
 *
 * A porta ESCOLHE POR CÓDIGO, nunca por faixa de status, e a diferença não é
 * de estilo: `ApiFailureReading` lê 401 como "sua sessão expirou", e a porta é
 * exatamente o lugar onde não há sessão para expirar — quem está tentando
 * ABRIR uma sessão receberia a frase de quem perdeu a dela. Genericizar por
 * faixa aqui não deixaria a porta muda, deixaria a porta ERRADA.
 *
 * A régua, caso a caso: *com esta frase, o que ELA faz agora?*
 *
 *  - `INVALID_CREDENTIALS` → confere o e-mail e a senha. **Fala.**
 *  - `ACCOUNT_DISABLED` → fala com um administrador; é a única frase que
 *    explica a uma pessoa recém-desligada por que ela não entra, e só é
 *    alcançável DEPOIS de a senha conferir, então não é sonda. **Fala.**
 *  - 429 → espera o balde esvaziar; sem ela, a pessoa martela a porta e culpa
 *    a própria senha. **Fala.**
 *  - `ACCESS_INVITATION_REFUSED` → pede um link novo; corrigir a senha não
 *    resolveria nada. **Fala.**
 *  - `WEAK_PASSWORD` → corrige o item da lista que ficou vermelho. **Fala**,
 *    pela `PasswordRefusal`, que já sabe apontar a exigência.
 *  - Todo o resto — sem resposta, 5xx, 404 com ou sem corpo, código
 *    desconhecido → **cala**, e diz a frase do dono. Nada ali muda o próximo
 *    gesto de quem lê; tudo ali conta como a casa é por dentro.
 *
 * A frase é NOSSA e vem do dicionário, nos dois idiomas. A do backend só
 * existe em pt-BR e mostraria português a quem escolheu inglês — a mesma
 * exceção que a `PasswordRefusal` já declara, agora valendo para a porta
 * inteira.
 */
export class DoorRefusal {
  static readonly INVALID_CREDENTIALS_CODE = "INVALID_CREDENTIALS";

  static readonly ACCOUNT_DISABLED_CODE = "ACCOUNT_DISABLED";

  static readonly REFUSED_LINK_CODE = "ACCESS_INVITATION_REFUSED";

  static readonly TOO_MANY_ATTEMPTS_STATUS = 429;

  /** A frase do dono, para tudo o que a porta não reconhece. */
  static readonly SILENCE: MessageKey = "error.unavailable";

  private static readonly BY_CODE: Readonly<Record<string, MessageKey>> = {
    [DoorRefusal.INVALID_CREDENTIALS_CODE]: "door.refused.credentials",
    [DoorRefusal.ACCOUNT_DISABLED_CODE]: "door.refused.accountDisabled",
    // O link morto já tinha frase nossa, nos dois idiomas, na tela que pede outro.
    [DoorRefusal.REFUSED_LINK_CODE]: "setPassword.refusedLink.lead",
  };

  /**
   * As recusas que dizem "o que VOCÊ digitou foi recusado" — as únicas que
   * podem pintar o campo e pulsar vermelho.
   *
   * Dono (2026-09-09): hoje qualquer falha pinta o campo, o que sugere à
   * pessoa que ela digitou errado quando o problema é da casa. Conta
   * desabilitada, balde cheio e link vencido FALAM, mas não são culpa do que
   * foi digitado: a frase aparece, o campo não fica vermelho.
   */
  private static readonly SOBRE_O_QUE_FOI_DIGITADO: ReadonlySet<string> = new Set([
    DoorRefusal.INVALID_CREDENTIALS_CODE,
    PasswordRefusal.WEAK_PASSWORD_CODE,
    PasswordRefusal.INVALID_CURRENT_PASSWORD_CODE,
  ]);

  private constructor(
    readonly messageKey: MessageKey,
    readonly requirement: PasswordRequirement | null,
    /** Pulso vermelho e `aria-invalid` — só quando a recusa é do que ela digitou. */
    readonly blamesWhatWasTyped: boolean,
    readonly asksForANewLink: boolean,
  ) {}

  static of(failure: unknown): DoorRefusal {
    /*
     * Uma falha que não é do serviço só pode ter nascido deste lado, do que a
     * pessoa fez no formulário — nunca do estado interno da casa. Ela pinta o
     * campo e não conta nada de dentro.
     */
    if (!(failure instanceof ApiError)) {
      return new DoorRefusal(DoorRefusal.SILENCE, null, true, false);
    }
    // Acima de 500 (e no silêncio) a casa cala inclusive o CÓDIGO: nada que
    // venha nesse corpo é resposta sobre a credencial.
    if (ApiFailureReading.of(failure.status).silencesTheService) return DoorRefusal.mute();

    const password = PasswordRefusal.of(failure);
    if (password.messageKey !== null) {
      return new DoorRefusal(
        password.messageKey,
        password.requirement,
        DoorRefusal.blames(failure.code),
        false,
      );
    }

    const known = failure.code === undefined ? undefined : DoorRefusal.BY_CODE[failure.code];
    if (known !== undefined) {
      return new DoorRefusal(
        known,
        null,
        DoorRefusal.blames(failure.code),
        failure.code === DoorRefusal.REFUSED_LINK_CODE,
      );
    }

    if (failure.status === DoorRefusal.TOO_MANY_ATTEMPTS_STATUS) {
      return new DoorRefusal("door.refused.tooManyAttempts", null, false, false);
    }
    return DoorRefusal.mute();
  }

  private static mute(): DoorRefusal {
    return new DoorRefusal(DoorRefusal.SILENCE, null, false, false);
  }

  private static blames(code: string | undefined): boolean {
    return code !== undefined && DoorRefusal.SOBRE_O_QUE_FOI_DIGITADO.has(code);
  }
}
