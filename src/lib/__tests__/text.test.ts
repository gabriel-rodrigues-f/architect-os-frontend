import { describe, expect, it } from "vitest";

import { byName, firstWord, formatDate, slug } from "../text";

describe("slug", () => {
  it("normaliza acentos e espaços", () => {
    expect(slug("Arquitetura de Aplicações Web")).toBe("arquitetura-de-aplicacoes-web");
  });

  it("não deixa hífen sobrando nas pontas", () => {
    // era a divergência entre as cópias: uma gerava "modelagem-v2-"
    expect(slug("Modelagem (v2)")).toBe("modelagem-v2");
    expect(slug("  Kubernetes  ")).toBe("kubernetes");
    expect(slug("!!!Observabilidade!!!")).toBe("observabilidade");
  });

  it("é estável: o mesmo nome sempre gera o mesmo id", () => {
    expect(slug("Engenharia de Custos")).toBe(slug("engenharia de custos"));
  });
});

describe("byName", () => {
  it("ordena em pt-BR respeitando acentos", () => {
    const sorted = [
      { name: "Arquitetura de Software" },
      { name: "Arquitetura de Segurança" },
      { name: "Arquitetura Corporativa" },
    ].sort(byName);

    expect(sorted.map((d) => d.name)).toEqual([
      "Arquitetura Corporativa",
      "Arquitetura de Segurança",
      "Arquitetura de Software",
    ]);
  });

  it("ignora diferença de caixa", () => {
    expect(byName({ name: "devops" }, { name: "DevOps" })).toBe(0);
  });
});

describe("formatDate", () => {
  it("converte ISO em dd/mm/aaaa", () => {
    expect(formatDate("2026-08-11T14:35:00.000Z")).toBe("11/08/2026");
  });

  it("devolve null para ausente ou inválida", () => {
    expect(formatDate(undefined)).toBeNull();
    expect(formatDate(null)).toBeNull();
    expect(formatDate("não é data")).toBeNull();
  });
});

describe("firstWord", () => {
  it("extrai a primeira palavra, ignorando espaços extras", () => {
    expect(firstWord("Engenharia de Plataforma")).toBe("Engenharia");
    expect(firstWord("  DevOps ")).toBe("DevOps");
  });
});
