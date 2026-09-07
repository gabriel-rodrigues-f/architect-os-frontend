import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrandLockup } from "@/components/app/BrandLockup";
import { LetterCascade } from "@/lib/brand-lockup";
import { SynapseSignals } from "@/lib/synapse-network";
import { Bloco, folhaDeEstilo } from "../../helpers/folha-de-estilo";

/**
 * A marca pisca com a rede (dono, 2026-09-07): as letras de "Synapse" e do
 * descriptor piscam da esquerda para a direita, cada linha no seu passo, as
 * duas começando e terminando juntas — e SÓ quando a rede pulsa em coletivo.
 * Com movimento reduzido, nada.
 */
const DESCRIPTOR = "Desenvolvimento de Capacidades";

function comMovimento(reduzido: boolean) {
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

function abrir(signals = new SynapseSignals()) {
  render(<BrandLockup signals={signals} descriptor={DESCRIPTOR} />);
  return signals;
}

function letrasDe(linha: HTMLElement): HTMLElement[] {
  return [...linha.querySelectorAll<HTMLElement>("[data-letter]")];
}

function ms(valor: string): number {
  return Number(valor.replace("ms", ""));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("BrandLockup — as duas linhas, letra a letra, acessíveis por inteiro", () => {
  it("o texto inteiro continua legível ao leitor de tela; as letras soltas ficam fora da árvore acessível", () => {
    comMovimento(false);
    abrir();
    const wordmark = screen.getByTestId("brand-wordmark");
    const descriptor = screen.getByTestId("brand-descriptor");
    expect(wordmark.querySelector(".sr-only")?.textContent).toBe("Synapse");
    expect(descriptor.querySelector(".sr-only")?.textContent).toBe(DESCRIPTOR);
    expect(letrasDe(wordmark)).toHaveLength(7);
    expect(letrasDe(descriptor)).toHaveLength(DESCRIPTOR.length);
    for (const letra of [...letrasDe(wordmark), ...letrasDe(descriptor)]) {
      expect(letra.closest("[aria-hidden='true']")).not.toBeNull();
    }
  });

  it("o wordmark é maior e tem tracking próprio; o descriptor tem peso médio e cor a 60–70%", () => {
    comMovimento(false);
    abrir();
    expect(screen.getByTestId("brand-wordmark").classList.contains("auth-wordmark")).toBe(true);
    expect(screen.getByTestId("brand-descriptor").classList.contains("auth-descriptor")).toBe(true);
    const wordmark = Bloco.de("@utility auth-wordmark");
    expect(wordmark.existe).toBe(true);
    expect(wordmark.contem("letter-spacing: var(--lockup-tracking")).toBe(true);
    expect(wordmark.contem("scale")).toBe(false);
    const descriptor = Bloco.de("@utility auth-descriptor");
    expect(descriptor.existe).toBe(true);
    expect(descriptor.declara("font-weight", "500")).toBe(true);
    const cor = descriptor.valorDe("color") ?? "";
    const mistura = /var\(--color-foreground\)\s+(\d+)%/.exec(cor);
    expect(mistura).not.toBeNull();
    expect(Number(mistura![1])).toBeGreaterThanOrEqual(60);
    expect(Number(mistura![1])).toBeLessThanOrEqual(70);
  });
});

describe("BrandLockup — a piscada acompanha o pulso coletivo", () => {
  it("fora do pulso, nada pisca", () => {
    comMovimento(false);
    abrir();
    expect(screen.getByTestId("brand-lockup").hasAttribute("data-pulsing")).toBe(false);
  });

  it("o evento coletivo liga `data-pulsing` pela duração do pulso, e depois limpa", () => {
    vi.useFakeTimers();
    comMovimento(false);
    const signals = abrir();
    act(() => signals.announceCollectivePulse({ startedAt: 0, durationMs: 1200 }));
    const lockup = screen.getByTestId("brand-lockup");
    expect(lockup.getAttribute("data-pulsing")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(lockup.getAttribute("data-pulsing")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(lockup.hasAttribute("data-pulsing")).toBe(false);
  });

  it("as letras têm atraso proporcional ao índice e a mesma duração; as duas linhas começam e terminam juntas", () => {
    vi.useFakeTimers();
    comMovimento(false);
    const signals = abrir();
    const duracao = 1200;
    act(() => signals.announceCollectivePulse({ startedAt: 0, durationMs: duracao }));
    const wordmark = letrasDe(screen.getByTestId("brand-wordmark"));
    const descriptor = letrasDe(screen.getByTestId("brand-descriptor"));
    const curta = new LetterCascade(duracao, wordmark.length);
    const longa = new LetterCascade(duracao, descriptor.length);

    for (const [indice, letra] of wordmark.entries()) {
      expect(ms(letra.style.animationDelay)).toBeCloseTo(curta.delayOf(indice), 3);
      expect(ms(letra.style.animationDuration)).toBeCloseTo(curta.letterMs, 3);
    }
    for (const [indice, letra] of descriptor.entries()) {
      expect(ms(letra.style.animationDelay)).toBeCloseTo(longa.delayOf(indice), 3);
    }
    const fim = (letras: HTMLElement[]) =>
      ms(letras.at(-1)!.style.animationDelay) + ms(letras.at(-1)!.style.animationDuration);
    expect(ms(wordmark[0]!.style.animationDelay)).toBe(0);
    expect(ms(descriptor[0]!.style.animationDelay)).toBe(0);
    expect(fim(wordmark)).toBeCloseTo(duracao, 3);
    expect(fim(descriptor)).toBeCloseTo(duracao, 3);
    // Passos diferentes: a linha curta anda mais por letra.
    expect(ms(wordmark[1]!.style.animationDelay)).toBeGreaterThan(
      ms(descriptor[1]!.style.animationDelay),
    );
  });

  it("com movimento reduzido, o evento coletivo não liga nada", () => {
    vi.useFakeTimers();
    comMovimento(true);
    const signals = abrir();
    act(() => signals.announceCollectivePulse({ startedAt: 0, durationMs: 1200 }));
    expect(screen.getByTestId("brand-lockup").hasAttribute("data-pulsing")).toBe(false);
  });

  it("ao desmontar, cancela a inscrição — o evento seguinte não encontra ninguém", () => {
    comMovimento(false);
    const signals = new SynapseSignals();
    const { unmount } = render(<BrandLockup signals={signals} descriptor={DESCRIPTOR} />);
    unmount();
    expect(() => signals.announceCollectivePulse({ startedAt: 0, durationMs: 1200 })).not.toThrow();
  });

  it("a piscada é um ganho de luz com brilho do primário, só sob `no-preference` — nunca cor nova", () => {
    const quadros = Bloco.de("@keyframes auth-letter-pulse");
    expect(quadros.existe).toBe(true);
    expect(quadros.contem("var(--letter-lit)")).toBe(true);
    expect(quadros.contem("var(--letter-glow)")).toBe(true);
    expect(quadros.contem("#")).toBe(false);
    const guarda = Bloco.de('[data-pulsing="true"] .auth-letter');
    expect(guarda.existe).toBe(true);
    expect(guarda.contem("auth-letter-pulse")).toBe(true);
    const inicio = folhaAte('[data-pulsing="true"] .auth-letter');
    expect(inicio.lastIndexOf("prefers-reduced-motion: no-preference")).toBeGreaterThan(
      inicio.lastIndexOf("@utility auth-letter"),
    );
  });
});

/** A folha até o seletor — para provar que a regra está dentro da guarda de movimento. */
function folhaAte(seletor: string): string {
  return folhaDeEstilo.slice(0, folhaDeEstilo.indexOf(seletor));
}
