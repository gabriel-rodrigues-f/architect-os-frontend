import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Pagination } from "@/components/app/DataView";
import { I18nProvider } from "../i18n";

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
