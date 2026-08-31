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
import { ThemeProvider } from "@/lib/theme";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * V6, pedido REPETIDO do dono (2026-08-30): "algo que eu já pedi no passado" —
 * ao esconder a coluna de menus, o nome "Synapse" deve aparecer ABAIXO do
 * ícone de esconder, transitando do tamanho grande para o pequeno enquanto a
 * coluna encolhe. E a frase que define o teste: NÃO é aparecer/sumir, é
 * TRANSIÇÃO.
 *
 * O defeito de hoje: o nome mora dentro do bloco que a coluna recolhida zera
 * (`w-0 opacity-0`), então recolher faz a marca DESAPARECER. Por isso as duas
 * afirmações abaixo são de natureza diferente e as duas importam:
 *   1. o nome continua VISÍVEL com a coluna recolhida — nenhum ancestral dele
 *      dentro da coluna zera largura ou opacidade;
 *   2. é o MESMO nó nos dois estados, com classe de transição nos dois e
 *      tamanho diferente entre eles — que é o que separa "transitar" de
 *      "trocar um elemento por outro".
 */
const fetchMock = vi.fn();

const COLUNA_RECOLHIDA = "synapse:sidebar-collapsed";

const ZERAM_O_QUE_ENVOLVEM = ["w-0", "opacity-0"];

function colunaLateral(): HTMLElement {
  const aside = document.querySelector("aside");
  if (!aside) throw new Error("a coluna lateral não montou");
  return aside;
}

function nomeDaMarca(): HTMLElement {
  const encontrados = screen
    .getAllByText("Synapse")
    .filter((elemento) => colunaLateral().contains(elemento));
  expect(encontrados).toHaveLength(1);
  return encontrados[0]!;
}

function classesAteAColuna(elemento: HTMLElement): string[] {
  const classes: string[] = [];
  let atual: HTMLElement | null = elemento;
  while (atual && atual !== colunaLateral()) {
    classes.push(...atual.className.split(/\s+/));
    atual = atual.parentElement;
  }
  return classes;
}

const renderShell = () =>
  renderWithApp(
    <ThemeProvider>
      <AppShell>
        <div>conteúdo</div>
      </AppShell>
    </ThemeProvider>,
  );

describe("marca na coluna recolhida — transição, nunca aparecer/sumir", () => {
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

  it("com a coluna recolhida o nome continua visível — nada no caminho dele zera largura ou opacidade", async () => {
    window.localStorage.setItem(COLUNA_RECOLHIDA, "true");
    renderShell();
    await screen.findByRole("link", { name: "Painel" });

    const caminho = classesAteAColuna(nomeDaMarca());

    for (const classe of ZERAM_O_QUE_ENVOLVEM) {
      expect(caminho, classe).not.toContain(classe);
    }
  });

  it("o nome muda de tamanho entre os dois estados, e a mudança é transicionada nos dois", async () => {
    renderShell();
    await screen.findByRole("link", { name: "Painel" });
    const aberta = nomeDaMarca().className;

    cleanup();
    window.localStorage.setItem(COLUNA_RECOLHIDA, "true");
    renderShell();
    await screen.findByRole("link", { name: "Painel" });
    const recolhida = nomeDaMarca().className;

    expect(aberta).toContain("transition");
    expect(recolhida).toContain("transition");
    expect(recolhida).not.toEqual(aberta);
  });

  it("a coluna recolhida não some com o botão de esconder — o nome fica ABAIXO dele", async () => {
    window.localStorage.setItem(COLUNA_RECOLHIDA, "true");
    renderShell();

    const botao = await screen.findByRole("button", { name: "Mostrar menu lateral" });
    const nome = nomeDaMarca();

    expect(colunaLateral().contains(botao)).toBe(true);
    expect(botao.compareDocumentPosition(nome) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
