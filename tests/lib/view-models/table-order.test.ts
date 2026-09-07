import { describe, expect, it } from "vitest";

import { TableOrder } from "@/lib/view-models";

/**
 * A ordenação por cabeçalho clicável nasceu na tabela "De quem o time
 * depende" (dono, 2026-09-05) e voltou a ser pedida em Usuários (dono,
 * 2026-09-06: "cada título deve ter uma setinha para asc/desc"). Duas
 * ocorrências = um objeto: coluna + direção, com a regra de clique.
 */
type Coluna = "nome" | "idade";
const pessoas = [
  { nome: "Carla", idade: 41 },
  { nome: "Ana", idade: 35 },
  { nome: "Bruno", idade: 29 },
];
const compara = (
  esquerda: (typeof pessoas)[number],
  direita: (typeof pessoas)[number],
  coluna: Coluna,
) =>
  coluna === "nome" ? esquerda.nome.localeCompare(direita.nome) : esquerda.idade - direita.idade;
const nomes = (linhas: readonly { nome: string }[]) => linhas.map((linha) => linha.nome);

describe("TableOrder — uma coluna por vez, clique inverte", () => {
  it("sem coluna escolhida mantém a ordem de entrada", () => {
    const order = TableOrder.none<Coluna>();
    expect(order.column).toBeNull();
    expect(nomes(order.apply(pessoas, compara))).toEqual(["Carla", "Ana", "Bruno"]);
    expect(order.directionOf("nome")).toBeNull();
  });

  it("o primeiro clique numa coluna ordena ascendente", () => {
    const order = TableOrder.none<Coluna>().toggled("nome");
    expect(order.directionOf("nome")).toBe("asc");
    expect(nomes(order.apply(pessoas, compara))).toEqual(["Ana", "Bruno", "Carla"]);
  });

  it("clicar de novo na mesma coluna inverte para descendente", () => {
    const order = TableOrder.none<Coluna>().toggled("idade").toggled("idade");
    expect(order.directionOf("idade")).toBe("desc");
    expect(nomes(order.apply(pessoas, compara))).toEqual(["Carla", "Ana", "Bruno"]);
  });

  it("clicar noutra coluna recomeça em ascendente e apaga a anterior", () => {
    const order = TableOrder.none<Coluna>().toggled("idade").toggled("idade").toggled("nome");
    expect(order.directionOf("nome")).toBe("asc");
    expect(order.directionOf("idade")).toBeNull();
  });

  it("uma tela pode nascer já ordenada por uma coluna", () => {
    const order = TableOrder.by<Coluna>("nome");
    expect(nomes(order.apply(pessoas, compara))).toEqual(["Ana", "Bruno", "Carla"]);
    expect(TableOrder.by<Coluna>("nome", "desc").directionOf("nome")).toBe("desc");
  });

  it("não muda a lista de entrada", () => {
    const entrada = [...pessoas];
    TableOrder.by<Coluna>("nome").apply(entrada, compara);
    expect(entrada).toEqual(pessoas);
  });
});
