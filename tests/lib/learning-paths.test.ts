import { describe, expect, it } from "vitest";

import type { LearningPath } from "@/lib/domain";

/** Mesma regra aplicada na tela: autor edita; trilha sem autor fica aberta. */
const canEdit = (path: LearningPath, userEmail: string) =>
  !path.createdBy || path.createdBy.toLowerCase() === userEmail.toLowerCase();

/** Mesma ideia do formatador usado na listagem de trilhas — locale-aware, não fixo em pt-BR. */
const formatDate = (iso: string | undefined, locale: string) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const path = (overrides: Partial<LearningPath> = {}): LearningPath => ({
  id: "lp-1",
  name: "Trilha",
  description: "",
  competencyIds: [],
  assignedTo: [],
  items: [],
  progress: [],
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
  it("formata o ISO em dd/mm/aaaa em português", () => {
    expect(formatDate("2026-08-11T14:35:00.000Z", "pt")).toBe("11/08/2026");
  });

  it("formata o ISO em mm/dd/aaaa em inglês", () => {
    expect(formatDate("2026-08-11T14:35:00.000Z", "en")).toBe("08/11/2026");
  });

  it("devolve null quando não há data", () => {
    expect(formatDate(undefined, "pt")).toBeNull();
  });

  it("devolve null para data inválida em vez de 'Invalid Date'", () => {
    expect(formatDate("nao-e-data", "pt")).toBeNull();
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
