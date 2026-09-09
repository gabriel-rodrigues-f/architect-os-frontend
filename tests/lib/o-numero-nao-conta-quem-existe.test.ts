import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-errors";
import { ApiFailureReading } from "@/lib/api-failure-reading";
import { RefusalNumber } from "@/lib/refusal-number";
import { defaultUiAuthorizationPolicy } from "@/lib/scope";
import { TeamRegistryViewModel } from "@/lib/view-models";

/**
 * REGRA 18 (dono, 2026-09-09): *"se eu não posso acessar, aquela rota não
 * existe pra mim."*
 *
 * O defeito que a regra fecha é um ORÁCULO: um recurso que EXISTE mas está
 * fora do alcance respondia 403, e um que NÃO EXISTE responde 404 — comparar
 * as duas respostas contava quem existe, para qualquer conta.
 *
 * A fatia de erro do frontend tinha acabado de publicar esse mesmo oráculo NA
 * TELA: `ReadingRefused` passou a escolher a frase pela situação, e quem
 * digitasse o endereço de uma pessoa lia "você não tem permissão" se ela
 * existisse e "não encontramos" se não. Este arquivo é a prova, do lado de
 * cá, de que as duas frases voltaram a ser uma só — e de que a distinção não
 * reapareceu por outra porta.
 *
 * Estes testes não simulam servidor nenhum: afirmam a régua da tela. É a
 * lacuna que a verificação mediu — nenhum dos 43 pontos de teste do frontend
 * fica vermelho quando o backend troca o status, então a onda passaria
 * *"verde e calada, que é pior do que quebrar"*.
 */
describe("recusa de alcance e recurso inexistente são a MESMA leitura", () => {
  it("as duas caem na mesma situação — nada na tela as separa", () => {
    const forcaDoAlcance = ApiFailureReading.of(RefusalNumber.OUT_OF_REACH);
    const inexistente = ApiFailureReading.of(404);

    expect(forcaDoAlcance.situation).toBe(inexistente.situation);
    expect(forcaDoAlcance.messageKey).toBe(inexistente.messageKey);
    expect(forcaDoAlcance.sentence).toBe(inexistente.sentence);
  });

  it("a recusa de ATO continua tendo frase própria — ela diz o que fazer", () => {
    const ato = ApiFailureReading.of(RefusalNumber.ACT);

    expect(ato.messageKey).toBe("error.forbidden");
    expect(ato.messageKey).not.toBe(ApiFailureReading.of(RefusalNumber.OUT_OF_REACH).messageKey);
  });

  /**
   * A régua olha o NÚMERO, nunca o código. Se o código separasse alcance de
   * inexistente, ele viraria o oráculo que o número deixou de ser, e a regra
   * voltaria ao começo — foi por isso que o dono reverteu esta mesma troca em
   * 2026-08-28: *"404 esconde o status, não a mensagem."*
   */
  it("o código não muda a leitura: dois 404 com códigos diferentes leem igual", () => {
    const doAlcance = ApiFailureReading.ofFailure(
      new ApiError("PDI não encontrado", 404, undefined, "PLAN_OUT_OF_REACH"),
    );
    const doInexistente = ApiFailureReading.ofFailure(
      new ApiError("PDI não encontrado", 404, undefined, "NOT_FOUND"),
    );

    expect(doAlcance.sentence).toBe(doInexistente.sentence);
  });

  it("a família reconhece cada número, e só reconhece resposta do serviço", () => {
    expect(RefusalNumber.isAct(new ApiError("x", 403))).toBe(true);
    expect(RefusalNumber.isAct(new ApiError("x", 404))).toBe(false);
    expect(RefusalNumber.isOutOfReach(new ApiError("x", 404))).toBe(true);
    expect(RefusalNumber.isOutOfReach(new ApiError("x", 403))).toBe(false);
    expect(RefusalNumber.isOutOfReach(new TypeError("Failed to fetch"))).toBe(false);
    expect(RefusalNumber.isAct(undefined)).toBe(false);
  });
});

/**
 * O outro lado da mesma regra, na tela onde ela custa mais caro: mudar a
 * pessoa de time. As duas recusas que chegam ali são de ATO, ficam em 403 e
 * a frase delas É o roteiro — *"o Gerente do time atual pede a transferência
 * e o Gerente do time de destino aprova"*. Já uma recusa de ALCANCE viaja com
 * o corpo de "não encontrado", byte a byte igual ao de recurso inexistente:
 * repeti-la aqui colaria "não encontrado" embaixo de um nome que a própria
 * tela acabou de listar.
 */
describe("a frase do serviço só sobe na recusa de ato", () => {
  const registry = new TeamRegistryViewModel(defaultUiAuthorizationPolicy);

  it("403 fala: o roteiro da transferência é instrução, não erro", () => {
    const recusa = new ApiError(
      "O Gerente do time atual pede a transferência e o Gerente do time de destino aprova.",
      RefusalNumber.ACT,
      undefined,
      "TEAM_TRANSFER_REQUIRES_REQUEST",
    );

    expect(registry.allocationRefusalOf(recusa)).toBe(recusa.message);
  });

  it("409 continua falando — conflito não é recusa de alcance", () => {
    const conflito = new ApiError("Alguém mudou este time antes de você.", 409);
    expect(registry.allocationRefusalOf(conflito)).toBe(conflito.message);
  });

  it("404 cala: a tela diz a frase da casa, e a recusa não conta nada", () => {
    const foraDoAlcance = new ApiError(
      "profissional não encontrado",
      RefusalNumber.OUT_OF_REACH,
      undefined,
      "NOT_FOUND",
    );

    expect(registry.allocationRefusalOf(foraDoAlcance)).toBeNull();
  });
});
