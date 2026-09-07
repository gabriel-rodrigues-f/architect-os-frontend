import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthScreenShell } from "@/components/app/AuthScreenShell";
import { BrandLockup } from "@/components/app/BrandLockup";
import { I18nProvider } from "@/lib/i18n";
import { SynapseSignals } from "@/lib/synapse-network";
import { Bloco, folhaDeEstilo } from "../../helpers/folha-de-estilo";

/**
 * A MARCA NÃO PISCA MAIS — pedido literal do dono (2026-09-08): "na tela de
 * login, vamos remover a animação das letras; mantenha apenas na rede de
 * sinapses".
 *
 * O que este arquivo prende é a ausência, e por isso ela é afirmada em três
 * camadas — sem as três, a piscada volta pela porta que a outra deixou
 * aberta: a MARCAÇÃO não tem caixa por letra nem atributo de pulso; o
 * COMPONENTE não assina o canal do pulso coletivo (é o que fazia a marca
 * saber que a rede pulsou); e a FOLHA DE ESTILO não guarda os quadros nem as
 * variáveis de luz que a animavam.
 *
 * O que continua: o lockup alinhado pelo `LockupFit` — as duas linhas com as
 * extremidades coincidindo — e a rede pulsando com a cor do resultado.
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

function PortaWrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>{children}</I18nProvider>
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BrandLockup — as duas linhas, em texto inteiro", () => {
  it("cada linha é UM texto legível: nenhuma caixa por letra sobrou", () => {
    comMovimento(false);
    render(<BrandLockup descriptor={DESCRIPTOR} />);
    const wordmark = screen.getByTestId("brand-wordmark");
    const descriptor = screen.getByTestId("brand-descriptor");
    expect(wordmark.textContent).toBe("Synapse");
    expect(descriptor.textContent).toBe(DESCRIPTOR);
    expect(wordmark.querySelectorAll("[data-letter]")).toHaveLength(0);
    expect(descriptor.querySelectorAll("[data-letter]")).toHaveLength(0);
    expect(document.querySelectorAll(".auth-letter")).toHaveLength(0);
    // Sem letra escondida do leitor de tela, o texto deixa de precisar do par `sr-only`/`aria-hidden`.
    expect(wordmark.querySelector(".sr-only")).toBeNull();
    expect(wordmark.querySelector("[aria-hidden='true']")).toBeNull();
  });

  it("o wordmark é maior e tem tracking próprio; o descriptor tem peso médio e cor a 60–70%", () => {
    comMovimento(false);
    render(<BrandLockup descriptor={DESCRIPTOR} />);
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

describe("a marca não assina o pulso da rede", () => {
  it("a tela de porta inteira monta sem ninguém se inscrever no pulso coletivo", () => {
    comMovimento(false);
    const assina = vi.spyOn(SynapseSignals.prototype, "onCollectivePulse");
    const signals = new SynapseSignals();
    render(
      <PortaWrapper>
        <AuthScreenShell signals={signals}>
          <p>cartão</p>
        </AuthScreenShell>
      </PortaWrapper>,
    );
    expect(screen.getByTestId("brand-lockup")).toBeTruthy();
    expect(assina).not.toHaveBeenCalled();
    assina.mockRestore();
  });

  it("um pulso anunciado não muda nada na marca — nem atributo, nem tom", () => {
    comMovimento(false);
    const signals = new SynapseSignals();
    render(<BrandLockup descriptor={DESCRIPTOR} />);
    const lockup = screen.getByTestId("brand-lockup");
    const antes = lockup.outerHTML;
    act(() => signals.announceCollectivePulse({ startedAt: 0, durationMs: 1200, tone: "danger" }));
    act(() => signals.announceCollectivePulse({ startedAt: 0, durationMs: 1200, tone: "primary" }));
    expect(lockup.outerHTML).toBe(antes);
    expect(lockup.hasAttribute("data-pulsing")).toBe(false);
    expect(lockup.hasAttribute("data-pulse-tone")).toBe(false);
  });
});

describe("a folha de estilo não guarda a piscada", () => {
  it("os quadros, a utility da letra e as variáveis de luz saíram do CSS", () => {
    for (const morto of [
      "auth-letter",
      "auth-letter-pulse",
      "data-pulsing",
      "data-pulse-tone",
      "--letter-lit",
      "--letter-glow",
    ]) {
      expect(folhaDeEstilo.includes(morto), morto).toBe(false);
    }
  });
});
