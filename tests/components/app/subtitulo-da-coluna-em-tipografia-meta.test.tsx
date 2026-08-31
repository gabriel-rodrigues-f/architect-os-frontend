import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesmo motivo dos outros testes de shell: `<Link>` e `useRouterState` exigem
 * `RouterProvider` real, e aqui nada se afirma sobre navegação.
 */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => "/",
    Link: ({
      children,
      to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { AppShell } from "@/components/app/AppShell";
import { fontSize } from "@/lib/design/scale";
import { ThemeProvider } from "@/lib/theme";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * O cabeçalho novo da coluna passou a montar as classes do subtítulo por
 * `cn()`, e o `tailwind-merge` não conhece os degraus de tipografia do tema:
 * ele lê `text-meta` como COR de texto, entra em conflito com o
 * `text-sidebar-foreground/60` que vem depois e descarta o tamanho. O
 * subtítulo saltou de 11px para o padrão do navegador em toda tela e todo
 * papel — regressão contra a main, onde as mesmas classes eram string literal
 * e o merge nunca as via.
 *
 * O teste não pina a FORMA da classe (o tema pode ser declarado como degrau,
 * como token ou em pixels): pina o que a tela mostra — exatamente um tamanho
 * de fonte declarado, e ele é o `meta` da escala. A segunda afirmação existe
 * porque o conserto errado é trocar a ordem das classes: aí o tamanho
 * sobrevive e quem some é a cor.
 */
const fetchMock = vi.fn();

const COLUNA_RECOLHIDA = "synapse:sidebar-collapsed";

const SUBTITULO = "Desenvolvimento de Capacidades";

const COR_DO_SUBTITULO = "text-sidebar-foreground/60";

const TAMANHOS_DO_TEMA = new Map<string, number>(fontSize.entries());

function pixelsDeclarados(classe: string): number | undefined {
  const porDegrau = /^text-([a-z]+)$/.exec(classe);
  if (porDegrau) {
    const px = TAMANHOS_DO_TEMA.get(porDegrau[1] ?? "");
    if (px !== undefined) return px;
  }

  const porToken = /^(?:text-\[length:|\[font-size:)var\(--text-([a-z]+)\)\]$/.exec(classe);
  if (porToken) return TAMANHOS_DO_TEMA.get(porToken[1] ?? "");

  const emPixels = /^(?:text-\[|\[font-size:)(\d+)px\]$/.exec(classe);
  if (emPixels) return Number(emPixels[1]);

  return undefined;
}

function colunaLateral(): HTMLElement {
  const aside = document.querySelector("aside");
  if (!aside) throw new Error("a coluna lateral não montou");
  return aside;
}

function subtituloDaColuna(): HTMLElement {
  const encontrados = screen
    .getAllByText(SUBTITULO)
    .filter((elemento) => colunaLateral().contains(elemento));
  expect(encontrados).toHaveLength(1);
  return encontrados[0]!;
}

function tamanhosDeclarados(elemento: HTMLElement): number[] {
  return elemento.className
    .split(/\s+/)
    .map(pixelsDeclarados)
    .filter((px): px is number => px !== undefined);
}

const renderShell = () =>
  renderWithApp(
    <ThemeProvider>
      <AppShell>
        <div>conteúdo</div>
      </AppShell>
    </ThemeProvider>,
  );

describe("subtítulo da coluna lateral — tipografia meta, e a cor junto", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("com a coluna aberta o subtítulo declara um tamanho só, o meta da escala", async () => {
    renderShell();
    await screen.findByRole("link", { name: "Painel" });

    expect(tamanhosDeclarados(subtituloDaColuna())).toEqual([fontSize.get("meta")]);
  });

  it("o tamanho não é conquistado à custa da cor — as duas classes sobrevivem juntas", async () => {
    renderShell();
    await screen.findByRole("link", { name: "Painel" });

    const classes = subtituloDaColuna().className.split(/\s+/);

    expect(classes).toContain(COR_DO_SUBTITULO);
    expect(tamanhosDeclarados(subtituloDaColuna())).toEqual([fontSize.get("meta")]);
  });

  it("recolher a coluna não muda o tamanho do subtítulo, só a opacidade", async () => {
    window.localStorage.setItem(COLUNA_RECOLHIDA, "true");
    renderShell();
    await screen.findByRole("link", { name: "Painel" });

    const subtitulo = subtituloDaColuna();

    expect(tamanhosDeclarados(subtitulo)).toEqual([fontSize.get("meta")]);
    expect(subtitulo.className.split(/\s+/)).toContain("opacity-0");
  });
});
