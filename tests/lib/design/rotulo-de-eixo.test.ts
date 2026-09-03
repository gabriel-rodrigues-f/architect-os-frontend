import { describe, expect, it } from "vitest";

import { RotuloDeEixo } from "@/lib/design";

/**
 * Pedido do dono (2026-09-03), olhando o radar: *"os textos das capacidades
 * não estão aparecendo da maneira correta. eles devem quebrar por palavras,
 * mas quero que apareça todo o texto. hoje Clean e Core parecem ser duas
 * coisas diferentes e eu também não enxergo o texto completo das
 * capacidades."*
 *
 * O eixo do radar mostrava o campo `short` da capacidade — no catálogo da
 * casa o short é UMA palavra ("Corporativa" para "Arquitetura Corporativa",
 * "Clean" para "Clean Core"), então dois eixos vizinhos pareciam duas
 * capacidades diferentes. A régua que este teste fixa: o rótulo carrega o
 * NOME inteiro e a quebra é SEMPRE por palavra — nunca corta palavra, nunca
 * elide com "…", nunca perde texto.
 */
describe("rótulo de eixo — o nome inteiro, quebrado por palavras", () => {
  it("mantém o nome inteiro ao juntar as linhas de volta", () => {
    const linhas = RotuloDeEixo.emLinhas("Engenharia de Plataforma");
    expect(linhas.join(" ")).toBe("Engenharia de Plataforma");
  });

  it("quebra por palavra, nunca no meio de uma", () => {
    for (const linha of RotuloDeEixo.emLinhas("Arquitetura de Aplicações Integradas")) {
      expect(linha).not.toMatch(/[-…]$/);
      expect(linha.trim()).toBe(linha);
    }
  });

  it("Clean Core cabe em uma linha só — não vira dois rótulos", () => {
    expect(RotuloDeEixo.emLinhas("Clean Core")).toEqual(["Clean Core"]);
  });

  it("nome longo ocupa mais de uma linha, cada uma dentro do limite", () => {
    const linhas = RotuloDeEixo.emLinhas("Arquitetura de Aplicações Integradas");
    expect(linhas.length).toBeGreaterThan(1);
    for (const linha of linhas) expect(linha.length).toBeLessThanOrEqual(18);
  });

  it("palavra maior que o limite fica inteira na própria linha", () => {
    expect(RotuloDeEixo.emLinhas("Interoperabilidade")).toEqual(["Interoperabilidade"]);
  });

  it("espaços repetidos e sobras não geram linha vazia", () => {
    expect(RotuloDeEixo.emLinhas("  Clean   Core  ")).toEqual(["Clean Core"]);
    expect(RotuloDeEixo.emLinhas("")).toEqual([]);
  });
});
