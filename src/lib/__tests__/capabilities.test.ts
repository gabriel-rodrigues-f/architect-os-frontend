import { describe, expect, it } from "vitest";

import { ROLES, roleShort } from "../domain";
import en from "@/locales/en.json";
import pt from "@/locales/pt.json";

/** Mesma comparação usada pela store para ordenar as capacidades. */
const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });

describe("ordem alfabética das capacidades", () => {
  const capabilities = [
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
    expect([...capabilities].sort(byName).map((d) => d.name)).toEqual([
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
  /**
   * Os rótulos deixaram de ser strings fixas: agora são chaves resolvidas pelo
   * idioma ativo. O que precisa continuar garantido é que cada valor canônico
   * do domínio tenha texto nos dois idiomas.
   */
  it("todo valor de domínio tem rótulo em português e em inglês", () => {
    const canonicos = [
      "status.draft",
      "status.approved",
      "status.completed",
      "status.notStarted",
      "status.inProgress",
      "status.blocked",
      "status.active",
      "status.closed",
      "status.planned",
      "priority.low",
      "priority.medium",
      "priority.high",
      "priority.critical",
      "action.learn",
      "action.practice",
      "action.apply",
      "action.teach",
      "action.mentor",
      "action.lead",
      "complexity.low",
      "complexity.medium",
      "complexity.high",
      "level.1",
      "level.2",
      "level.3",
      "level.4",
      "level.5",
      "level.1.description",
      "level.2.description",
      "level.3.description",
      "level.4.description",
      "level.5.description",
    ] as const;

    for (const chave of canonicos) {
      expect((pt as Record<string, string>)[chave], `pt: ${chave}`).toBeTruthy();
      expect((en as Record<string, string>)[chave], `en: ${chave}`).toBeTruthy();
    }
  });

  /**
   * R2-VIS-05 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — antes, `pt.json` tinha
   * um segundo mapa de nomes de nível NUNCA lido pelo app (`level.2` dizia
   * "Iniciante", enquanto o código usava "Fundamentos" direto, sem passar
   * pelo i18n). Trava o valor correto — "Fundamentos" vence — para não
   * reabrir o drift silenciosamente numa edição futura de `pt.json`.
   */
  it("nível 2 é 'Fundamentos' — não sobra o nome morto 'Iniciante'", () => {
    expect((pt as Record<string, string>)["level.2"]).toBe("Fundamentos");
  });

  it("o português não deixou texto igual ao valor canônico em inglês", () => {
    expect((pt as Record<string, string>)["status.notStarted"]).toBe("Não iniciado");
    expect((pt as Record<string, string>)["priority.critical"]).toBe("Crítica");
    expect((en as Record<string, string>)["status.notStarted"]).toBe("Not started");
  });
});
