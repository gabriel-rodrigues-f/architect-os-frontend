import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GapTable } from "@/components/app/gap-analysis-shared";
import { I18nProvider } from "@/lib/i18n";

/**
 * R2-VIS-03 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — a linha vazia da GapTable
 * usava `colSpan={mastery ? 6 : 7}`, um a menos que as colunas reais do
 * cabeçalho (7 sem a coluna Tipo, 8 com ela) — a mensagem de "sem lacunas"
 * não ocupava a última coluna, deixando um pedaço da linha em branco.
 */
describe("GapTable — colSpan da linha vazia acompanha o cabeçalho real", () => {
  it("mastery=false: colSpan cobre as 8 colunas (inclui Tipo)", () => {
    const { container } = render(
      <I18nProvider>
        <GapTable rows={[]} capabilities={[]} />
      </I18nProvider>,
    );
    const headerCols = container.querySelectorAll("thead th").length;
    const emptyRowSpan = container.querySelector("tbody td[colspan]")?.getAttribute("colspan");
    expect(headerCols).toBe(8);
    expect(emptyRowSpan).toBe("8");
  });

  it("mastery=true: colSpan cobre as 7 colunas (sem Tipo)", () => {
    const { container } = render(
      <I18nProvider>
        <GapTable rows={[]} capabilities={[]} mastery />
      </I18nProvider>,
    );
    const headerCols = container.querySelectorAll("thead th").length;
    const emptyRowSpan = container.querySelector("tbody td[colspan]")?.getAttribute("colspan");
    expect(headerCols).toBe(7);
    expect(emptyRowSpan).toBe("7");
  });
});
