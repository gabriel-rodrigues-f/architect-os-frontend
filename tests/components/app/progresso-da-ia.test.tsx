import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiProgress } from "@/components/app/ai-shared";
import { I18nProvider } from "@/lib/i18n";

const renderProgress = () =>
  render(
    <I18nProvider>
      <AiProgress />
    </I18nProvider>,
  );

/**
 * Dono, 2026-09-05: enquanto a IA processa, "uma mensagem agradável e uma
 * barra de progresso de 0 a 100%" — em TODO assistente. O servidor não manda
 * progresso; a barra segue o relógio e a frase muda com ele.
 */
describe("AiProgress — o que se vê enquanto a IA escreve", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("começa lendo, passa a escrever e a barra sobe sem chegar a 100", () => {
    vi.useFakeTimers();
    renderProgress();
    expect(screen.getByText("Lendo o que o sistema já sabe sobre a situação…")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(
      screen.getByText("Escrevendo a sugestão com calma — leva alguns segundos."),
    ).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    const value = Number(bar.getAttribute("aria-valuenow"));
    expect(value).toBeGreaterThan(20);
    expect(value).toBeLessThan(100);
  });

  it("fala com quem ouve a tela: aria-busy e aria-live", () => {
    renderProgress();
    const region = screen.getByTestId("ai-progress");
    expect(region.getAttribute("aria-busy")).toBe("true");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });
});
