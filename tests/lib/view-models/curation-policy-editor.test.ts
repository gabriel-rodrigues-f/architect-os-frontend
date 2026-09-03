import { describe, expect, it } from "vitest";

import { EffectiveCurationPolicy } from "@/lib/curation-policy";
import { CurationPolicyEditor } from "@/lib/view-models";

/**
 * CFG-04 (SPEC-OO3-13, §3.2) — ViewModel do editor da política de curadoria
 * da aba "Catálogo" de /settings, testado isolado (sem React). Onda 36
 * (backend ADR-0081/0082): a política tem UM número — o máximo de ativas —
 * e os alvos por tipo (restritivas/não restritivas) morreram junto com a
 * obrigatoriedade. O teto de 4 é do VO do backend: o editor valida só
 * inteiro positivo e deixa a recusa acima do teto para o serviço, com a
 * mensagem dele.
 */
describe("CurationPolicyEditor", () => {
  const from = () => CurationPolicyEditor.from(EffectiveCurationPolicy.defaults);

  it("nasce válido a partir da política efetiva e monta o payload dela", () => {
    const editor = from();
    expect(editor.errorKey).toBeNull();
    expect(editor.isValid).toBe(true);
    expect(editor.payload()).toEqual(EffectiveCurationPolicy.defaults);
  });

  it("edição é imutável: withField devolve editor novo sem tocar o original", () => {
    const editor = from();
    const next = editor.withField("maxActiveCompetencies", "3");
    expect(editor.drafts.maxActiveCompetencies).toBe("4");
    expect(next.drafts.maxActiveCompetencies).toBe("3");
  });

  it.each([
    ["vazio", ""],
    ["não-número", "abc"],
    ["não-inteiro", "3.5"],
    ["zero", "0"],
    ["negativo", "-1"],
  ])("campo %s é inválido (config.curation.error.number)", (_label, text) => {
    const editor = from().withField("maxActiveCompetencies", text);
    expect(editor.errorKey).toBe("config.curation.error.number");
    expect(editor.payload()).toBeNull();
  });

  it("fallback: a política efetiva responde máximo 4 quando a query ainda não resolveu", () => {
    expect(EffectiveCurationPolicy.resolve(undefined)).toEqual({ maxActiveCompetencies: 4 });
    const loaded = { maxActiveCompetencies: 2 };
    expect(EffectiveCurationPolicy.resolve(loaded)).toBe(loaded);
  });
});
