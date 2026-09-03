import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CapabilityRadarFigure } from "@/components/app/charts-recharts";

/**
 * Pedido do dono (2026-09-03): *"eles devem quebrar por palavras, mas quero
 * que apareça todo o texto. hoje Clean e Core parecem ser duas coisas
 * diferentes."* Este teste mede no SVG que o recharts emite: um eixo, um
 * `<text>`, o nome INTEIRO dentro dele — e a quebra em `<tspan>` por palavra
 * quando o nome é longo. Contra o código antigo (`tick={axisTick}`, uma
 * linha só, alimentado pelo `short` de uma palavra) ele nasceu vermelho.
 */
class SizedResizeObserver {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    const contentRect = {
      width: 500,
      height: 500,
      top: 0,
      left: 0,
      bottom: 500,
      right: 500,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
    this.callback(
      [{ target, contentRect } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}

const originalResizeObserver = globalThis.ResizeObserver;

describe("radar — o eixo mostra o nome inteiro da capacidade", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = SizedResizeObserver as unknown as typeof ResizeObserver;
  });
  afterEach(() => {
    cleanup();
    globalThis.ResizeObserver = originalResizeObserver;
  });

  /** O texto de um rótulo: as linhas (`tspan`) juntas por espaço, como se lê na tela. */
  const rotulosDe = (container: HTMLElement) =>
    [...container.querySelectorAll("text")].map((elemento) => {
      const linhas = [...elemento.querySelectorAll("tspan")].map(
        (linha) => linha.textContent ?? "",
      );
      return linhas.length > 0 ? linhas.join(" ") : (elemento.textContent ?? "");
    });

  const dados = [
    { capability: "Clean Core", atual: 3, alvo: 4 },
    { capability: "Engenharia de Plataforma", atual: 2, alvo: 4 },
    { capability: "Arquitetura Corporativa", atual: 4, alvo: 5 },
  ];

  it("nome curto ocupa um rótulo só, com o texto completo", () => {
    const { container } = render(
      <CapabilityRadarFigure data={dados} currentLabel="Atual" targetLabel="Esperado" />,
    );
    expect(rotulosDe(container)).toContain("Clean Core");
  });

  it("nome longo quebra em tspans, e nenhum texto se perde", () => {
    const { container } = render(
      <CapabilityRadarFigure data={dados} currentLabel="Atual" targetLabel="Esperado" />,
    );
    const longo = [...container.querySelectorAll("text")].find(
      (elemento) =>
        [...elemento.querySelectorAll("tspan")]
          .map((linha) => linha.textContent ?? "")
          .join(" ") === "Engenharia de Plataforma",
    );
    expect(longo).toBeTruthy();
    const linhas = [...(longo?.querySelectorAll("tspan") ?? [])].map((linha) => linha.textContent);
    expect(linhas.length).toBeGreaterThan(1);
    expect(linhas.join(" ")).toBe("Engenharia de Plataforma");
    for (const linha of linhas) expect(linha).not.toMatch(/…$/);
  });

  it("cada capacidade é UM eixo — três nomes, três rótulos", () => {
    const { container } = render(
      <CapabilityRadarFigure data={dados} currentLabel="Atual" targetLabel="Esperado" />,
    );
    const nomes = new Set(rotulosDe(container));
    for (const { capability } of dados) expect(nomes.has(capability)).toBe(true);
  });
});
