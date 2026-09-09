import { describe, expect, it } from "vitest";

import { RadarRows } from "@/lib/view-models/radar-rows";

/**
 * O RADAR DA FICHA E A MESMA RÉGUA DO COMPARATIVO.
 *
 * O radar comparativo já tinha aprendido a diferença entre ZERO e AUSÊNCIA
 * (`linhas-do-radar-comparativo.test.ts`): capacidade sem média vira `null`,
 * nunca `0`, porque zero é o CENTRO do radar e a aresta que passa por lá
 * atravessa o próprio polígono — a tela afirmando "esta pessoa tem zero aqui"
 * onde o certo é "não há medida".
 *
 * A Visão geral da ficha continuava com o `?? 0` que o comparativo perdeu, e
 * com uma agravante: as quatro listagens por pessoa passaram a responder
 * `200 []` (em vez de `403`) a quem não alcança a pessoa, então a ficha
 * desenhava um polígono COLAPSADO NO CENTRO sobre alguém cujos números quem
 * olha não pode ver.
 *
 * A régua não foi copiada: `RadarRows` é a mesma classe do comparativo,
 * generalizada. O que muda é a forma das linhas — lá uma série por pessoa,
 * aqui duas séries fixas (o que a pessoa tem hoje e o alvo dela).
 */
describe("as linhas do radar da ficha", () => {
  const cloud = { id: "cloud", name: "Arquitetura de Nuvem" };
  const dados = { id: "dados", name: "Arquitetura de Dados" };
  const ia = { id: "ia", name: "Arquitetura de IA" };

  it("capacidade sem medida sai como ausência, não como zero", () => {
    const linhas = RadarRows.currentAgainstTarget([
      { capability: cloud, avg: 3, target: 4 },
      { capability: dados, avg: undefined, target: undefined },
    ]);

    expect(linhas).toEqual([{ capability: "Arquitetura de Nuvem", atual: 3, alvo: 4 }]);
  });

  it("eixo que a pessoa não tem medido sai do radar — ele não desenha nada", () => {
    const linhas = RadarRows.currentAgainstTarget([
      { capability: cloud, avg: 3, target: 4 },
      { capability: dados, avg: undefined, target: undefined },
      { capability: ia, avg: 2, target: 5 },
    ]);

    expect(linhas.map((linha) => linha.capability)).toEqual([
      "Arquitetura de Nuvem",
      "Arquitetura de IA",
    ]);
  });

  it("zero medido continua zero — a régua não confunde as duas coisas", () => {
    const linhas = RadarRows.currentAgainstTarget([{ capability: cloud, avg: 0, target: 3 }]);

    expect(linhas).toEqual([{ capability: "Arquitetura de Nuvem", atual: 0, alvo: 3 }]);
  });

  it("alvo sem medida também é ausência, e o eixo fica de pé pela medida que existe", () => {
    const linhas = RadarRows.currentAgainstTarget([
      { capability: cloud, avg: 3, target: undefined },
    ]);

    expect(linhas).toEqual([{ capability: "Arquitetura de Nuvem", atual: 3, alvo: null }]);
  });

  it("ninguém mediu nada: o radar fica sem eixo, em vez de um polígono no centro", () => {
    const linhas = RadarRows.currentAgainstTarget([
      { capability: cloud, avg: undefined, target: undefined },
      { capability: dados, avg: undefined, target: undefined },
    ]);

    expect(linhas).toEqual([]);
  });

  it("a ordem do catálogo é preservada — o radar não reordena os eixos", () => {
    const linhas = RadarRows.currentAgainstTarget([
      { capability: ia, avg: 1, target: 2 },
      { capability: cloud, avg: 4, target: 4 },
      { capability: dados, avg: 2, target: 3 },
    ]);

    expect(linhas.map((linha) => linha.capability)).toEqual([
      "Arquitetura de IA",
      "Arquitetura de Nuvem",
      "Arquitetura de Dados",
    ]);
  });
});
