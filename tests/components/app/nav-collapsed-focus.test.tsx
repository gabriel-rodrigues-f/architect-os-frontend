import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * QA-04 (onda 5) — mesmo motivo de nav-collapsible-groups.test.tsx: `<Link>` e
 * `useRouterState` exigem `RouterProvider` real.
 *
 * Diferença deliberada em relação aos outros arquivos: aqui o `<Link>` mockado
 * PRESERVA o `to` como `href`. Sem `href` a âncora não entra na sequência de
 * tabulação do jsdom, e um teste de ordem de foco em cima dela não provaria
 * nada — mediria o mock, não a navegação real.
 */
const routerState = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => routerState.pathname,
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
 * QA-04 — defeito real de acessibilidade no menu colapsável (R2-UX-14).
 *
 * Recolher um grupo do menu só encolhe a linha de grade de cada item
 * (`gridTemplateRows: 0fr` + `overflow-hidden`): visualmente o item some, mas
 * o link continua montado e continua na sequência de tabulação. Quem navega
 * por teclado sai do item visível e cai num link de altura zero, invisível,
 * sem nenhuma pista de onde o foco está — WCAG 2.4.3 (ordem de foco) e 2.4.7
 * (foco visível). Recolher um grupo passa a ser uma armadilha de foco silenciosa
 * exatamente para quem mais depende da ordem de tabulação.
 *
 * Este teste percorre a tabulação de verdade (`user.tab()`), sem olhar atributo
 * nenhum: com o grupo "Operação" recolhido, sair de "Painel" (item ativo, único
 * que continua visível) tem que ir para o cabeçalho do PRÓXIMO grupo, nunca para
 * "Time"/"Avaliações", que estão invisíveis.
 *
 * O par de mouse mora em "mouse continua funcionando" abaixo — a correção de
 * teclado de 22/08 nesta base quebrou o mouse nos filtros com a suíte verde, e
 * o defeito só apareceu 6 dias depois.
 */
const fetchMock = vi.fn();

describe("AppShell — item de grupo recolhido sai da ordem de tabulação (QA-04)", () => {
  beforeEach(() => {
    routerState.pathname = "/";
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

  const renderShell = () =>
    renderWithApp(
      <ThemeProvider>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </ThemeProvider>,
    );

  /** O menu lateral (desktop) e o drawer mobile renderiam o mesmo rótulo; o drawer só monta quando aberto. */
  const navLink = (name: string) => screen.getByRole("link", { name });

  it("com o grupo recolhido, tabular a partir do item ativo pula os itens invisíveis", async () => {
    renderShell();
    const user = userEvent.setup();

    const operacao = await screen.findByRole("button", { name: "Operação" });
    /**
     * Referências capturadas ANTES de recolher: recolher não desmonta os nós
     * (a animação de altura depende de eles continuarem montados), então os
     * mesmos elementos seguem no DOM — é exatamente por isso que o foco caía
     * neles. Guardar o nó permite afirmar sobre ele sem depender de uma
     * consulta por papel, que a própria correção passa a não encontrar.
     */
    const time = navLink("Time");
    const avaliacoes = navLink("Avaliações");

    await user.click(operacao);
    expect(operacao.getAttribute("aria-expanded")).toBe("false");

    // "Painel" é a rota ativa: continua visível mesmo com o grupo recolhido.
    navLink("Painel").focus();
    await user.tab();

    expect(document.activeElement).not.toBe(time);
    expect(document.activeElement).not.toBe(avaliacoes);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Capacidades" }));
  });

  it("expandir o grupo de volta devolve os itens à ordem de tabulação", async () => {
    renderShell();
    const user = userEvent.setup();

    const operacao = await screen.findByRole("button", { name: "Operação" });
    await user.click(operacao);
    await user.click(operacao);
    expect(operacao.getAttribute("aria-expanded")).toBe("true");

    navLink("Painel").focus();
    await user.tab();

    expect(document.activeElement).toBe(navLink("Time"));
  });

  it("mouse continua funcionando: item visível de grupo recolhido segue clicável", async () => {
    renderShell();
    const user = userEvent.setup();

    const operacao = await screen.findByRole("button", { name: "Operação" });
    await user.click(operacao);

    const cliques: string[] = [];
    const painel = navLink("Painel");
    painel.addEventListener("click", (evento) => {
      evento.preventDefault();
      cliques.push("painel");
    });

    await user.click(painel);
    expect(cliques).toEqual(["painel"]);
  });

  it("mouse continua funcionando: reexpandir devolve o clique aos itens que estavam recolhidos", async () => {
    renderShell();
    const user = userEvent.setup();

    const operacao = await screen.findByRole("button", { name: "Operação" });
    await user.click(operacao);
    await user.click(operacao);

    const cliques: string[] = [];
    const time = navLink("Time");
    time.addEventListener("click", (evento) => {
      evento.preventDefault();
      cliques.push("time");
    });

    await user.click(time);
    expect(cliques).toEqual(["time"]);
  });
});
