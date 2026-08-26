import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useSearchParamList, useSearchParamString } from "@/hooks/use-search-param";

/**
 * OO3-11b — o mecanismo do par URL⇄estado, testado uma vez no hook; os
 * testes de tela (`gap-analysis-restructure.test.tsx`) continuam provando o
 * invariante de produto ("a tela honra o link"), sem duplicar o mecanismo.
 */
describe("useSearchParamList", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("cai no default do chamador quando o parâmetro está ausente", () => {
    window.history.replaceState(null, "", "/gap-analysis");
    const { result } = renderHook(() => useSearchParamList("selected", () => ["ana", "bruno"]));
    expect(result.current[0]).toEqual(["ana", "bruno"]);
  });

  it("?selected= (presente e vazio) é seleção vazia explícita, não o default", () => {
    window.history.replaceState(null, "", "/gap-analysis?selected=");
    const { result } = renderHook(() => useSearchParamList("selected", () => ["ana"]));
    expect(result.current[0]).toEqual([]);
  });

  it("o setter escreve o CSV de volta na URL", () => {
    window.history.replaceState(null, "", "/gap-analysis");
    const { result } = renderHook(() => useSearchParamList("selected", () => []));
    act(() => {
      result.current[1](["ana", "bruno"]);
    });
    expect(result.current[0]).toEqual(["ana", "bruno"]);
    expect(window.location.search).toBe("?selected=ana%2Cbruno");
  });
});

describe("useSearchParamString", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("lê o escalar da URL uma vez, com fallback do chamador", () => {
    window.history.replaceState(null, "", "/assessments?architectId=ana");
    const { result } = renderHook(() => useSearchParamString("architectId", () => "fallback"));
    expect(result.current[0]).toBe("ana");
  });

  it("sem writeBack (default), o setter NUNCA toca na URL — comportamento de /assessments e /development-plans", () => {
    window.history.replaceState(null, "", "/development-plans");
    const { result } = renderHook(() => useSearchParamString("architectId", () => "ana"));
    act(() => {
      result.current[1]("bruno");
    });
    expect(result.current[0]).toBe("bruno");
    expect(window.location.search).toBe("");
  });
});
