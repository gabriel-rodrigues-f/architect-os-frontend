import { describe, expect, it } from "vitest";

import { DEFAULT_TEXT_TEMPLATES } from "@/lib/text-templates";
import { TextTemplateEditor } from "@/lib/view-models/text-template-editor";

/**
 * CFG-03 (admin UI) — o ViewModel do editor de template de texto: validação
 * client-side espelhando o VO do backend (não-vazio, só variáveis da key) e
 * preview pelo MESMO interpolador do app.
 */
describe("TextTemplateEditor (CFG-03 admin UI)", () => {
  const key = "pdi.objective.fromGap" as const;
  const pt = DEFAULT_TEXT_TEMPLATES[key]["pt"]!;

  it("nasce válido e limpo a partir do template efetivo", () => {
    const editor = TextTemplateEditor.from(key, "pt", pt);
    expect(editor.isValid).toBe(true);
    expect(editor.isDirty).toBe(false);
    expect(editor.allowedVariables).toEqual(["competencia", "atual", "alvo"]);
  });

  it("template vazio (ou só espaços) invalida", () => {
    const editor = TextTemplateEditor.from(key, "pt", pt).withDraft("   ");
    expect(editor.isEmpty).toBe(true);
    expect(editor.isValid).toBe(false);
  });

  it("variável que a key não fornece invalida e é listada (ficaria literal para sempre)", () => {
    const editor = TextTemplateEditor.from(key, "pt", pt).withDraft(
      "Evoluir {competencia} com apoio de {gestor} e {mentor}",
    );
    expect(editor.unknownVariables).toEqual(["gestor", "mentor"]);
    expect(editor.isValid).toBe(false);
  });

  it("preview interpola com os valores de exemplo; placeholder sem valor fica literal", () => {
    const editor = TextTemplateEditor.from(key, "pt", pt).withDraft(
      "Levar {competencia} de {atual} a {alvo}",
    );
    expect(editor.isDirty).toBe(true);
    expect(editor.preview({ competencia: "APIs", atual: 2, alvo: 4 })).toBe("Levar APIs de 2 a 4");
    expect(editor.preview({ competencia: "APIs" })).toBe("Levar APIs de {atual} a {alvo}");
  });
});
