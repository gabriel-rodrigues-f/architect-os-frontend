import { afterEach, describe, expect, it } from "vitest";

import {
  byName,
  firstWord,
  formatDate,
  initialSearchParam,
  replaceSearchParam,
  slug,
} from "../text";

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
  it("converte ISO em dd/mm/aaaa no idioma pt", () => {
    expect(formatDate("2026-08-11T14:35:00.000Z", "pt")).toBe("11/08/2026");
  });

  /** A mesma data sai com dia e mês trocados — é o bug que este formato existe para evitar. */
  it("converte ISO em mm/dd/aaaa no idioma en", () => {
    expect(formatDate("2026-08-11T14:35:00.000Z", "en")).toBe("08/11/2026");
  });

  it("devolve null para ausente ou inválida", () => {
    expect(formatDate(undefined, "pt")).toBeNull();
    expect(formatDate(null, "pt")).toBeNull();
    expect(formatDate("não é data", "pt")).toBeNull();
  });

  /**
   * `new Date("2026-01-01")` é meia-noite UTC. Sem travar o fuso em UTC, um
   * fuso atrás (Brasil, por exemplo) mostraria 31/12 — a mesma armadilha que
   * `todayIso()` documenta e evita ao montar a data à mão.
   */
  it("data sem hora não desliza um dia num fuso atrás de UTC", () => {
    expect(formatDate("2026-01-01", "pt")).toBe("01/01/2026");
    expect(formatDate("2026-01-01", "en")).toBe("01/01/2026");
  });
});

describe("firstWord", () => {
  it("extrai a primeira palavra, ignorando espaços extras", () => {
    expect(firstWord("Engenharia de Plataforma")).toBe("Engenharia");
    expect(firstWord("  DevOps ")).toBe("DevOps");
  });
});

/**
 * B-12 (AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1) — o par que
 * dá às telas de análise (Análise de Lacunas, Progressão) estado
 * persistente na URL sem depender de `Route.useSearch()` (exige
 * `RouterProvider`, que os testes de página isolada não montam).
 */
describe("initialSearchParam / replaceSearchParam", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("lê um parâmetro presente na URL", () => {
    window.history.replaceState(null, "", "/gap-analysis?selected=ana,bruno");
    expect(initialSearchParam("selected")).toBe("ana,bruno");
  });

  it("retorna undefined quando o parâmetro não está na URL", () => {
    window.history.replaceState(null, "", "/gap-analysis");
    expect(initialSearchParam("selected")).toBeUndefined();
  });

  it("distingue parâmetro ausente de parâmetro presente e vazio", () => {
    window.history.replaceState(null, "", "/gap-analysis?selected=");
    expect(initialSearchParam("selected")).toBe("");
  });

  it("escreve o parâmetro na URL sem adicionar entrada no histórico", () => {
    window.history.replaceState(null, "", "/gap-analysis");
    replaceSearchParam("selected", "ana,bruno");
    expect(window.location.search).toBe("?selected=ana%2Cbruno");
    expect(initialSearchParam("selected")).toBe("ana,bruno");
  });

  it("undefined remove o parâmetro da URL", () => {
    window.history.replaceState(null, "", "/gap-analysis?selected=ana");
    replaceSearchParam("selected", undefined);
    expect(window.location.search).toBe("");
  });

  it("preserva os demais parâmetros da URL", () => {
    window.history.replaceState(null, "", "/assessments?architectId=ana&cycleId=2026-h1");
    replaceSearchParam("cycleId", "2026-h2");
    expect(initialSearchParam("architectId")).toBe("ana");
    expect(initialSearchParam("cycleId")).toBe("2026-h2");
  });
});
