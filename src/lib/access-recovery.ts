import { ApiError } from "./api-errors";
import type { MessageKey } from "./i18n";
import { PasswordRefusal, type PasswordRequirement } from "./password-safety";

/**
 * A RECUPERAÇÃO DE ACESSO — o convite que chega por link, e o que o serviço
 * responde quando a pessoa tenta usá-lo.
 *
 * Pedido do dono (2026-09-04): *"quero poder resetar a senha do usuário / uma
 * senha inicial precisa ser enviada a ele por e-mail"* — e, ao escolher o
 * desenho, ele corrigiu o próprio pedido: **"a senha não deve ser enviada por
 * e-mail"**. O e-mail leva um LINK; quem escolhe a senha é a pessoa. Essa
 * frase é a régua de todo texto desta fatia, e é por isso que nada aqui tem
 * nome de "senha enviada": o que viaja é o convite.
 *
 * O contrato, fechado antes desta fatia:
 *   `POST /auth/access-recovery`          público, sempre 202
 *   `POST /auth/users/:id/access-recovery` autenticado, 202
 *   `POST /auth/set-password`             público, 204 — recusa com 401
 *                                         `ACCESS_INVITATION_REFUSED`
 */

/**
 * O convite que veio no link: `<origem>/set-password?token=<token>`.
 *
 * O token é OPACO — esta tela não lê nada dele, nem o e-mail de quem foi
 * convidado. Ela só sabe se ele veio ou não veio, e é essa a única pergunta
 * que a tela precisa responder antes de desenhar o formulário.
 */
export class AccessInvitation {
  /** O nome do parâmetro na URL do link. É o backend que monta o endereço. */
  static readonly TOKEN_PARAM = "token";

  private constructor(readonly token: string) {}

  /**
   * Um token em branco é o mesmo que token nenhum: quem colou meio endereço
   * na barra chega aqui com `?token=`, e mandar isso ao serviço só troca uma
   * explicação por uma recusa.
   */
  static of(token: string | undefined): AccessInvitation | null {
    if (token === undefined) return null;
    const clean = token.trim();
    return clean === "" ? null : new AccessInvitation(clean);
  }

  /** O token achado na query da rota, ou `undefined` quando o link veio sem ele. */
  static tokenIn(search: Record<string, unknown>): string | undefined {
    const found = search[AccessInvitation.TOKEN_PARAM];
    return typeof found === "string" ? (AccessInvitation.of(found)?.token ?? undefined) : undefined;
  }
}

export type SetPasswordRefusalReason = "refusedLink" | "weakPassword" | "other";

/**
 * A recusa de `POST /auth/set-password`, lida como fato de negócio.
 *
 * Duas recusas, e elas pedem saídas OPOSTAS — é por isso que a leitura
 * existe, em vez de a tela mostrar uma frase qualquer para as duas:
 *
 *   **401 `ACCESS_INVITATION_REFUSED`** — o link é desconhecido, venceu, já
 *   foi usado ou foi substituído. Não há nada a corrigir no formulário: a
 *   única saída é pedir outro link. O CONTRATO diz que a frase do corpo já
 *   vem escrita para a pessoa ler, então é a frase DO SERVIÇO que a tela
 *   mostra — inventar outra aqui produziria duas versões do mesmo fato.
 *
 *   **400 senha fraca** — os mesmos códigos de recusa que a troca de senha já
 *   trata, então quem lê é a `PasswordRefusal` que já existe, e a exigência
 *   volta apontada na lista. A frase é NOSSA porque a lista é nossa e existe
 *   nos dois idiomas (a mesma exceção que a `PasswordRefusal` já declara).
 *
 * Fora das duas, a leitura devolve tudo nulo e quem chama cai na frase da
 * situação (`authErrorMessage` → `ApiFailureReading`).
 */
export class SetPasswordRefusal {
  static readonly REFUSED_LINK_CODE = "ACCESS_INVITATION_REFUSED";

  private constructor(
    readonly reason: SetPasswordRefusalReason,
    /** A frase do SERVIÇO, quando o contrato diz que ela é para a pessoa ler. */
    readonly serviceSentence: string | null,
    /** A frase NOSSA, quando quem sabe explicar é a lista de exigências. */
    readonly messageKey: MessageKey | null,
    readonly requirement: PasswordRequirement | null,
  ) {}

  static of(error: unknown): SetPasswordRefusal {
    if (error instanceof ApiError && error.code === SetPasswordRefusal.REFUSED_LINK_CODE) {
      return new SetPasswordRefusal("refusedLink", error.message, null, null);
    }
    const password = PasswordRefusal.of(error);
    if (password.reason === "weak") {
      return new SetPasswordRefusal(
        "weakPassword",
        null,
        password.messageKey,
        password.requirement,
      );
    }
    return new SetPasswordRefusal("other", null, null, null);
  }

  /**
   * O link morreu: não adianta corrigir a senha, a tela precisa oferecer
   * pedir outro. É a mesma saída de quem chega sem token nenhum.
   */
  get asksForANewLink(): boolean {
    return this.reason === "refusedLink";
  }
}
