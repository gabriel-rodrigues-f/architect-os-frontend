import { describe, expect, it } from "vitest";

import { levelName, LEVELS, ROLES, roleShort } from "../domain";
import {
  actionTypeLabel,
  assessmentStatusLabel,
  cycleStatusLabel,
  evidenceTypeLabel,
  learningStatusLabel,
  planItemStatusLabel,
  priorityLabel,
  ratingLabel,
} from "../labels";

/** Mesma comparação usada pela store para ordenar os domínios. */
const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

describe("ordem alfabética dos domínios", () => {
  const domains = [
    { name: "Infraestrutura e Tecnologia" },
    { name: "Arquitetura de Software" },
    { name: "DevOps" },
    { name: "Arquitetura Corporativa" },
    { name: "Engenharia de Custos" },
    { name: "Arquitetura de Aplicações Web" },
    { name: "Arquitetura de Aplicações Integradas" },
    { name: "Arquitetura de Segurança" },
    { name: "Arquitetura de Nuvem" },
    { name: "Engenharia de Plataforma" },
    { name: "Arquitetura de Dados" },
  ];

  it("ordena em pt-BR, com 'Corporativa' antes de 'de Aplicações'", () => {
    expect([...domains].sort(byName).map((d) => d.name)).toEqual([
      "Arquitetura Corporativa",
      "Arquitetura de Aplicações Integradas",
      "Arquitetura de Aplicações Web",
      "Arquitetura de Dados",
      "Arquitetura de Nuvem",
      "Arquitetura de Segurança",
      "Arquitetura de Software",
      "DevOps",
      "Engenharia de Custos",
      "Engenharia de Plataforma",
      "Infraestrutura e Tecnologia",
    ]);
  });

  it("respeita acentos: 'Segurança' vem antes de 'Software'", () => {
    expect(
      byName({ name: "Arquitetura de Segurança" }, { name: "Arquitetura de Software" }),
    ).toBeLessThan(0);
  });

  it("é estável para nomes iguais", () => {
    expect(byName({ name: "DevOps" }, { name: "DevOps" })).toBe(0);
  });
});

describe("cargos", () => {
  it("são os três níveis de Arquiteto de Soluções", () => {
    expect(ROLES).toEqual([
      "Arquiteto de Soluções I",
      "Arquiteto de Soluções II",
      "Arquiteto de Soluções III",
    ]);
  });

  it("o rótulo curto é 'Nível' + algarismo romano, sem abreviação em inglês", () => {
    expect(ROLES.map(roleShort)).toEqual(["Nível I", "Nível II", "Nível III"]);
  });
});

describe("interface em português", () => {
  it("os níveis de proficiência têm nomes em português", () => {
    expect(LEVELS.map((l) => l.name)).toEqual([
      "Consciência",
      "Fundamentos",
      "Praticante",
      "Avançado",
      "Especialista",
    ]);
    expect(levelName(4)).toBe("Avançado");
  });

  it("todo valor persistido em inglês tem rótulo em português", () => {
    const maps = [
      assessmentStatusLabel,
      planItemStatusLabel,
      learningStatusLabel,
      priorityLabel,
      ratingLabel,
      cycleStatusLabel,
      actionTypeLabel,
      evidenceTypeLabel,
    ];

    for (const map of maps) {
      for (const [canonical, label] of Object.entries(map)) {
        expect(label.length).toBeGreaterThan(0);
        // ADR e Workshop são siglas/estrangeirismos consagrados e ficam como estão.
        if (["ADR", "Workshop"].includes(canonical)) continue;
        expect(label).not.toBe(canonical);
      }
    }
  });

  it("traduz os status que aparecem com mais frequência", () => {
    expect(assessmentStatusLabel["In Review"]).toBe("Em revisão");
    expect(planItemStatusLabel["Not Started"]).toBe("Não iniciado");
    expect(learningStatusLabel.Completed).toBe("Concluído");
    expect(cycleStatusLabel.Active).toBe("Ativo");
    expect(priorityLabel.Critical).toBe("Crítica");
    expect(ratingLabel.High).toBe("Alto");
  });
});
