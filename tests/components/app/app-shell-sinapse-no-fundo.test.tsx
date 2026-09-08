import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/",
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { AppShell, MAIN_CONTENT_ID } from "@/components/app/AppShell";
import { ThemeProvider } from "@/lib/theme";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * Dono (2026-09-08): "o mesmo efeito da tela de login, quero no fundo da
 * aplicação como um todo" — e, no mesmo dia, a cobrança: *"ainda não vejo a
 * rede de sinapses no fundo da aplicação; quero ver no fundo de todas as
 * telas"*. A primeira tentativa punha o `<main>` INTEIRO como zona de
 * exclusão (visibilidade 0), e o `<main>` é a tela toda: sobrava a moldura, e
 * a moldura é opaca. Não havia nada para ver.
 *
 * Agora a rede corre a VIEWPORT INTEIRA, atrás do conteúdo (`z-0`, o
 * conteúdo em `z-10`): os cartões têm fundo opaco, então ela aparece nos vãos
 * e nas áreas vazias, sem atrapalhar a leitura. Com movimento reduzido, é um
 * quadro parado e nenhum pulso anima.
 */
const fetchMock = vi.fn();

const RETANGULOS: Record<string, DOMRect> = {
  CANVAS: new DOMRect(0, 0, 1440, 900),
  MAIN: new DOMRect(280, 74, 1000, 826),
};

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

function relogioFalso() {
  const request = vi.fn<(callback: FrameRequestCallback) => number>().mockReturnValue(42);
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return request;
}

/** O jsdom não mede: o canvas e o `<main>` ganham retângulos, e o pincel anota onde desenhou cada nó. */
function palcoMedido() {
  const arcos: { x: number; y: number; alpha: number }[] = [];
  const contexto = {
    globalAlpha: 1,
    setTransform: () => undefined,
    clearRect: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    fill: () => undefined,
    arc(px: number, py: number) {
      arcos.push({ x: px, y: py, alpha: this.globalAlpha });
    },
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    contexto as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.tagName === "CANVAS") return RETANGULOS["CANVAS"]!;
    if (this.id === MAIN_CONTENT_ID) return RETANGULOS["MAIN"]!;
    return new DOMRect(0, 0, 0, 0);
  });
  return arcos;
}

const renderShell = () =>
  renderWithApp(
    <ThemeProvider>
      <AppShell>
        <div>conteúdo</div>
      </AppShell>
    </ThemeProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("synapse:locale", "pt");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AppShell — a rede de sinapses no fundo da aplicação", () => {
  it("desenha a rede UMA vez, decorativa, na composição interior, e liga o relógio", async () => {
    comMovimento(false);
    const request = relogioFalso();
    renderShell();
    await screen.findByText("conteúdo");
    const redes = screen.getAllByTestId("synapse-network");
    expect(redes).toHaveLength(1);
    expect(redes[0]!.getAttribute("aria-hidden")).toBe("true");
    expect(redes[0]!.getAttribute("data-scene")).toBe("interior");
    expect(redes[0]!.getAttribute("data-motion")).toBe("live");
    expect(request).toHaveBeenCalled();
  });

  it("há nós VISÍVEIS pintados dentro da área do conteúdo, não só nas bordas", async () => {
    comMovimento(true);
    const arcos = palcoMedido();
    renderShell();
    await screen.findByText("conteúdo");
    const main = RETANGULOS["MAIN"]!;
    const visiveis = arcos.filter((arco) => arco.alpha > 0.01);
    expect(visiveis.length).toBeGreaterThan(0);
    const atrasDoConteudo = visiveis.filter(
      (arco) =>
        arco.x >= main.x &&
        arco.x <= main.x + main.width &&
        arco.y >= main.y &&
        arco.y <= main.y + main.height,
    );
    // A área do conteúdo é ~64% da viewport medida: uma rede uniforme põe boa
    // parte dos nós ali. "Discreta" é opacidade, não ausência.
    expect(atrasDoConteudo.length).toBeGreaterThan(visiveis.length * 0.25);
  });

  it("os nós dentro do conteúdo são discretos, mas nenhum é apagado por exclusão", async () => {
    comMovimento(true);
    const arcos = palcoMedido();
    renderShell();
    await screen.findByText("conteúdo");
    const main = RETANGULOS["MAIN"]!;
    const dentro = arcos.filter(
      (arco) =>
        arco.x >= main.x &&
        arco.x <= main.x + main.width &&
        arco.y >= main.y &&
        arco.y <= main.y + main.height,
    );
    expect(dentro.length).toBeGreaterThan(0);
    for (const arco of dentro) {
      expect(arco.alpha).toBeGreaterThan(0);
      // Fundo é fundo: nenhum nó chega perto de competir com o texto.
      expect(arco.alpha).toBeLessThan(0.9);
    }
  });

  it("com movimento reduzido, a rede é um quadro parado: nenhum relógio, nenhum pulso", async () => {
    comMovimento(true);
    const request = relogioFalso();
    renderShell();
    await screen.findByText("conteúdo");
    expect(screen.getByTestId("synapse-network").getAttribute("data-motion")).toBe("still");
    expect(request).not.toHaveBeenCalled();
  });
});
