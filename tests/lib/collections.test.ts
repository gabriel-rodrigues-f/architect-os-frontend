import { describe, expect, it } from "vitest";

import { topByRelevance } from "@/lib/collections";

/** OO3-11/D-3 (reuso final) — contrato do corte compartilhado radar/heatmap. */
describe("topByRelevance", () => {
  it("mantém a ordem ORIGINAL entre os selecionados, não a ordem do score", () => {
    const data = ["a", "b", "c", "d", "e"];
    const score: Record<string, number> = { a: 1, b: 9, c: 5, d: 8, e: 2 };
    const scoreOf = (x: string) => score[x] ?? 0;
    expect(topByRelevance(data, scoreOf, 3)).toEqual(["b", "c", "d"]);
  });

  it("empate de score preserva a ordem original (sort estável por índice)", () => {
    const data = [
      { id: "x", s: 3 },
      { id: "y", s: 3 },
      { id: "z", s: 3 },
      { id: "w", s: 1 },
    ];
    expect(topByRelevance(data, (i) => i.s, 2).map((i) => i.id)).toEqual(["x", "y"]);
  });

  it("length <= max devolve uma CÓPIA com tudo, sem chamar relevance", () => {
    const data = [1, 2, 3];
    const result = topByRelevance(
      data,
      () => {
        throw new Error("não deveria ranquear quando cabe tudo");
      },
      3,
    );
    expect(result).toEqual([1, 2, 3]);
    expect(result).not.toBe(data);
  });

  it("max 0 devolve vazio quando há mais itens que o corte", () => {
    expect(topByRelevance([1, 2], (x) => x, 0)).toEqual([]);
  });
});
