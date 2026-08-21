import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArchitectFilter } from "@/components/app/ArchitectFilter";
import type { Architect } from "@/lib/domain";
import { I18nProvider } from "../i18n";

/**
 * Pedido do usuário revisando o app rodando: com "Todo o time" marcado
 * (seleção vazia = todo o time, ver `applyArchitectFilter`), as caixinhas de
 * cada pessoa apareciam desmarcadas — parecia que ninguém estava
 * selecionado. Mesma correção vale para o `ArchitectFilter` usado em
 * gap-analysis.tsx e mentoring.tsx (componente único).
 */

const architects: Architect[] = [
  { id: "ana", name: "Ana Martins", role: "Arquiteto de Soluções II", yearsAsArchitect: 4, specialization: "", email: "a@a.com", active: true, version: 1 },
  { id: "bruno", name: "Bruno Almeida", role: "Arquiteto de Soluções I", yearsAsArchitect: 2, specialization: "", email: "b@b.com", active: true, version: 1 },
];

const renderFilter = (selected: string[]) => {
  const onChange = vi.fn();
  render(
    <I18nProvider>
      <ArchitectFilter architects={architects} selected={selected} onChange={onChange} />
    </I18nProvider>,
  );
  return onChange;
};

describe("ArchitectFilter — 'Todo o time' marca visualmente cada pessoa", () => {
  afterEach(() => cleanup());

  it("com seleção vazia (todo o time), cada checkbox individual aparece marcado", async () => {
    renderFilter([]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    for (const option of options) {
      expect(option.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");
    }
  });

  it("com uma pessoa selecionada, só a dela aparece marcada", async () => {
    renderFilter(["ana"]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    const anaCheckbox = screen.getByRole("option", { name: "Ana Martins" }).querySelector('[role="checkbox"]');
    const brunoCheckbox = screen.getByRole("option", { name: "Bruno Almeida" }).querySelector('[role="checkbox"]');
    expect(anaCheckbox?.getAttribute("aria-checked")).toBe("true");
    expect(brunoCheckbox?.getAttribute("aria-checked")).toBe("false");
  });

  it("clicar numa pessoa enquanto 'todo o time' está implícito estreita para só ela", async () => {
    const onChange = renderFilter([]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    await userEvent.click(screen.getByRole("option", { name: "Bruno Almeida" }));

    expect(onChange).toHaveBeenCalledWith(["bruno"]);
  });
});
