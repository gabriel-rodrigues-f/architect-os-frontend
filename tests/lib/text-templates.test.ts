import { describe, expect, it } from "vitest";

import {
  DEFAULT_TEXT_TEMPLATES,
  defaultObjectiveFromGap,
  TextTemplate,
  TextTemplateRenderer,
} from "@/lib/text-templates";

/**
 * CFG-03 — o lado frontend de `text_templates`, isolado: a interpolação
 * espelha a SEMÂNTICA de `TextTemplate.render` do backend (variável
 * fornecida entra; variável sem valor fica LITERAL — nunca lança, nunca
 * vira "undefined"), o fallback é byte-idêntico ao seed, e o renderer
 * fecha template efetivo + locale (o que `useObjectiveFromGap` injeta no
 * ViewModel).
 */
describe("TextTemplate.render (espelho de TextTemplate.render do backend)", () => {
  it("substitui {var} pelas variáveis fornecidas, números viram texto", () => {
    expect(
      TextTemplate.of("Evoluir {competencia} do nível {atual} para o nível {alvo}").render({
        competencia: "Kubernetes",
        atual: 1,
        alvo: 2,
      }),
    ).toBe("Evoluir Kubernetes do nível 1 para o nível 2");
  });

  it("variável sem valor fornecido fica LITERAL — não explode, não vira 'undefined'", () => {
    expect(
      TextTemplate.of("Evoluir {competencia} com {gestor}").render({ competencia: "IAM" }),
    ).toBe("Evoluir IAM com {gestor}");
  });

  it("placeholder fora do padrão do backend (não começa com letra) não é tocado", () => {
    expect(
      TextTemplate.of("{1x} e {competencia}").render({ competencia: "IAM", "1x": "nunca" }),
    ).toBe("{1x} e IAM");
  });
});

describe("TextTemplateRenderer.resolve", () => {
  it("sem carga (undefined ou {}), devolve o default byte-idêntico ao seed", () => {
    expect(TextTemplateRenderer.resolve()).toEqual(DEFAULT_TEXT_TEMPLATES);
    expect(TextTemplateRenderer.resolve({})).toEqual(DEFAULT_TEXT_TEMPLATES);
  });

  it("merge por key E por locale: um PUT só no pt não derruba o en para o default", () => {
    const efetivo = TextTemplateRenderer.resolve({
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
    const efetivo = TextTemplateRenderer.resolve({ "pdi.objective.fromGap": { pt: "   " } });
    expect(efetivo["pdi.objective.fromGap"]["pt"]).toBe(
      DEFAULT_TEXT_TEMPLATES["pdi.objective.fromGap"]["pt"],
    );
  });

  it("key desconhecida vinda do servidor não entra nem derruba nada", () => {
    const efetivo = TextTemplateRenderer.resolve({ "outra.key": { pt: "x" } });
    expect(efetivo).toEqual(DEFAULT_TEXT_TEMPLATES);
  });
});

describe("TextTemplateRenderer.templateFor / objectiveFromGap", () => {
  const vars = { competencia: "Kubernetes", atual: 1, alvo: 2 };

  it("locale sem template cai no idioma base (pt), como o t() do i18n", () => {
    expect(
      TextTemplateRenderer.fromLoaded(undefined, "es").templateFor("pdi.objective.fromGap").text,
    ).toBe(DEFAULT_TEXT_TEMPLATES["pdi.objective.fromGap"]["pt"]);
  });

  it("default em pt: byte-idêntico ao literal antigo do código", () => {
    expect(defaultObjectiveFromGap(vars)).toBe("Evoluir Kubernetes do nível 1 para o nível 2");
  });

  it("app em en: objetivo em inglês (era o bug — texto persistido em pt)", () => {
    const render = TextTemplateRenderer.fromLoaded(undefined, "en").objectiveFromGap;
    expect(render(vars)).toBe("Evolve Kubernetes from level 1 to level 2");
  });

  it("guard rail: template alterado pelo admin (PUT) muda o objetivo sem deploy", () => {
    const efetivo = TextTemplateRenderer.resolve({
      "pdi.objective.fromGap": { pt: "Levar {competencia} ao nível {alvo} (hoje {atual})" },
    });
    const render = TextTemplateRenderer.over(efetivo, "pt").objectiveFromGap;
    expect(render(vars)).toBe("Levar Kubernetes ao nível 2 (hoje 1)");
  });
});
