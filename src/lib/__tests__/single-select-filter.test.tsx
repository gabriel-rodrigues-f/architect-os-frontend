import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SingleSelectFilter } from "@/components/app/SingleSelectFilter";

/**
 * R3-006 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — "Ordenar por" trocou de
 * `<select>` nativo por `SingleSelectFilter`, o irmão de seleção única do
 * `MultiSelectFilter`: mesmo `FilterTriggerButton`/`Popover`, sem busca/
 * checkbox/"selecionar tudo", clicar numa opção seleciona e fecha.
 */
describe("SingleSelectFilter", () => {
  afterEach(() => cleanup());

  const options = [
    { value: "name-asc", label: "Nome (A–Z)" },
    { value: "name-desc", label: "Nome (Z–A)" },
    { value: "level", label: "Nível médio" },
  ];

  it("mostra o rótulo da opção selecionada no gatilho", () => {
    render(
      <SingleSelectFilter
        id="team-sort"
        label="Ordenar por"
        options={options}
        value="level"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Ordenar por" }).textContent).toContain(
      "Nível médio",
    );
  });

  it("clicar numa opção seleciona e fecha o popover", async () => {
    const onChange = vi.fn();
    render(
      <SingleSelectFilter
        id="team-sort"
        label="Ordenar por"
        options={options}
        value="name-asc"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
    const option = await screen.findByRole("option", { name: "Nível médio" });
    await userEvent.click(option);

    expect(onChange).toHaveBeenCalledWith("level");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("Escape fecha o popover e devolve o foco pro botão-gatilho", async () => {
    render(
      <SingleSelectFilter
        id="team-sort"
        label="Ordenar por"
        options={options}
        value="name-asc"
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Ordenar por" });
    await userEvent.click(trigger);
    expect(await screen.findByRole("listbox")).toBeTruthy();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
