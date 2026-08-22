import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArchitectFilter } from "@/components/app/ArchitectFilter";
import {
  MultiSelectFilter,
  type MultiSelectFilterOption,
} from "@/components/app/MultiSelectFilter";
import type { Architect } from "@/lib/domain";
import { I18nProvider } from "../i18n";

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-43 (§41, Fase 4/5) —
 * "mitigação obrigatória de localizabilidade": com mais de 10 opções, achar
 * um valor numa lista de caixinhas é mais lento que digitar, então o popover
 * ganha um campo de busca interno. Abaixo de 10 o campo é ruído e não deve
 * aparecer — os dois lados do limiar têm teste dedicado.
 */

const manyOptions: MultiSelectFilterOption[] = Array.from({ length: 12 }, (_, i) => ({
  id: `opt-${i}`,
  label: `Competência ${String(i).padStart(2, "0")}`,
}));

const fewOptions: MultiSelectFilterOption[] = manyOptions.slice(0, 5);

const renderMulti = (options: MultiSelectFilterOption[], selected: string[] = []) => {
  const onChange = vi.fn();
  render(
    <I18nProvider>
      <MultiSelectFilter
        id="f"
        label="Faceta"
        options={options}
        selected={selected}
        onChange={onChange}
        selectAllLabel="Selecionar tudo"
        allSummaryLabel="Todas"
        noneSummaryLabel="Nenhuma"
      />
    </I18nProvider>,
  );
  return onChange;
};

describe("MultiSelectFilter — busca interna (B-43)", () => {
  afterEach(() => cleanup());

  it("com mais de 10 opções, o popover mostra um campo de busca focado ao abrir", async () => {
    renderMulti(manyOptions);
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    const search = screen.getByRole("textbox");
    expect(document.activeElement).toBe(search);
  });

  it("digitar no campo de busca estreita a lista de opções", async () => {
    renderMulti(manyOptions);
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    await userEvent.type(screen.getByRole("textbox"), "05");

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Competência 05" })).toBeTruthy();
  });

  it("busca sem nenhum resultado mostra a mensagem de vazio, não a lista", async () => {
    renderMulti(manyOptions);
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    await userEvent.type(screen.getByRole("textbox"), "zzz-inexistente");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText(/Nenhum resultado para/)).toBeTruthy();
  });

  it("'Selecionar tudo' opera sobre o conjunto completo, mesmo com a busca filtrando a lista visível", async () => {
    const onChange = renderMulti(manyOptions);
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    await userEvent.type(screen.getByRole("textbox"), "05");

    await userEvent.click(screen.getByRole("button", { name: "Selecionar tudo" }));

    expect(onChange).toHaveBeenCalledWith(manyOptions.map((o) => o.id));
  });

  it("com 10 opções ou menos, não existe campo de busca — foco vai direto para 'Selecionar tudo'", async () => {
    renderMulti(fewOptions);
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Selecionar tudo" }));
  });
});

const manyArchitects: Architect[] = Array.from({ length: 11 }, (_, i) => ({
  id: `arq-${i}`,
  name: `Arquiteto ${String(i).padStart(2, "0")}`,
  role: "Arquiteto de Soluções I",
  yearsAsArchitect: 1,
  specialization: "",
  email: `a${i}@a.com`,
  active: true,
  version: 1,
}));

describe("ArchitectFilter — busca interna (B-43)", () => {
  afterEach(() => cleanup());

  it("com mais de 10 arquitetos, digitar no campo de busca estreita a lista", async () => {
    render(
      <I18nProvider>
        <ArchitectFilter architects={manyArchitects} selected={[]} onChange={vi.fn()} />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    expect(document.activeElement).toBe(screen.getByRole("textbox"));

    await userEvent.type(screen.getByRole("textbox"), "07");

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Arquiteto 07" })).toBeTruthy();
  });
});
