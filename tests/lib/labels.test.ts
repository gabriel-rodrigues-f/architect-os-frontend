import { describe, expect, it } from "vitest";

import { LABEL_KEY_MAPS, LabelFormatter } from "@/lib/labels";
import type { MessageKey } from "@/lib/i18n";

/**
 * OO2-08 (AUDITORIA-OO-PADRONIZACAO-ANALYTICS-IA-SYNAPSE-2026-08-25.md,
 * Seção 68) — `useLabels()` virou um adaptador fino em cima de
 * `LabelFormatter`; estes testes exercitam a classe direto, com um `t`
 * falso (sem montar `I18nProvider`), confirmando que cada mapa vira um
 * `Record` de string traduzida, igual ao que `useLabels()` sempre devolveu.
 */
describe("LabelFormatter", () => {
  // `t` de teste: devolve a própria chave, prefixada, só para provar que o
  // valor passou pela função de tradução recebida no construtor.
  const fakeT = (key: MessageKey): string => `t:${key}`;
  const labels = new LabelFormatter(fakeT);

  it("traduz o mapa de status do PDI", () => {
    expect(labels.planStatus).toEqual({
      Draft: "t:status.draft",
      Approved: "t:status.approved",
      Completed: "t:status.completed",
    });
  });

  it("planItemStatus usa as chaves com concordância de gênero (item = fem.)", () => {
    expect(labels.planItemStatus.Blocked).toBe("t:status.planItem.blocked");
    expect(labels.planItemStatus.Completed).toBe("t:status.planItem.completed");
  });

  it("assessmentStatus usa a chave feminina de concluído, distinta da do PDI", () => {
    expect(labels.assessmentStatus.Completed).toBe("t:status.assessment.completed");
    expect(labels.assessmentStatus.Completed).not.toBe(labels.planStatus.Completed);
  });

  it("levelName/levelDescription cobrem os 5 níveis", () => {
    expect(Object.keys(labels.levelName)).toEqual(["1", "2", "3", "4", "5"]);
    expect(labels.levelName[3]).toBe("t:level.3");
    expect(labels.levelDescription[3]).toBe("t:level.3.description");
  });

  it("o laço do construtor cobre exatamente os campos do registro — guarda contra mapa esquecido (OO3-11f)", () => {
    for (const nome of Object.keys(LABEL_KEY_MAPS)) {
      expect(labels[nome as keyof typeof LABEL_KEY_MAPS]).toBeDefined();
    }
  });

  it("cada instância computa os mapas a partir do `t` recebido — duas instâncias com `t`s diferentes não compartilham estado", () => {
    const other = new LabelFormatter((key) => `outro:${key}`);
    expect(other.planStatus.Draft).toBe("outro:status.draft");
    expect(labels.planStatus.Draft).toBe("t:status.draft");
  });
});
