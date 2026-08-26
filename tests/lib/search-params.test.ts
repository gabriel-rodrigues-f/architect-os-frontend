import { afterEach, describe, expect, it } from "vitest";

import { initialSearchParam, replaceSearchParam } from "@/lib/search-params";

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
