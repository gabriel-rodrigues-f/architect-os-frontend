import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-errors";
import { networkUnavailableError } from "@/lib/api-client";
import { SynapseOutcomeRule } from "@/lib/synapse-outcome";

/**
 * A RÉGUA DE COR sobrou só para a PORTA (dono, 2026-09-08: *"vamos manter a
 * sinapse dentro da aplicação pós usuário logado, mas remova a piscada, tanto
 * azul quanto vermelha"*). O interior não pulsa mais por resultado, então a
 * régua de escrita, a lista de rotas silenciosas e o anúncio coalescido
 * saíram — e com eles os testes que os provavam. O que a porta faz continua
 * provado aqui.
 */
describe("SynapseOutcomeRule — a resposta às portas (login, primeiro acesso, senha, recuperação)", () => {
  it("sucesso é primário; a recusa do serviço (401, 400) e a recusa local são `danger`", () => {
    expect(SynapseOutcomeRule.toneOfDoorResult(null)).toBe("primary");
    expect(SynapseOutcomeRule.toneOfDoorResult(new ApiError("recusado", 401))).toBe("danger");
    expect(SynapseOutcomeRule.toneOfDoorResult(new ApiError("senha fraca", 400))).toBe("danger");
    expect(SynapseOutcomeRule.toneOfDoorResult(new Error("senha não confere"))).toBe("danger");
  });

  it("o serviço fora do ar não é culpa do que foi digitado: 0 e 5xx não pulsam", () => {
    expect(SynapseOutcomeRule.toneOfDoorResult(networkUnavailableError(new Error()))).toBeNull();
    expect(SynapseOutcomeRule.toneOfDoorResult(new ApiError("caiu", 503))).toBeNull();
  });
});
