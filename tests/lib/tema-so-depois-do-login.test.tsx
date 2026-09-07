import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DarkStage } from "@/components/app/DarkStage";
import { ThemeProvider, useTheme } from "@/lib/theme";

/**
 * Dono (2026-09-08): "a tela inicial do Synapse é sempre escura… quando eu
 * mudava para o tema branco e deslogava, a tela inicial ficava branca. Nossa
 * tela de login é sempre a escura. O tema só é aplicado depois de realizado o
 * login."
 */
function Botao() {
  const { setTheme, resolved } = useTheme();
  return (
    <button type="button" onClick={() => setTheme("light")}>
      claro ({resolved})
    </button>
  );
}

describe("o palco escuro sem provedor de tema", () => {
  it("não lança nem toca no documento", () => {
    render(
      <DarkStage>
        <span>ok</span>
      </DarkStage>,
    );
    expect(screen.getByText("ok")).toBeTruthy();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("o palco escuro segura o tema enquanto está montado", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:theme", "light");
    document.documentElement.classList.remove("dark");
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("com preferência clara salva, o palco escuro força `dark` no <html>", () => {
    render(
      <ThemeProvider>
        <DarkStage>
          <Botao />
        </DarkStage>
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button").textContent).toContain("dark");
  });

  it("trocar a preferência durante o palco não clareia a tela; ao sair do palco, a preferência vale", () => {
    const { rerender } = render(
      <ThemeProvider>
        <DarkStage>
          <Botao />
        </DarkStage>
      </ThemeProvider>,
    );
    act(() => screen.getByRole("button").click());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    rerender(
      <ThemeProvider>
        <Botao />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getByRole("button").textContent).toContain("light");
  });
});
