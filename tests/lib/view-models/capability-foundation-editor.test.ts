import { describe, expect, it } from "vitest";

import { CompetencyCountRange } from "@/lib/curation-policy";
import { CapabilityFoundationEditor } from "@/lib/view-models";

/**
 * Onda 37, item 1 — o editor do ato de FUNDAR a capacidade. O piso e o teto
 * são os da política vigente (aqui 3..4), nunca literais da tela.
 */
const range = CompetencyCountRange.of({ maxActiveCompetencies: 4 });

describe("CapabilityFoundationEditor", () => {
  it("nasce com um bloco por competência mínima da política", () => {
    expect(CapabilityFoundationEditor.begin(range).competencyNames).toEqual(["", "", ""]);
  });

  it("é imutável: cada mudança devolve outro editor", () => {
    const editor = CapabilityFoundationEditor.begin(range);
    const renomeado = editor.withName("Governança");

    expect(editor.name).toBe("");
    expect(renomeado.name).toBe("Governança");
  });

  it("só é válido com o nome e TODOS os blocos preenchidos", () => {
    const semNome = CapabilityFoundationEditor.begin(range)
      .withCompetencyName(0, "A")
      .withCompetencyName(1, "B")
      .withCompetencyName(2, "C");
    expect(semNome.isValid).toBe(false);

    const completo = semNome.withName("Governança");
    expect(completo.isValid).toBe(true);

    expect(completo.withCompetencyName(1, "   ").isValid).toBe(false);
  });

  it("adiciona blocos até o teto da política e para", () => {
    const editor = CapabilityFoundationEditor.begin(range).addCompetency();

    expect(editor.competencyNames).toHaveLength(4);
    expect(editor.canAddCompetency).toBe(false);
    expect(editor.addCompetency().competencyNames).toHaveLength(4);
  });

  it("remove só os blocos acima do mínimo", () => {
    const editor = CapabilityFoundationEditor.begin(range).addCompetency();

    expect(editor.canRemoveCompetency(3)).toBe(true);
    expect(editor.canRemoveCompetency(0)).toBe(false);
    expect(editor.removeCompetency(3).competencyNames).toHaveLength(3);
    expect(editor.removeCompetency(0).competencyNames).toHaveLength(4);
  });

  it("o pedido sai com os nomes aparados e a capacidade ativa", () => {
    const editor = CapabilityFoundationEditor.begin(range)
      .withName("  Governança de Dados  ")
      .withCompetencyName(0, "  Qualidade de Dado ")
      .withCompetencyName(1, "Catálogo")
      .withCompetencyName(2, "Linhagem");

    expect(editor.payload()).toEqual({
      name: "Governança de Dados",
      active: true,
      competencies: [{ name: "Qualidade de Dado" }, { name: "Catálogo" }, { name: "Linhagem" }],
    });
  });

  it("editor inválido não produz pedido", () => {
    expect(CapabilityFoundationEditor.begin(range).payload()).toBeNull();
  });
});
