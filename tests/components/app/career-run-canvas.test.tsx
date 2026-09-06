import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CareerRunCanvas } from "@/components/app/CareerRunCanvas";

/**
 * O canvas do jogo na tela de erro (dono, 2026-09-06). O jsdom não desenha:
 * o componente precisa viver sem contexto 2D, e com movimento reduzido mostra
 * a figura parada em vez de animar.
 */
function comMovimento(reduzido: boolean) {
  // O jogo escolhe as palavras pelo navegador; o teste fala português.
  vi.stubGlobal("navigator", { ...window.navigator, languages: ["pt-BR"] });
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: reduzido && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CareerRunCanvas", () => {
  it("desenha a pista com nome acessível, convite e placar — mesmo sem contexto 2D", () => {
    comMovimento(false);
    render(<CareerRunCanvas />);
    expect(screen.getByRole("img", { name: /Corrida de carreira/ })).toBeTruthy();
    expect(screen.getByText(/Espaço, seta para cima ou toque/)).toBeTruthy();
    expect(screen.getByTestId("career-run-score").textContent).toBe("0");
    expect(screen.getByText("Júnior")).toBeTruthy();
  });

  it("com movimento reduzido, mostra a figura parada e nenhum canvas", () => {
    comMovimento(true);
    render(<CareerRunCanvas />);
    expect(screen.getByTestId("career-run-still")).toBeTruthy();
    expect(screen.getByRole("img", { name: /roteiro de carreira/ })).toBeTruthy();
    expect(document.querySelector("canvas")).toBeNull();
  });
});
