import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { KeyFigure, KeyFigureCard } from "@/components/app/KeyFigure";
import { I18nProvider } from "@/lib/i18n";
import { KeyFigureFormatter } from "@/lib/key-figure-format";

/**
 * Referência FIAP 2026-09-06, §2 itens 1 e 2: "uma dobra, uma ideia" e
 * "números como afirmação". Cada bloco do Painel tem UM número-síntese
 * grande (40–48 px), a legenda pequena embaixo e, opcionalmente, a
 * tendência. O C-Level lê o número antes do texto — o componente existe
 * para que o número seja sempre o mesmo objeto, em todas as telas.
 */

afterEach(cleanup);

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

const comIdioma = (ui: ReactNode) => render(<I18nProvider>{ui}</I18nProvider>);

describe("KeyFigureFormatter — o formato do número-síntese", () => {
  const formatador = new KeyFigureFormatter("pt");

  it("inteiro com separador de milhar do idioma", () => {
    expect(formatador.format(1234, "integer")).toBe("1.234");
    expect(formatador.format(7, "integer")).toBe("7");
  });

  it("percentual sem casas: 0,8 vira 80%", () => {
    expect(formatador.format(0.8, "percent")).toBe("80%");
    expect(formatador.format(0, "percent")).toBe("0%");
  });

  it("decimal com uma casa, na vírgula do idioma", () => {
    expect(formatador.format(1.24, "decimal")).toBe("1,2");
    expect(formatador.format(2, "decimal")).toBe("2,0");
  });

  it("razão vazia (0 de 0) não vira NaN — é zero", () => {
    expect(KeyFigureFormatter.ratio(0, 0)).toBe(0);
    expect(KeyFigureFormatter.ratio(4, 5)).toBe(0.8);
  });
});

describe("KeyFigure — valor grande, legenda pequena, tendência opcional", () => {
  it("mostra o rótulo, o valor formatado e a legenda", () => {
    comIdioma(
      <KeyFigure label="Profissionais a capacitar" value={1234} caption="em 3 competências" />,
    );
    expect(screen.getByText("Profissionais a capacitar").className).toContain("section-heading");
    expect(screen.getByText("1.234").className).toContain("key-figure-value");
    expect(screen.getByText("em 3 competências")).toBeTruthy();
  });

  it("aceita percentual e decimal pelo formato, e texto quando o número não existe", () => {
    comIdioma(
      <>
        <KeyFigure label="Cobertura" value={0.8} format="percent" />
        <KeyFigure label="Distância média" value={1.24} format="decimal" />
        <KeyFigure label="Ciclo vigente" value="2026 H2" />
      </>,
    );
    expect(screen.getByText("80%")).toBeTruthy();
    expect(screen.getByText("1,2")).toBeTruthy();
    expect(screen.getByText("2026 H2")).toBeTruthy();
  });

  it("a tendência é opcional e publica a direção", () => {
    comIdioma(
      <>
        <KeyFigure label="Sem tendência" value={3} />
        <KeyFigure
          label="Com tendência"
          value={5}
          trend={{ direction: "up", label: "+2 no ciclo" }}
        />
      </>,
    );
    const semTendencia = screen.getByText("Sem tendência").closest("[data-key-figure]")!;
    expect(semTendencia.querySelector("[data-trend]")).toBeNull();
    const tendencia = screen.getByText("+2 no ciclo").closest("[data-trend]")!;
    expect(tendencia.getAttribute("data-trend")).toBe("up");
  });

  it("carrega o tom como o StatCard — neutro por padrão", () => {
    comIdioma(
      <>
        <KeyFigure label="Neutro" value={1} />
        <KeyFigure label="Crítico" value={1} tone="critical" />
      </>,
    );
    const toneOf = (label: string) =>
      screen.getByText(label).closest("[data-key-figure]")?.getAttribute("data-tone");
    expect(toneOf("Neutro")).toBe("neutral");
    expect(toneOf("Crítico")).toBe("critical");
  });

  it("KeyFigureCard é o mesmo número dentro de uma superfície de cartão", () => {
    comIdioma(<KeyFigureCard label="Capacidades com um profissional só" value={2} />);
    const figura = screen
      .getByText("Capacidades com um profissional só")
      .closest("[data-key-figure]")!;
    expect(figura.parentElement?.className).toContain("surface-card");
  });

  it("o valor mede entre 40 e 48 px, pelo token — não por número solto no componente", () => {
    expect(css).toMatch(/--text-key-figure:\s*4[0-8]px/);
    const inicio = css.indexOf("@utility key-figure-value {");
    expect(inicio).toBeGreaterThan(-1);
    const corpo = css.slice(inicio, css.indexOf("}", inicio));
    expect(corpo).toMatch(/font-size:\s*var\(--text-key-figure\)/);
  });
});
