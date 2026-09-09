import { describe, expect, it } from "vitest";

import { AccessInvitation, SetPasswordRefusal } from "@/lib/access-recovery";
import { ApiError } from "@/lib/api-errors";

/**
 * A recuperação de acesso, no nível em que ela é regra e não desenho.
 *
 * O contrato fechado desta fatia (2026-09-04):
 *   o link do e-mail aponta para `<origem>/set-password?token=<token>`;
 *   `POST /auth/set-password` responde **204**, recusa com **401**
 *   `ACCESS_INVITATION_REFUSED` quando o link é desconhecido, venceu, já foi
 *   usado ou foi substituído — e a mensagem do corpo já vem escrita para a
 *   pessoa ler —, e recusa com **400** nos mesmos códigos de senha fraca que
 *   a troca de senha já trata.
 */

/** A recusa do link, como o serviço a devolve. */
const linkRecusado = (frase: string) =>
  new ApiError(frase, 401, undefined, SetPasswordRefusal.REFUSED_LINK_CODE);

const senhaFraca = (requirement: string) =>
  new ApiError("Senha recusada.", 400, { requirement }, "WEAK_PASSWORD");

describe("o convite que chega pelo link", () => {
  it("o token do endereço é o convite", () => {
    expect(AccessInvitation.of("um-token-qualquer")?.token).toBe("um-token-qualquer");
  });

  it("link sem o parâmetro não é convite nenhum", () => {
    expect(AccessInvitation.of(undefined)).toBeNull();
  });

  /**
   * Quem cola meio endereço na barra chega com `?token=`. Mandar isso ao
   * serviço só troca uma explicação que a tela sabe dar por uma recusa que
   * ela teria de traduzir.
   */
  it("token em branco é o mesmo que token nenhum", () => {
    expect(AccessInvitation.of("")).toBeNull();
    expect(AccessInvitation.of("   ")).toBeNull();
  });

  it("o espaço que o cliente de e-mail cola em volta não muda o token", () => {
    expect(AccessInvitation.of("  abc-123  ")?.token).toBe("abc-123");
  });

  it("lê o token da query da rota pelo nome que o backend monta no link", () => {
    expect(AccessInvitation.TOKEN_PARAM).toBe("token");
    expect(AccessInvitation.tokenIn({ token: "do-link" })).toBe("do-link");
    expect(AccessInvitation.tokenIn({})).toBeUndefined();
    expect(AccessInvitation.tokenIn({ token: 42 })).toBeUndefined();
    expect(AccessInvitation.tokenIn({ token: "" })).toBeUndefined();
  });
});

describe("a recusa de criar a senha pelo convite", () => {
  /**
   * A frase do link morto é NOSSA (dono, 2026-09-09). Era a DO SERVIÇO, com o
   * argumento de que o contrato já a escreve para a pessoa — mas o serviço só
   * escreve pt-BR e esta tela também existe em inglês. E a distinção entre
   * desconhecido, vencido, usado e substituído não muda o próximo gesto dela:
   * em todos os quatro, o gesto é pedir outro link.
   */
  it("link recusado fala pela chave da casa, não pela frase do serviço", () => {
    const recusa = SetPasswordRefusal.of(linkRecusado("Este convite já foi usado."));

    expect(recusa.reason).toBe("refusedLink");
    expect(recusa.messageKey).toBe("setPassword.refusedLink.lead");
  });

  it("link recusado pede um link novo — não é a senha que está errada", () => {
    expect(SetPasswordRefusal.of(linkRecusado("qualquer")).asksForANewLink).toBe(true);
  });

  /**
   * A senha fraca é o outro extremo: o link serve, o formulário é que precisa
   * de conserto. Quem lê é a `PasswordRefusal` que já existia — a lista de
   * exigências é a mesma, e ela fala nos dois idiomas.
   */
  it("senha fraca reaproveita a leitura do primeiro acesso, com a exigência apontada", () => {
    const recusa = SetPasswordRefusal.of(senhaFraca("symbol"));

    expect(recusa.reason).toBe("weakPassword");
    expect(recusa.requirement).toBe("symbol");
    expect(recusa.messageKey).toBe("password.refused.symbol");
    expect(recusa.asksForANewLink).toBe(false);
  });

  it("senha fraca sem exigência nomeada cai na frase que manda olhar a lista", () => {
    const recusa = SetPasswordRefusal.of(new ApiError("x", 400, undefined, "WEAK_PASSWORD"));

    expect(recusa.messageKey).toBe("password.refused.weak");
    expect(recusa.requirement).toBeNull();
  });

  /**
   * Fora dos dois códigos do contrato, a porta CALA: a frase do dono, e nada
   * do que o serviço tenha escrito. Um 503 traz a frase que anuncia o banco de
   * dados fora do ar; ela não muda o próximo gesto de ninguém.
   */
  it("qualquer outra falha recebe a frase do dono", () => {
    for (const outra of [
      new ApiError(
        "Banco de dados temporariamente indisponível.",
        503,
        undefined,
        "DATABASE_UNAVAILABLE",
      ),
      new ApiError("Rota POST /api/v1/auth/set-password não existe", 404),
      new TypeError("quebrou no meio do caminho"),
      "nem erro é",
    ]) {
      const recusa = SetPasswordRefusal.of(outra);
      expect(recusa.reason).toBe("other");
      expect(recusa.messageKey).toBe("error.unavailable");
      expect(recusa.asksForANewLink).toBe(false);
    }
  });
});
