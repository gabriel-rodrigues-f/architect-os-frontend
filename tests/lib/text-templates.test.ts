import { describe, expect, it } from "vitest";

import {
  DEFAULT_TEXT_TEMPLATES,
  defaultObjectiveFromGap,
  objectiveFromGapRenderer,
  renderTemplate,
  templateTextFor,
  withDefaultTextTemplates,
} from "@/lib/text-templates";

/**
 * CFG-03 — o lado frontend de `text_templates`, isolado: a interpolação
 * espelha a SEMÂNTICA de `TextTemplate.render` do backend (variável
 * fornecida entra; variável sem valor fica LITERAL — nunca lança, nunca
 * vira "undefined"), o fallback é byte-idêntico ao seed, e o renderer
 * fecha template efetivo + locale (o que `useObjectiveFromGap` injeta no
 * ViewModel).
 */
describe("renderTemplate (espelho de TextTemplate.render do backend)", () => {
  it("substitui {var} pelas variáveis fornecidas, números viram texto", () => {
    expect(
      renderTemplate("Evoluir {competencia} do nível {atual} para o nível {alvo}", {
        competencia: "Kubernetes",
        atual: 1,
        alvo: 2,
      }),
    ).toBe("Evoluir Kubernetes do nível 1 para o nível 2");
  });

  it("variável sem valor fornecido fica LITERAL — não explode, não vira 'undefined'", () => {
    expect(renderTemplate("Evoluir {competencia} com {gestor}", { competencia: "IAM" })).toBe(
      "Evoluir IAM com {gestor}",
    );
  });

  it("placeholder fora do padrão do backend (não começa com letra) não é tocado", () => {
    expect(renderTemplate("{1x} e {competencia}", { competencia: "IAM", "1x": "nunca" })).toBe(
      "{1x} e IAM",
    );
  });
});

describe("withDefaultTextTemplates", () => {
  it("sem carga (undefined ou {}), devolve o default byte-idêntico ao seed", () => {
    expect(withDefaultTextTemplates()).toEqual(DEFAULT_TEXT_TEMPLATES);
    expect(withDefaultTextTemplates({})).toEqual(DEFAULT_TEXT_TEMPLATES);
  });

  it("merge por key E por locale: um PUT só no pt não derruba o en para o default", () => {
    const efetivo = withDefaultTextTemplates({
      "pdi.objective.fromGap": { pt: "Subir {competencia} de {atual} até {alvo}" },
    });
    expect(efetivo["pdi.objective.fromGap"]["pt"]).toBe(
      "Subir {competencia} de {atual} até {alvo}",
    );
    expect(efetivo["pdi.objective.fromGap"]["en"]).toBe(
      DEFAULT_TEXT_TEMPLATES["pdi.objective.fromGap"]["en"],
    );
  });

  it("template vazio do servidor é descartado — o default daquele locale sobrevive", () => {
    const efetivo = withDefaultTextTemplates({ "pdi.objective.fromGap": { pt: "   " } });
    expect(efetivo["pdi.objective.fromGap"]["pt"]).toBe(
      DEFAULT_TEXT_TEMPLATES["pdi.objective.fromGap"]["pt"],
    );
  });

  it("key desconhecida vinda do servidor não entra nem derruba nada", () => {
    const efetivo = withDefaultTextTemplates({ "outra.key": { pt: "x" } });
    expect(efetivo).toEqual(DEFAULT_TEXT_TEMPLATES);
  });
});

describe("templateTextFor / objectiveFromGapRenderer", () => {
  const vars = { competencia: "Kubernetes", atual: 1, alvo: 2 };

  it("locale sem template cai no idioma base (pt), como o t() do i18n", () => {
    expect(templateTextFor(withDefaultTextTemplates(), "pdi.objective.fromGap", "es")).toBe(
      DEFAULT_TEXT_TEMPLATES["pdi.objective.fromGap"]["pt"],
    );
  });

  it("default em pt: byte-idêntico ao literal antigo do código", () => {
    expect(defaultObjectiveFromGap(vars)).toBe("Evoluir Kubernetes do nível 1 para o nível 2");
  });

  it("app em en: objetivo em inglês (era o bug — texto persistido em pt)", () => {
    const render = objectiveFromGapRenderer(withDefaultTextTemplates(), "en");
    expect(render(vars)).toBe("Evolve Kubernetes from level 1 to level 2");
  });

  it("guard rail: template alterado pelo admin (PUT) muda o objetivo sem deploy", () => {
    const efetivo = withDefaultTextTemplates({
      "pdi.objective.fromGap": { pt: "Levar {competencia} ao nível {alvo} (hoje {atual})" },
    });
    const render = objectiveFromGapRenderer(efetivo, "pt");
    expect(render(vars)).toBe("Levar Kubernetes ao nível 2 (hoje 1)");
  });
});
