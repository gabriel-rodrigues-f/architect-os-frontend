import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GapTable } from "@/components/app/gap-analysis-shared";
import { I18nProvider } from "@/lib/i18n";

/**
 * R2-VIS-03 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — a linha vazia da GapTable
 * já saiu com colSpan menor que o cabeçalho real. Onda 36: a coluna Tipo
 * morreu com a obrigatoriedade — são 7 colunas nas duas variantes.
 */
describe("GapTable — colSpan da linha vazia acompanha o cabeçalho real", () => {
  it.each([false, true])("mastery=%s: colSpan cobre as 7 colunas (sem Tipo)", (mastery) => {
    const { container } = render(
      <I18nProvider>
        <GapTable rows={[]} capabilities={[]} mastery={mastery} />
      </I18nProvider>,
    );
    const headerCols = container.querySelectorAll("thead th").length;
    const emptyRowSpan = container.querySelector("tbody td[colspan]")?.getAttribute("colspan");
    expect(headerCols).toBe(7);
    expect(emptyRowSpan).toBe("7");
  });
});
