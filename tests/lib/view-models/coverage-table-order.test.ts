import { describe, expect, it } from "vitest";

import { CoverageTableOrder } from "@/lib/view-models";

const row = (
  name: string,
  developing: number,
  experts: number,
  notAssessed: number,
  risk: "insufficientData" | "noReference" | "concentrationRisk" | "distributedCoverage",
) => ({
  cat: { name },
  bands: [
    { key: "developing", people: Array.from({ length: developing }) },
    { key: "experts", people: Array.from({ length: experts }) },
  ],
  notAssessed,
  risk,
});

const names = (rows: { cat: { name: string } }[]) => rows.map((row) => row.cat.name);

describe("CoverageTableOrder — a ordenação de 'De quem o time depende'", () => {
  const rows = [
    row("Dados", 3, 0, 2, "noReference"),
    row("Cloud", 1, 2, 0, "distributedCoverage"),
    row("Arquitetura", 2, 1, 5, "concentrationRisk"),
  ];

  it("sem coluna escolhida, mantém a ordem do catálogo", () => {
    expect(names(CoverageTableOrder.catalog().apply(rows))).toEqual([
      "Dados",
      "Cloud",
      "Arquitetura",
    ]);
  });

  it("uma faixa ordena pela quantidade de pessoas nela; clicar de novo inverte", () => {
    const asc = CoverageTableOrder.catalog().toggled("developing");
    expect(names(asc.apply(rows))).toEqual(["Cloud", "Arquitetura", "Dados"]);
    expect(asc.directionOf("developing")).toBe("asc");

    const desc = asc.toggled("developing");
    expect(names(desc.apply(rows))).toEqual(["Dados", "Arquitetura", "Cloud"]);
    expect(desc.directionOf("developing")).toBe("desc");
    expect(desc.directionOf("experts")).toBeNull();
  });

  it("trocar de coluna recomeça em ascendente", () => {
    const order = CoverageTableOrder.catalog().toggled("developing").toggled("developing");
    expect(order.toggled("notAssessed").direction).toBe("asc");
    expect(names(order.toggled("notAssessed").apply(rows))).toEqual([
      "Cloud",
      "Dados",
      "Arquitetura",
    ]);
  });

  it("capacidade ordena pelo nome e risco pelo quanto pede ação", () => {
    expect(names(CoverageTableOrder.catalog().toggled("capability").apply(rows))).toEqual([
      "Arquitetura",
      "Cloud",
      "Dados",
    ]);
    expect(names(CoverageTableOrder.catalog().toggled("risk").apply(rows))).toEqual([
      "Dados",
      "Arquitetura",
      "Cloud",
    ]);
  });

  it("não muda a lista recebida", () => {
    const before = names(rows);
    CoverageTableOrder.catalog().toggled("experts").toggled("experts").apply(rows);
    expect(names(rows)).toEqual(before);
  });
});
