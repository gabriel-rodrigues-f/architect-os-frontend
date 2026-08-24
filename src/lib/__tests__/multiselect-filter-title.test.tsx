import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MultiSelectFilter } from "@/components/app/MultiSelectFilter";
import { I18nProvider } from "../i18n";

/**
 * R2-VIS-02 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — opções do MultiSelect
 * truncavam sem `title`, escondendo o rótulo inteiro sem nenhum jeito de lê-lo.
 */
describe("MultiSelectFilter — opção truncada carrega title", () => {
  afterEach(() => cleanup());

  it("cada opção tem title com o próprio rótulo", async () => {
    render(
      <I18nProvider>
        <MultiSelectFilter
          id="test-filter"
          label="Teste"
          options={[
            { id: "a", label: "Arquitetura de Aplicações Integradas Corporativas Legadas" },
            { id: "b", label: "DevOps" },
          ]}
          selected={["a", "b"]}
          onChange={vi.fn()}
          selectAllLabel="Todas"
          allSummaryLabel="Todas selecionadas"
          noneSummaryLabel="Nenhuma"
        />
      </I18nProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Teste" }));
    const option = await screen.findByRole("option", {
      name: "Arquitetura de Aplicações Integradas Corporativas Legadas",
    });
    expect(option.getAttribute("title")).toBe(
      "Arquitetura de Aplicações Integradas Corporativas Legadas",
    );
  });
});
