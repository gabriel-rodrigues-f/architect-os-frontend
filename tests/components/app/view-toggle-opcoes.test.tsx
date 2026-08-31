import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChartPie, Radar, Table2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ViewToggle } from "@/components/app";

/**
 * Regra 6 (2+ ocorrências = componente) no caso mais limpo: o seletor de
 * visão nasceu preso ao par cartões/tabela do Time, com os ícones embutidos
 * no corpo. A segunda pergunta ("radar ou tabela?", no Comparativo) chegou —
 * então quem escolhe as opções, os rótulos e os ícones é o chamador.
 */

describe("ViewToggle — as opções vêm de quem chama", () => {
  afterEach(cleanup);

  it("desenha um botão por opção declarada, com o rótulo de cada uma", () => {
    render(
      <ViewToggle
        view="radar"
        onChange={() => {}}
        options={[
          { value: "radar", label: "Radar", icon: Radar },
          { value: "table", label: "Tabela", icon: Table2 },
        ]}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Radar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tabela" })).toBeTruthy();
  });

  it("não fica preso a duas opções", () => {
    render(
      <ViewToggle
        view="pizza"
        onChange={() => {}}
        options={[
          { value: "radar", label: "Radar", icon: Radar },
          { value: "table", label: "Tabela", icon: Table2 },
          { value: "pizza", label: "Pizza", icon: ChartPie },
        ]}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Pizza" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("anuncia a opção ativa e devolve o valor escolhido", () => {
    const onChange = vi.fn();
    render(
      <ViewToggle
        view="radar"
        onChange={onChange}
        options={[
          { value: "radar", label: "Radar", icon: Radar },
          { value: "table", label: "Tabela", icon: Table2 },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Radar" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Tabela" }).getAttribute("aria-pressed")).toBe(
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
    expect(onChange).toHaveBeenCalledWith("table");
  });

  it("cada opção leva o próprio ícone, não um par fixo", () => {
    const { container } = render(
      <ViewToggle
        view="radar"
        onChange={() => {}}
        options={[
          { value: "radar", label: "Radar", icon: Radar },
          { value: "table", label: "Tabela", icon: Table2 },
        ]}
      />,
    );

    const classesDosIcones = Array.from(container.querySelectorAll("svg")).map((svg) =>
      svg.getAttribute("class"),
    );
    expect(classesDosIcones).toHaveLength(2);
    expect(classesDosIcones[0]).toContain("lucide-radar");
    expect(classesDosIcones[1]).toContain("lucide-table-2");
  });
});
