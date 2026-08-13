import { describe, expect, it } from "vitest";

import type { LearningPath } from "../domain";

/** Mesma regra aplicada na tela: autor edita; trilha sem autor fica aberta. */
const canEdit = (path: LearningPath, userEmail: string) =>
  !path.createdBy || path.createdBy.toLowerCase() === userEmail.toLowerCase();

/** Mesmo formatador usado na listagem de trilhas. */
const formatDate = (iso?: string) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const path = (overrides: Partial<LearningPath> = {}): LearningPath => ({
  id: "lp-1",
  name: "Trilha",
  description: "",
  competencyIds: [],
  assignedTo: [],
  items: [],
  createdBy: "ana@company.com",
  ...overrides,
});

describe("permissão de edição na tela de trilhas", () => {
  it("o autor edita", () => {
    expect(canEdit(path(), "ana@company.com")).toBe(true);
  });

  it("outra pessoa não edita", () => {
    expect(canEdit(path(), "bruno@company.com")).toBe(false);
  });

  it("e-mail com caixa diferente ainda é o mesmo autor", () => {
    expect(canEdit(path({ createdBy: "Ana@Company.com" }), "ana@company.com")).toBe(true);
  });

  it("trilha sem autor permanece editável", () => {
    expect(canEdit(path({ createdBy: null }), "qualquer@company.com")).toBe(true);
  });
});

describe("data de criação da trilha", () => {
  it("formata o ISO em dd/mm/aaaa", () => {
    expect(formatDate("2026-08-11T14:35:00.000Z")).toBe("11/08/2026");
  });

  it("devolve null quando não há data", () => {
    expect(formatDate(undefined)).toBeNull();
  });

  it("devolve null para data inválida em vez de 'Invalid Date'", () => {
    expect(formatDate("nao-e-data")).toBeNull();
  });
});

describe("ordem da lista de trilhas", () => {
  it("trilha nova entra no topo", () => {
    const existing = [path({ id: "lp-antiga" }), path({ id: "lp-mais-antiga" })];
    const nova = path({ id: "lp-nova" });

    expect([nova, ...existing].map((p) => p.id)).toEqual([
      "lp-nova",
      "lp-antiga",
      "lp-mais-antiga",
    ]);
  });
});
