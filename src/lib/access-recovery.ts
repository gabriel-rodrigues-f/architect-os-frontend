import { DoorRefusal } from "./door-refusal";
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
 *   única saída é pedir outro link.
 *
 *   **400 senha fraca** — os mesmos códigos de recusa que a troca de senha já
 *   trata, e a exigência volta apontada na lista.
 *
 * Fora das duas, a porta cala e diz a frase do dono.
 *
 * QUEM ESCOLHE A FRASE É A `DoorRefusal` (dono, 2026-09-09). Esta tela é uma
 * das portas, e a régua da porta é uma só — o que ficou aqui é o que só ela
 * sabe: que um link recusado tira o FORMULÁRIO da tela e põe no lugar o
 * pedido de um link novo. Mudou junto a frase do link morto: era a DO
 * SERVIÇO, e o serviço só escreve pt-BR — esta tela também existe em inglês.
 */
export class SetPasswordRefusal {
  static readonly REFUSED_LINK_CODE = DoorRefusal.REFUSED_LINK_CODE;

  private constructor(
    readonly reason: SetPasswordRefusalReason,
    /** A frase NOSSA, nos dois idiomas — sempre; a do serviço não chega à tela. */
    readonly messageKey: MessageKey,
    readonly requirement: PasswordRequirement | null,
  ) {}

  static of(error: unknown): SetPasswordRefusal {
    const door = DoorRefusal.of(error);
    return new SetPasswordRefusal(
      SetPasswordRefusal.reasonOf(error, door),
      door.messageKey,
      door.requirement,
    );
  }

  private static reasonOf(error: unknown, door: DoorRefusal): SetPasswordRefusalReason {
    if (door.asksForANewLink) return "refusedLink";
    return PasswordRefusal.of(error).reason === "weak" ? "weakPassword" : "other";
  }

  /**
   * O link morreu: não adianta corrigir a senha, a tela precisa oferecer
   * pedir outro. É a mesma saída de quem chega sem token nenhum.
   */
  get asksForANewLink(): boolean {
    return this.reason === "refusedLink";
  }
}
