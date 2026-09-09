import { describe, expect, it } from "vitest";

import { ComparisonRadarRows } from "@/lib/view-models/comparison-radar-rows";

/**
 * Dono, 2026-09-09, sobre o radar do Comparativo: *"ele não deveria gerar essa
 * ponta assim, deveria conectar os pontos no espaço já ocupado"*.
 *
 * A ponta não era desenho: era um número. Capacidade sem média virava **zero**
 * (`?? 0`), zero é o CENTRO do radar, e a aresta entre duas capacidades
 * avaliadas passava por lá — atravessando o próprio polígono. Ou seja, a tela
 * afirmava "esta pessoa tem zero nesta capacidade" onde o certo era "não há
 * medida", e a ponta era essa afirmação desenhada.
 *
 * Zero e ausência são coisas diferentes, e a diferença é o defeito inteiro:
 * zero é uma medição que deu zero; ausência é não ter sido medido.
 */
describe("as linhas do radar comparativo", () => {
  const capacidades = [
    { id: "cloud", name: "Arquitetura de Nuvem" },
    { id: "dados", name: "Arquitetura de Dados" },
    { id: "ia", name: "Arquitetura de IA" },
  ];

  it("ausência de média vira ausência, não zero — é o que criava a ponta", () => {
    // Os três eixos existem no radar porque a Helena mediu os três; o que se
    // observa aqui é o que acontece com a Débora, que só tem um.
    const linhas = ComparisonRadarRows.of(capacidades, [
      { id: "debora", averages: new Map([["cloud", 3]]) },
      {
        id: "helena",
        averages: new Map([
          ["cloud", 2],
          ["dados", 4],
          ["ia", 1],
        ]),
      },
    ]);

    expect(linhas).toEqual([
      { capability: "Arquitetura de Nuvem", debora: 3, helena: 2 },
      { capability: "Arquitetura de Dados", debora: null, helena: 4 },
      { capability: "Arquitetura de IA", debora: null, helena: 1 },
    ]);
  });

  it("zero medido continua zero — a régua não confunde as duas coisas", () => {
    const linhas = ComparisonRadarRows.of(
      [capacidades[0]!],
      [{ id: "debora", averages: new Map([["cloud", 0]]) }],
    );

    expect(linhas[0]).toEqual({ capability: "Arquitetura de Nuvem", debora: 0 });
  });

  it("eixo que ninguém mediu sai do radar — num comparativo ele não compara nada", () => {
    const linhas = ComparisonRadarRows.of(capacidades, [
      { id: "debora", averages: new Map([["cloud", 3]]) },
      { id: "helena", averages: new Map([["dados", 2]]) },
    ]);

    expect(linhas.map((linha) => linha["capability"])).toEqual([
      "Arquitetura de Nuvem",
      "Arquitetura de Dados",
    ]);
  });

  it("mas eixo medido por UMA das duas fica — a diferença é o que se quer ver", () => {
    const linhas = ComparisonRadarRows.of(
      [capacidades[0]!],
      [
        { id: "debora", averages: new Map([["cloud", 3]]) },
        { id: "helena", averages: new Map() },
      ],
    );

    expect(linhas).toEqual([{ capability: "Arquitetura de Nuvem", debora: 3, helena: null }]);
  });

  it("chave presente com valor indefinido também é ausência — a origem devolve assim", () => {
    const linhas = ComparisonRadarRows.of(capacidades, [
      {
        id: "debora",
        averages: new Map([
          ["cloud", 3],
          ["dados", undefined],
        ]),
      },
      {
        id: "helena",
        averages: new Map([
          ["cloud", 2],
          ["dados", undefined],
        ]),
      },
    ]);

    expect(linhas).toEqual([{ capability: "Arquitetura de Nuvem", debora: 3, helena: 2 }]);
  });

  it("a ordem do catálogo é preservada — o radar não reordena os eixos", () => {
    const linhas = ComparisonRadarRows.of(capacidades, [
      {
        id: "debora",
        averages: new Map([
          ["ia", 1],
          ["cloud", 4],
          ["dados", 2],
        ]),
      },
    ]);

    expect(linhas.map((linha) => linha["capability"])).toEqual([
      "Arquitetura de Nuvem",
      "Arquitetura de Dados",
      "Arquitetura de IA",
    ]);
  });
});
