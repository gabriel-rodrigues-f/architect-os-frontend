import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RevealBlock, RevealSequence } from "@/components/app/RevealBlock";
import { DashboardEntrance } from "@/lib/dashboard-entrance";

/**
 * Referência FIAP 2026-09-06, §2 itens 4 e 8 — entrada orquestrada leve do
 * Painel na PRIMEIRA abertura após o login: cada bloco entra com fade e 8 px
 * de deslocamento, em menos de 500 ms, quando aparece na tela
 * (`IntersectionObserver` + CSS). Com `prefers-reduced-motion`, nada: o
 * bloco nasce pronto, sem atributo, sem animação. Recarregar a página não
 * repete a entrada — só o login arma o gatilho.
 */

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

type Callback = (entries: Array<{ isIntersecting: boolean }>) => void;

class ObservadorFalso {
  static callbacks: Callback[] = [];
  static observados: Element[] = [];
  static desconectados = 0;

  constructor(callback: Callback) {
    ObservadorFalso.callbacks.push(callback);
  }

  observe(element: Element) {
    ObservadorFalso.observados.push(element);
  }

  unobserve() {}

  disconnect() {
    ObservadorFalso.desconectados += 1;
  }

  static reset() {
    ObservadorFalso.callbacks = [];
    ObservadorFalso.observados = [];
    ObservadorFalso.desconectados = 0;
  }
}

function comMovimentoReduzido(reduzido: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: reduzido && query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

const bloco = () => screen.getByText("Bloco").closest<HTMLElement>("[data-reveal-block]")!;

describe("RevealBlock — o bloco entra quando aparece; com movimento reduzido, nada", () => {
  beforeEach(() => {
    ObservadorFalso.reset();
    vi.stubGlobal("IntersectionObserver", ObservadorFalso);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("fora da entrada orquestrada, o bloco nasce pronto — sem atributo de revelação", () => {
    comMovimentoReduzido(false);
    render(
      <RevealSequence enabled={false}>
        <RevealBlock order={0}>
          <p>Bloco</p>
        </RevealBlock>
      </RevealSequence>,
    );
    expect(bloco().hasAttribute("data-reveal")).toBe(false);
    expect(ObservadorFalso.observados).toEqual([]);
  });

  it("na entrada: pendente até aparecer na tela, depois revelado uma vez só, com o atraso da ordem", () => {
    comMovimentoReduzido(false);
    render(
      <RevealSequence enabled>
        <RevealBlock order={2}>
          <p>Bloco</p>
        </RevealBlock>
      </RevealSequence>,
    );
    expect(bloco().getAttribute("data-reveal")).toBe("pending");
    expect(ObservadorFalso.observados).toEqual([bloco()]);
    expect(bloco().style.getPropertyValue("--reveal-delay")).toBe("100ms");

    act(() => ObservadorFalso.callbacks[0]!([{ isIntersecting: false }]));
    expect(bloco().getAttribute("data-reveal")).toBe("pending");

    act(() => ObservadorFalso.callbacks[0]!([{ isIntersecting: true }]));
    expect(bloco().getAttribute("data-reveal")).toBe("shown");
    expect(ObservadorFalso.desconectados).toBe(1);
  });

  it("com prefers-reduced-motion, nada: sem atributo, sem observador", () => {
    comMovimentoReduzido(true);
    render(
      <RevealSequence enabled>
        <RevealBlock order={1}>
          <p>Bloco</p>
        </RevealBlock>
      </RevealSequence>,
    );
    expect(bloco().hasAttribute("data-reveal")).toBe(false);
    expect(ObservadorFalso.observados).toEqual([]);
  });

  it("sem IntersectionObserver no ambiente, o bloco não fica invisível: revela na hora", () => {
    comMovimentoReduzido(false);
    vi.stubGlobal("IntersectionObserver", undefined);
    render(
      <RevealSequence enabled>
        <RevealBlock order={0}>
          <p>Bloco</p>
        </RevealBlock>
      </RevealSequence>,
    );
    expect(bloco().getAttribute("data-reveal")).toBe("shown");
  });

  it("o CSS só anima sob no-preference, com 8 px e a duração base (< 500 ms)", () => {
    const inicio = css.indexOf('[data-reveal="shown"]');
    expect(inicio).toBeGreaterThan(-1);
    const regra = css.slice(inicio, css.indexOf("}", inicio));
    expect(regra).toMatch(/--rise-distance:\s*8px/);
    expect(regra).toMatch(/animation:.*var\(--motion-base\)/);
    expect(regra).toMatch(/animation-delay:\s*var\(--reveal-delay/);

    const guarda = css.lastIndexOf("@media (prefers-reduced-motion: no-preference)", inicio);
    expect(guarda).toBeGreaterThan(-1);
    const pendente = css.indexOf('[data-reveal="pending"]');
    expect(pendente).toBeGreaterThan(guarda);
  });
});

describe("DashboardEntrance — só a primeira abertura depois do login", () => {
  const conta = { id: "conta-1" };

  beforeEach(() => window.sessionStorage.clear());

  it("armada no login, consumida uma vez; a recarga seguinte não repete", () => {
    expect(DashboardEntrance.consume(conta)).toBe(false);
    DashboardEntrance.arm(conta);
    expect(DashboardEntrance.consume(conta)).toBe(true);
    expect(DashboardEntrance.consume(conta)).toBe(false);
  });

  it("a marca é da conta que entrou — outra conta na mesma aba não herda", () => {
    DashboardEntrance.arm(conta);
    expect(DashboardEntrance.consume({ id: "conta-2" })).toBe(false);
    expect(DashboardEntrance.consume(conta)).toBe(true);
  });
});
