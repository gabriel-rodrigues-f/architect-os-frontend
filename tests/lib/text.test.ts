import { describe, expect, it } from "vitest";

import { defaultDateFormatter, defaultNameFormatter } from "@/lib/text";

/**
 * OO3-08 — os wrappers de compatibilidade (`slug`, `byName`, `formatDate`
 * etc. como funções soltas) foram removidos junto com a migração dos call
 * sites; os invariantes seguem os mesmos, agora exercitados direto nas
 * instâncias compartilhadas (`defaultNameFormatter`/`defaultDateFormatter`)
 * que os call sites de produção usam.
 */
describe("NameFormatter", () => {
  describe("slug", () => {
    it("normaliza acentos e espaços", () => {
      expect(defaultNameFormatter.slug("Arquitetura de Aplicações Web")).toBe(
        "arquitetura-de-aplicacoes-web",
      );
    });

    it("não deixa hífen sobrando nas pontas", () => {
      // era a divergência entre as cópias: uma gerava "modelagem-v2-"
      expect(defaultNameFormatter.slug("Modelagem (v2)")).toBe("modelagem-v2");
      expect(defaultNameFormatter.slug("  Kubernetes  ")).toBe("kubernetes");
      expect(defaultNameFormatter.slug("!!!Observabilidade!!!")).toBe("observabilidade");
    });

    it("é estável: o mesmo nome sempre gera o mesmo id", () => {
      expect(defaultNameFormatter.slug("Engenharia de Custos")).toBe(
        defaultNameFormatter.slug("engenharia de custos"),
      );
    });
  });

  describe("byName", () => {
    it("ordena em pt-BR respeitando acentos", () => {
      const sorted = [
        { name: "Arquitetura de Software" },
        { name: "Arquitetura de Segurança" },
        { name: "Arquitetura Corporativa" },
      ].sort(defaultNameFormatter.byName);

      expect(sorted.map((d) => d.name)).toEqual([
        "Arquitetura Corporativa",
        "Arquitetura de Segurança",
        "Arquitetura de Software",
      ]);
    });

    it("ignora diferença de caixa", () => {
      expect(defaultNameFormatter.byName({ name: "devops" }, { name: "DevOps" })).toBe(0);
    });
  });

  describe("matchesSearch", () => {
    it("casa por substring sem caixa e aceita termo vazio", () => {
      expect(defaultNameFormatter.matchesSearch("Kubernetes", "kube")).toBe(true);
      expect(defaultNameFormatter.matchesSearch("Kubernetes", "azure")).toBe(false);
      expect(defaultNameFormatter.matchesSearch("Kubernetes", "")).toBe(true);
    });
  });

  describe("truncateNames", () => {
    it("divide em mostrados + restantes a partir do teto", () => {
      const names = ["a", "b", "c", "d", "e", "f"];
      expect(defaultNameFormatter.truncateNames(names, 5)).toEqual({
        shown: names.slice(0, 5),
        remaining: 1,
      });
      expect(defaultNameFormatter.truncateNames(["a", "b"], 5)).toEqual({
        shown: ["a", "b"],
        remaining: 0,
      });
    });
  });
});

describe("DateFormatter", () => {
  describe("formatDate", () => {
    it("converte ISO em dd/mm/aaaa no idioma pt", () => {
      expect(defaultDateFormatter.formatDate("2026-08-11T14:35:00.000Z", "pt")).toBe("11/08/2026");
    });

    /** A mesma data sai com dia e mês trocados — é o bug que este formato existe para evitar. */
    it("converte ISO em mm/dd/aaaa no idioma en", () => {
      expect(defaultDateFormatter.formatDate("2026-08-11T14:35:00.000Z", "en")).toBe("08/11/2026");
    });

    it("devolve null para ausente ou inválida", () => {
      expect(defaultDateFormatter.formatDate(undefined, "pt")).toBeNull();
      expect(defaultDateFormatter.formatDate(null, "pt")).toBeNull();
      expect(defaultDateFormatter.formatDate("não é data", "pt")).toBeNull();
    });

    /**
     * `new Date("2026-01-01")` é meia-noite UTC. Sem travar o fuso em UTC, um
     * fuso atrás (Brasil, por exemplo) mostraria 31/12 — a mesma armadilha que
     * `todayIso()` documenta e evita ao montar a data à mão.
     */
    it("data sem hora não desliza um dia num fuso atrás de UTC", () => {
      expect(defaultDateFormatter.formatDate("2026-01-01", "pt")).toBe("01/01/2026");
      expect(defaultDateFormatter.formatDate("2026-01-01", "en")).toBe("01/01/2026");
    });
  });

  it("todayIso/daysAgoIso devolvem AAAA-MM-DD", () => {
    const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
    expect(defaultDateFormatter.todayIso()).toMatch(DATE_ONLY);
    expect(defaultDateFormatter.daysAgoIso(30)).toMatch(DATE_ONLY);
  });
});
