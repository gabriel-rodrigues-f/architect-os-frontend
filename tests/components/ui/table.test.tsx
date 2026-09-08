import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SortableHeader } from "@/components/app/SortableHeader";
import { TBody, TCaption, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { I18nProvider } from "@/lib/i18n";

/**
 * Revisão mestre 2026-09-08, [F-05]: 18 tabelas cruas, cabeçalho copiado 14
 * vezes, `py-2` numa tela e `py-3` na outra. A primitiva fixa a altura da
 * linha por densidade (44–52 px), o cabeçalho em `eyebrow`, o número à
 * direita em tabular, e o `SortableHeader` compõe o `Th`.
 */

afterEach(cleanup);

function tabela(density?: "compact" | "comfortable") {
  return render(
    <Table {...(density ? { density } : {})}>
      <TCaption>Profissionais do time</TCaption>
      <THead>
        <Tr>
          <Th>Nome</Th>
          <Th numeric>Distância</Th>
        </Tr>
      </THead>
      <TBody>
        <Tr>
          <Td>Ana</Td>
          <Td numeric>2</Td>
        </Tr>
      </TBody>
    </Table>,
  );
}

describe("Table — a tabela da casa", () => {
  it("publica a densidade e a linha do corpo mede por ela: 52 confortável, 44 compacta", () => {
    const { container, unmount } = tabela();
    expect(container.querySelector("table")?.getAttribute("data-density")).toBe("comfortable");
    expect(container.querySelector("tbody tr")?.className).toContain("h-13");
    unmount();
    const compacta = tabela("compact");
    expect(compacta.container.querySelector("table")?.getAttribute("data-density")).toBe("compact");
    expect(compacta.container.querySelector("tbody tr")?.className).toContain("h-11");
  });

  it("o cabeçalho é o eyebrow da escala e a linha dele não tem hover", () => {
    const { container } = tabela();
    expect(screen.getByText("Nome").className).toContain("eyebrow");
    expect(container.querySelector("thead tr")?.className).not.toContain("hover:");
    expect(container.querySelector("tbody tr")?.className).toContain("hover:bg-(--surface-hover)");
  });

  it("a célula numérica alinha à direita em tabular — no corpo e no cabeçalho", () => {
    tabela();
    expect(screen.getByText("2").className).toContain("text-right");
    expect(screen.getByText("2").className).toContain("tabular-nums");
    expect(screen.getByText("Distância").className).toContain("text-right");
    expect(screen.getByText("Ana").className).not.toContain("text-right");
  });

  it("a legenda existe e a tabela rola dentro do próprio contêiner", () => {
    const { container } = tabela();
    expect(screen.getByText("Profissionais do time").tagName).toBe("CAPTION");
    expect(container.querySelector("table")?.parentElement?.className).toContain("overflow-x-auto");
  });

  it("SortableHeader é um Th com aria-sort e o botão de ordenar", () => {
    render(
      <I18nProvider>
        <Table>
          <THead>
            <Tr>
              <SortableHeader column="name" label="Nome" direction="asc" onToggle={() => {}} />
            </Tr>
          </THead>
        </Table>
      </I18nProvider>,
    );
    const th = screen.getByRole("columnheader");
    expect(th.getAttribute("aria-sort")).toBe("ascending");
    expect(th.className).toContain("eyebrow");
    expect(screen.getByRole("button", { name: "Ordenar por Nome" })).toBeTruthy();
  });
});
