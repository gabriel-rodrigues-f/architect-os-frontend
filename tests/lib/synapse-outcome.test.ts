import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-errors";
import { networkUnavailableError } from "@/lib/api-client";
import { DoorRefusal } from "@/lib/door-refusal";
import { SynapseOutcomeRule } from "@/lib/synapse-outcome";

/**
 * A RÉGUA DE COR sobrou só para a PORTA (dono, 2026-09-08: *"vamos manter a
 * sinapse dentro da aplicação pós usuário logado, mas remova a piscada, tanto
 * azul quanto vermelha"*). O interior não pulsa mais por resultado, então a
 * régua de escrita, a lista de rotas silenciosas e o anúncio coalescido
 * saíram — e com eles os testes que os provavam. O que a porta faz continua
 * provado aqui.
 *
 * A COR SEGUE A MESMA PARTIÇÃO DA FRASE (dono, 2026-09-09). Antes, vermelho
 * era "não foi queda de serviço" — e no dia em que a frase virasse uma só, a
 * cor passaria a contar a diferença que o texto parou de contar: pulso
 * vermelho = a casa avaliou a credencial; sem pulso = a casa está fora. Um
 * canal paralelo, visível sem ler nada e legível por script pelo
 * `aria-invalid` que anda junto.
 *
 * Agora vermelho quer dizer UMA coisa: o que você digitou foi recusado.
 */
describe("SynapseOutcomeRule — a resposta às portas (login, primeiro acesso, senha, recuperação)", () => {
  const credencialRecusada = new ApiError(
    "E-mail ou senha inválidos.",
    401,
    undefined,
    DoorRefusal.INVALID_CREDENTIALS_CODE,
  );

  it("sucesso é primário", () => {
    expect(SynapseOutcomeRule.toneOfDoorResult(null)).toBe("primary");
  });

  it("a recusa DO QUE FOI DIGITADO pulsa vermelho: credencial, senha fraca, senha atual errada", () => {
    expect(SynapseOutcomeRule.toneOfDoorResult(credencialRecusada)).toBe("danger");
    expect(
      SynapseOutcomeRule.toneOfDoorResult(
        new ApiError("senha fraca", 400, { requirement: "symbol" }, "WEAK_PASSWORD"),
      ),
    ).toBe("danger");
    expect(
      SynapseOutcomeRule.toneOfDoorResult(
        new ApiError("senha atual não confere", 401, undefined, "INVALID_CURRENT_PASSWORD"),
      ),
    ).toBe("danger");
  });

  /** A recusa local nasceu deste lado, do que a pessoa fez no formulário. */
  it("a recusa local continua vermelha — ela não conta nada da casa", () => {
    expect(SynapseOutcomeRule.toneOfDoorResult(new Error("senha não confere"))).toBe("danger");
  });

  it("o serviço fora do ar não é culpa do que foi digitado: 0 e 5xx não pulsam", () => {
    expect(SynapseOutcomeRule.toneOfDoorResult(networkUnavailableError(new Error()))).toBeNull();
    expect(SynapseOutcomeRule.toneOfDoorResult(new ApiError("caiu", 503))).toBeNull();
  });

  /**
   * Estas TRÊS falam na tela e mesmo assim não pintam o campo: a pessoa
   * digitou certo, o problema está noutro lugar. É a correção que a auditoria
   * de 2026-09-09 pediu — "hoje qualquer falha pinta o campo, o que sugere à
   * pessoa que ela digitou errado quando o problema é da casa".
   */
  it("recusa que NÃO é do que foi digitado fala, mas não pulsa: conta desabilitada, 429, link vencido", () => {
    const naoDigitadas = [
      new ApiError("conta desabilitada", 401, undefined, DoorRefusal.ACCOUNT_DISABLED_CODE),
      new ApiError("muitas tentativas", DoorRefusal.TOO_MANY_ATTEMPTS_STATUS),
      new ApiError("link vencido", 401, undefined, DoorRefusal.REFUSED_LINK_CODE),
    ];
    for (const recusa of naoDigitadas) {
      expect(SynapseOutcomeRule.toneOfDoorResult(recusa)).toBeNull();
      expect(DoorRefusal.of(recusa).messageKey).not.toBe(DoorRefusal.SILENCE);
    }
  });

  /** Um 404 ou um código desconhecido não é recusa de credencial: não pulsa. */
  it("o que a porta não reconhece cala e não pulsa", () => {
    for (const desconhecida of [
      new ApiError("Rota POST /api/v1/auth/login não existe", 404, undefined, "ROUTE_NOT_FOUND"),
      new ApiError("qualquer", 409, undefined, "SEJA_QUAL_FOR"),
    ]) {
      expect(SynapseOutcomeRule.toneOfDoorResult(desconhecida)).toBeNull();
      expect(DoorRefusal.of(desconhecida).messageKey).toBe(DoorRefusal.SILENCE);
    }
  });
});
