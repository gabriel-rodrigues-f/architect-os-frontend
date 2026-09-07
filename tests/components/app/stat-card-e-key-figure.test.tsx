import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { KeyFigureCard } from "@/components/app/KeyFigure";
import { StatCard } from "@/components/app/ui-bits";
import { I18nProvider } from "@/lib/i18n";

/**
 * Revisão mestre 2026-09-08, [D-01]: dois cartões de KPI para o mesmo
 * conceito — `StatCard` a 24 px e `KeyFigureCard` a 44 px. Agora é um só:
 * `StatCard` é o apelido de `KeyFigureCard size="sm"` (Display 32, token
 * `--text-kpi`), com o mesmo tom, a mesma legenda e o ícone na caixa tingida.
 */

afterEach(cleanup);

describe("StatCard é KeyFigureCard size=sm", () => {
  it("o StatCard renderiza a figura pequena, com legenda e ícone", () => {
    const { container } = render(
      <I18nProvider>
        <StatCard
          label="Pendentes"
          value={3}
          hint="a revisar"
          icon={<svg data-icon />}
          tone="attention"
        />
      </I18nProvider>,
    );
    const figura = screen.getByText("Pendentes").closest("[data-key-figure]")!;
    expect(figura.getAttribute("data-size")).toBe("sm");
    expect(figura.getAttribute("data-tone")).toBe("attention");
    expect(screen.getByText("3").className).toContain("text-(length:--text-kpi)");
    expect(screen.getByText("a revisar")).toBeTruthy();
    expect(container.querySelector("[data-icon]")?.parentElement?.className).toContain(
      "bg-warning",
    );
  });

  it("o KeyFigureCard grande continua no Display XL, e o número é o mesmo objeto", () => {
    render(
      <I18nProvider>
        <KeyFigureCard label="Pessoas" value={1234} />
      </I18nProvider>,
    );
    const figura = screen.getByText("Pessoas").closest("[data-key-figure]")!;
    expect(figura.getAttribute("data-size")).toBe("md");
    expect(screen.getByText("1.234").className).toContain("key-figure-value");
  });

  it("o valor pode ser um nó — o texto do status entra como está", () => {
    render(
      <I18nProvider>
        <KeyFigureCard size="sm" label="Avaliação" value={<em>Concluída</em>} />
      </I18nProvider>,
    );
    expect(screen.getByText("Concluída").tagName).toBe("EM");
  });
});
