import { describe, expect, it } from "vitest";

import { HeatmapRowOrder } from "@/lib/view-models";

/**
 * Dono (2026-09-08), Prontidão > Mapa de Calor: *"cada coluna de capacidade
 * ganha uma setinha que ordena a tabela por aquela coluna, crescente e
 * decrescente"*. A regra do clique já era do `TableOrder` — o que é DESTE
 * mapa é como uma coluna de capacidade compara duas PESSOAS.
 *
 * Duas decisões que só existem aqui:
 *
 *   - quem não tem avaliação naquela capacidade ordena ABAIXO do nível 1: a
 *     ausência é o menor sinal da coluna, e não um zero inventado;
 *   - o empate desempata pelo NOME, nos dois sentidos — sem isso, duas
 *     pessoas de mesmo nível trocariam de lugar a cada clique.
 */
interface Pessoa {
  name: string;
  levels: Record<string, number | undefined>;
}

const pessoa = (name: string, levels: Record<string, number | undefined>): Pessoa => ({
  name,
  levels,
});

const NIVEL = (row: Pessoa, capabilityId: string) => row.levels[capabilityId];

const ana = pessoa("Ana", { cloud: 4, security: 2 });
const bruno = pessoa("Bruno", { cloud: 2.5, security: 1 });
const carla = pessoa("Carla", { cloud: undefined, security: 2 });

const nomes = (rows: readonly Pessoa[]) => rows.map((row) => row.name);

describe("a ordem do mapa de calor — pessoas por coluna de capacidade", () => {
  it("sem coluna escolhida, a ordem é a que a tela entregou", () => {
    const ordem = HeatmapRowOrder.none();

    expect(nomes(ordem.apply([bruno, ana, carla], NIVEL))).toEqual(["Bruno", "Ana", "Carla"]);
  });

  it("crescente põe o menor nível primeiro", () => {
    const ordem = HeatmapRowOrder.none().toggled("cloud");

    expect(nomes(ordem.apply([ana, bruno], NIVEL))).toEqual(["Bruno", "Ana"]);
  });

  it("clicar de novo na mesma coluna inverte o sentido", () => {
    const ordem = HeatmapRowOrder.none().toggled("cloud").toggled("cloud");

    expect(ordem.directionOf("cloud")).toBe("desc");
    expect(nomes(ordem.apply([bruno, ana], NIVEL))).toEqual(["Ana", "Bruno"]);
  });

  it("clicar noutra coluna começa de novo em crescente", () => {
    const ordem = HeatmapRowOrder.none().toggled("cloud").toggled("security");

    expect(ordem.directionOf("cloud")).toBeNull();
    expect(ordem.directionOf("security")).toBe("asc");
    expect(nomes(ordem.apply([ana, bruno], NIVEL))).toEqual(["Bruno", "Ana"]);
  });

  it("quem não foi avaliado na coluna vem antes de todo nível no crescente", () => {
    const ordem = HeatmapRowOrder.none().toggled("cloud");

    expect(nomes(ordem.apply([ana, bruno, carla], NIVEL))).toEqual(["Carla", "Bruno", "Ana"]);
  });

  it("o empate desempata pelo nome — o mesmo desempate nos dois sentidos", () => {
    const crescente = HeatmapRowOrder.none().toggled("security");
    const decrescente = crescente.toggled("security");

    // Ana e Carla empatam em 2; Bruno tem 1. Entre as duas, o nome decide —
    // e decide igual na ida e na volta, senão a coluna balançaria a cada clique.
    expect(nomes(crescente.apply([carla, ana, bruno], NIVEL))).toEqual(["Bruno", "Ana", "Carla"]);
    expect(nomes(decrescente.apply([carla, ana, bruno], NIVEL))).toEqual(["Ana", "Carla", "Bruno"]);
  });

  it("ordenar não consome a lista de quem chamou", () => {
    const entrada = [ana, bruno];
    HeatmapRowOrder.none().toggled("cloud").apply(entrada, NIVEL);

    expect(nomes(entrada)).toEqual(["Ana", "Bruno"]);
  });
});
