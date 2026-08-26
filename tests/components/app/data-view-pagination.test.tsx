import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Pagination } from "@/components/app/DataView";
import { I18nProvider } from "@/lib/i18n";

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1-12/B-13 — a barra de
 * paginação renderizava mesmo com uma página só, sempre que quem chama
 * também passasse `onPageSizeChange` (o caso real, Time: `total <=
 * pageSizeOptions[0] && !onPageSizeChange` nunca era verdade com os dois
 * lados presentes). O critério certo é `totalPages <= 1`, direto.
 */
describe("DataView — Pagination esconde com uma página só", () => {
  afterEach(() => cleanup());

  it("não renderiza nada quando tudo cabe numa página, mesmo com onPageSizeChange", () => {
    const { container } = render(
      <I18nProvider>
        <Pagination
          page={1}
          pageSize={10}
          total={8}
          onPageChange={vi.fn()}
          pageSizeOptions={[10, 25, 50]}
          onPageSizeChange={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renderiza normalmente quando há mais de uma página", () => {
    render(
      <I18nProvider>
        <Pagination
          page={1}
          pageSize={10}
          total={25}
          onPageChange={vi.fn()}
          pageSizeOptions={[10, 25, 50]}
          onPageSizeChange={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByText(/Página 1 de 3/)).toBeTruthy();
  });
});

/**
 * R3-008 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o `<select>` nativo de
 * tamanho de página virou `SingleSelectFilter` em uso compacto (sem
 * `label` visível, só `aria-label`, gatilho encolhido pra caber ao lado dos
 * botões "Anterior"/"Próxima"). Mesmo raciocínio de nome acessível fixo dos
 * outros testes de conversão: o `role="button"` chama-se pelo `aria-label`
 * constante ("Itens por página"), o tamanho atual é conferido pelo texto
 * visível dentro do gatilho.
 */
describe("DataView — Pagination, tamanho de página vira SingleSelectFilter", () => {
  afterEach(() => cleanup());

  it("mostra o tamanho atual no gatilho e troca ao escolher outra opção", async () => {
    const onPageSizeChange = vi.fn();
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Pagination
          page={1}
          pageSize={10}
          total={100}
          onPageChange={vi.fn()}
          pageSizeOptions={[10, 25, 50]}
          onPageSizeChange={onPageSizeChange}
        />
      </I18nProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Itens por página" });
    expect(trigger.textContent).toContain("10 por página");

    await user.click(trigger);
    const option = await screen.findByRole("option", { name: "25 por página" });
    await user.click(option);

    expect(onPageSizeChange).toHaveBeenCalledWith(25);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
