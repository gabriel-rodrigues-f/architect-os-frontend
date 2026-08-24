import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "../i18n";
import { useLabels } from "../labels";

/**
 * R2-VIS-07 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — "Avaliação: Concluído" e
 * "Ação: Bloqueado" usavam o mesmo particípio genérico do PDI ("o PDI",
 * masc.), sem concordar com o gênero de "a Avaliação"/"a Ação". Trava que
 * cada entidade fem. resolve para a chave por-entidade, não a genérica.
 */
function Wrapper({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

describe("concordância de gênero nos rótulos de status", () => {
  it("avaliação concluída concorda com 'a Avaliação' (Concluída, não Concluído)", () => {
    const { result } = renderHook(() => useLabels(), { wrapper: Wrapper });
    expect(result.current.assessmentStatus.Completed).toBe("Concluída");
  });

  it("item do PDI concorda com 'a Ação' (Bloqueada/Concluída/Não iniciada)", () => {
    const { result } = renderHook(() => useLabels(), { wrapper: Wrapper });
    expect(result.current.planItemStatus.Blocked).toBe("Bloqueada");
    expect(result.current.planItemStatus.Completed).toBe("Concluída");
    expect(result.current.planItemStatus["Not Started"]).toBe("Não iniciada");
  });

  it("PDI como um todo continua masc. ('o PDI'): Concluído, não Concluída", () => {
    const { result } = renderHook(() => useLabels(), { wrapper: Wrapper });
    expect(result.current.planStatus.Completed).toBe("Concluído");
  });

  it("progresso de item de trilha continua masc. ('o Item'): Concluído", () => {
    const { result } = renderHook(() => useLabels(), { wrapper: Wrapper });
    expect(result.current.learningStatus.Completed).toBe("Concluído");
  });

  it("'Em andamento' não flexiona — mesma chave para PDI e item do PDI", () => {
    const { result } = renderHook(() => useLabels(), { wrapper: Wrapper });
    expect(result.current.planItemStatus["In Progress"]).toBe("Em andamento");
  });
});
