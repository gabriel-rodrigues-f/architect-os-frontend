import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArchitectFilter } from "@/components/app/ArchitectFilter";
import type { Architect } from "@/lib/domain";
import { I18nProvider } from "../i18n";

/**
 * Pedido do usuário revisando o app rodando, em duas rodadas:
 * (1) com "Todo o time" marcado, as caixinhas de cada pessoa apareciam
 * desmarcadas; (2) clicar em "Todo o time" já marcado não tinha efeito
 * nenhum visível. A resolução das duas juntas: `selected` passa a ser
 * sempre explícito (vazio = ninguém, nunca mais "todo o time" implícito), e
 * "Todo o time" vira um alternador de verdade — marca tudo, clique de novo
 * desmarca tudo. Mesmo componente usado em gap-analysis.tsx e
 * mentoring.tsx.
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

describe("ArchitectFilter — 'Todo o time' como alternador de verdade", () => {
  afterEach(() => cleanup());

  it("com todo mundo explicitamente selecionado, o mestre e cada pessoa aparecem marcados", async () => {
    renderFilter(["ana", "bruno"]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    const master = screen.getByRole("button", { name: "Todo o time" }).querySelector('[role="checkbox"]');
    expect(master?.getAttribute("aria-checked")).toBe("true");

    for (const option of screen.getAllByRole("option")) {
      expect(option.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");
    }
  });

  it("com seleção vazia, o mestre e cada pessoa aparecem desmarcados", async () => {
    renderFilter([]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));

    const master = screen.getByRole("button", { name: "Todo o time" }).querySelector('[role="checkbox"]');
    expect(master?.getAttribute("aria-checked")).toBe("false");

    for (const option of screen.getAllByRole("option")) {
      expect(option.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("false");
    }
    expect(screen.getByText("Nenhum arquiteto selecionado")).toBeTruthy();
  });

  it("clicar em 'Todo o time' já marcado (todos selecionados) desmarca tudo", async () => {
    const onChange = renderFilter(["ana", "bruno"]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    await userEvent.click(screen.getByRole("button", { name: "Todo o time" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("clicar em 'Todo o time' com seleção vazia ou parcial marca todo mundo", async () => {
    const onChange = renderFilter(["ana"]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    await userEvent.click(screen.getByRole("button", { name: "Todo o time" }));

    expect(onChange).toHaveBeenCalledWith(["ana", "bruno"]);
  });

  it("clicar numa pessoa específica alterna só ela, sem depender do estado do mestre", async () => {
    const onChange = renderFilter([]);
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    await userEvent.click(screen.getByRole("option", { name: "Bruno Almeida" }));

    expect(onChange).toHaveBeenCalledWith(["bruno"]);
  });
});
