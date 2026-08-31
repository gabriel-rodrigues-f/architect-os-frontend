import { describe, expect, it } from "vitest";

import { ScoringBandSet } from "@/lib/scoring-bands";

/**
 * LEG-02 — a classificação prometia `ScoringBand` e devolvia
 * `sorted[sorted.length - 1]!`: com a lista de faixas vazia devolvia
 * `undefined` disfarçado de faixa, e quem lesse `.tone` quebrava longe daqui,
 * com uma mensagem que não aponta para a configuração. Sem faixa configurada
 * não existe classificação — isso é erro, não uma faixa inventada.
 */
describe("ScoringBandSet.classify sem faixas configuradas", () => {
  it("recusa classificar em vez de devolver uma faixa inexistente", () => {
    expect(() => ScoringBandSet.of([]).classify(3)).toThrow();
  });
});
