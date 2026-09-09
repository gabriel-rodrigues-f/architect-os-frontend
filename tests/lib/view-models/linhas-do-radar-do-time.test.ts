import { describe, expect, it } from "vitest";

import { RadarRows } from "@/lib/view-models/radar-rows";

/**
 * O RADAR DE TIME DA ANÁLISE DE LACUNAS, NA MESMA RÉGUA.
 *
 * Terceiro lugar com o mesmo defeito de 2026-09-09: capacidade sem média do
 * time virava `?? 0`, zero é o CENTRO do radar, e a aresta entre duas
 * capacidades medidas passava por lá. Só que aqui a afirmação é ainda maior —
 * a tela dizia "este TIME tem zero nesta capacidade" onde o certo é "ninguém
 * do recorte foi medido aqui".
 *
 * A régua não foi copiada nem reescrita: é `currentAgainstTarget`, a mesma da
 * ficha, com UMA generalização — o eixo do time carrega COBERTURA (quantas
 * das N pessoas do recorte têm medida), porque uma média de time só quer
 * dizer alguma coisa junto com quantas pessoas ela resume. Na ficha é uma
 * pessoa só: cobertura seria sempre 1 de 1, e por isso continua ausente lá.
 */
describe("as linhas do radar de time", () => {
  const cloud = { id: "cloud", name: "Arquitetura de Nuvem" };
  const dados = { id: "dados", name: "Arquitetura de Dados" };

  it("a cobertura viaja com o eixo — a média do time não se lê sem ela", () => {
    const linhas = RadarRows.currentAgainstTarget([
      { capability: cloud, avg: 3.25, target: 3.5, coverage: { covered: 2, total: 4 } },
    ]);

    expect(linhas).toEqual([
      { capability: "Arquitetura de Nuvem", atual: 3.25, alvo: 3.5, covered: 2, total: 4 },
    ]);
  });

  it("capacidade que ninguém do recorte mediu sai do radar, em vez de virar zero", () => {
    const linhas = RadarRows.currentAgainstTarget([
      { capability: cloud, avg: 3.25, target: 3.5, coverage: { covered: 2, total: 4 } },
      { capability: dados, avg: undefined, target: undefined, coverage: { covered: 0, total: 4 } },
    ]);

    expect(linhas).toEqual([
      { capability: "Arquitetura de Nuvem", atual: 3.25, alvo: 3.5, covered: 2, total: 4 },
    ]);
  });

  it("média de time igual a zero continua zero — cobertura não é o que distingue", () => {
    const linhas = RadarRows.currentAgainstTarget([
      { capability: cloud, avg: 0, target: 2, coverage: { covered: 1, total: 4 } },
    ]);

    expect(linhas).toEqual([
      { capability: "Arquitetura de Nuvem", atual: 0, alvo: 2, covered: 1, total: 4 },
    ]);
  });

  it("sem cobertura declarada a linha não inventa uma — é o caso da ficha", () => {
    const [linha] = RadarRows.currentAgainstTarget([{ capability: cloud, avg: 3, target: 4 }]);

    expect(linha).toBeDefined();
    expect(Object.hasOwn(linha!, "covered")).toBe(false);
    expect(Object.hasOwn(linha!, "total")).toBe(false);
  });
});
