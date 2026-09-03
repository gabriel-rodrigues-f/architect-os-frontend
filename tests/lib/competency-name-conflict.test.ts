import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-errors";
import { CompetencyNameConflict } from "@/lib/competency-name-conflict";

/**
 * Onda 36.1/37 — pedido do dono: *"se eu tentar incluir uma competencia na
 * mesma capacidade, quero receber uma mensagem adequada na tela e ser impedido
 * de seguir. se eu tentar inserir uma competencia que já exista em outra
 * capacidade, quero receber uma mensagem adequada, me dizendo em qual
 * capacidade essa competencia já existe"*.
 *
 * A mensagem é a DO SERVIÇO (contrato: as mensagens PT-BR são exibidas cruas);
 * esta classe só decide de qual campo ela é, para a tela grudá-la ali e travar
 * o envio enquanto o nome recusado não mudar.
 */
const refusalInSameCapability = new ApiError(
  'A competência "Kubernetes" já existe na capacidade "Cloud Architecture" — escolha outro nome.',
  409,
  undefined,
  "COMPETENCY_NAME_TAKEN_IN_CAPABILITY",
);

const refusalInAnotherCapability = new ApiError(
  'A competência "Kubernetes" já existe na capacidade "Cloud Architecture" — o nome de uma competência não se repete entre capacidades.',
  409,
  undefined,
  "COMPETENCY_NAME_TAKEN_IN_ANOTHER_CAPABILITY",
);

describe("CompetencyNameConflict", () => {
  it("reconhece as duas recusas de nome tomado e carrega a mensagem do serviço", () => {
    for (const refusal of [refusalInSameCapability, refusalInAnotherCapability]) {
      const conflict = CompetencyNameConflict.from(refusal);
      expect(conflict?.message).toBe(refusal.message);
    }
  });

  it("ignora o que não é recusa de nome tomado", () => {
    expect(CompetencyNameConflict.from(new Error("qualquer coisa"))).toBeNull();
    expect(
      CompetencyNameConflict.from(
        new ApiError("limite atingido", 409, undefined, "CAPABILITY_COMPETENCY_LIMIT_REACHED"),
      ),
    ).toBeNull();
  });

  it("trava o nome recusado — e só ele, sem caixa nem acento", () => {
    const conflict = CompetencyNameConflict.from(refusalInSameCapability);

    expect(conflict?.blocks("Kubernetes")).toBe(true);
    expect(conflict?.blocks("  kubernetes  ")).toBe(true);
    expect(conflict?.blocks("Kubernetes Avançado")).toBe(false);
  });

  it("compara sem acento: 'Governanca' e 'Governança' são o mesmo nome", () => {
    const conflict = CompetencyNameConflict.from(
      new ApiError(
        'A competência "Governança" já existe na capacidade "Dados" — escolha outro nome.',
        409,
        undefined,
        "COMPETENCY_NAME_TAKEN_IN_CAPABILITY",
      ),
    );

    expect(conflict?.blocks("governanca")).toBe(true);
  });

  it("aponta a posição do bloco recusado no modal de fundação", () => {
    const conflict = CompetencyNameConflict.from(refusalInAnotherCapability);

    expect(conflict?.positionIn(["Serverless", "Kubernetes", ""])).toBe(1);
    expect(conflict?.positionIn(["Serverless", "IAM"])).toBe(-1);
  });
});
