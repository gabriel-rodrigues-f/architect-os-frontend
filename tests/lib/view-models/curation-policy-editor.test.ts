import { describe, expect, it } from "vitest";

import { DEFAULT_CURATION_POLICY, withDefaultCurationPolicy } from "@/lib/curation-policy";
import { CurationPolicyEditor } from "@/lib/view-models";

/**
 * CFG-04 (SPEC-OO3-13, §3.2) — ViewModel do editor da política de curadoria
 * da aba "Catálogo" de /settings, testado isolado (sem React), mesmo
 * espírito de `scoring-bands-editor.test.ts`: a validação client-side
 * espelha o VO do backend (`CatalogCurationPolicy.create`) — inteiros,
 * máximo positivo, contagens não negativas, soma que fecha.
 */
describe("CurationPolicyEditor", () => {
  const from = () => CurationPolicyEditor.from(DEFAULT_CURATION_POLICY);

  it("nasce válido a partir da política efetiva e monta o payload dela", () => {
    const editor = from();
    expect(editor.errorKey).toBeNull();
    expect(editor.isValid).toBe(true);
    expect(editor.payload()).toEqual(DEFAULT_CURATION_POLICY);
  });

  it("edição é imutável: withField devolve editor novo sem tocar o original", () => {
    const editor = from();
    const next = editor.withField("maxActiveCompetencies", "8");
    expect(editor.drafts.maxActiveCompetencies).toBe("6");
    expect(next.drafts.maxActiveCompetencies).toBe("8");
  });

  it("soma que não fecha é inválida (config.curation.error.sum) e payload é null", () => {
    const editor = from().withField("maxActiveCompetencies", "8");
    expect(editor.errorKey).toBe("config.curation.error.sum");
    expect(editor.isValid).toBe(false);
    expect(editor.payload()).toBeNull();
  });

  it("uma política 8 = 4 + 4 é válida e vira o payload do PUT", () => {
    const editor = from()
      .withField("maxActiveCompetencies", "8")
      .withField("requiredRestrictive", "4")
      .withField("requiredNonRestrictive", "4");
    expect(editor.errorKey).toBeNull();
    expect(editor.payload()).toEqual({
      maxActiveCompetencies: 8,
      requiredRestrictive: 4,
      requiredNonRestrictive: 4,
    });
  });

  it.each([
    ["vazio", ""],
    ["não-número", "abc"],
    ["não-inteiro", "3.5"],
  ])("campo %s é inválido (config.curation.error.number)", (_label, text) => {
    const editor = from().withField("requiredRestrictive", text);
    expect(editor.errorKey).toBe("config.curation.error.number");
    expect(editor.payload()).toBeNull();
  });

  it("máximo não positivo e contagem negativa são inválidos (espelho do VO)", () => {
    const zeroMax = from()
      .withField("maxActiveCompetencies", "0")
      .withField("requiredRestrictive", "0")
      .withField("requiredNonRestrictive", "0");
    expect(zeroMax.errorKey).toBe("config.curation.error.number");

    const negative = from()
      .withField("maxActiveCompetencies", "2")
      .withField("requiredRestrictive", "-1")
      .withField("requiredNonRestrictive", "3");
    expect(negative.errorKey).toBe("config.curation.error.number");
  });

  it("fallback: withDefaultCurationPolicy responde 6/3+3 quando a query ainda não resolveu", () => {
    expect(withDefaultCurationPolicy(undefined)).toEqual({
      maxActiveCompetencies: 6,
      requiredRestrictive: 3,
      requiredNonRestrictive: 3,
    });
    const loaded = { maxActiveCompetencies: 8, requiredRestrictive: 4, requiredNonRestrictive: 4 };
    expect(withDefaultCurationPolicy(loaded)).toBe(loaded);
  });
});
