import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesmo motivo dos outros testes do shell: `<Link>`/`useRouterState` exigem
 * `RouterProvider` real. Aqui a âncora PRESERVA o `to` como `href` — sem
 * `href` ela não entra na sequência de tabulação do jsdom, e a prova de
 * "nenhum item some da ordem de foco" mediria o mock, não o menu.
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
 * Dono (2026-09-08): *"não estou mais vendo utilidade no botão de esconder/
 * mostrar menus na coluna lateral. Remova. Vamos continuar separando por
 * grupos (Gestão, Inteligência de Talentos etc.), mas agora sem a setinha."*
 *
 * O grupo continua sendo um SEPARADOR VISUAL — o cabeçalho fica, o colapso
 * morre. Este arquivo substitui `nav-collapsible-groups.test.tsx` e
 * `nav-collapsed-focus.test.tsx`, que provavam o comportamento removido.
 *
 * Atenção ao que NÃO é alvo: o botão que recolhe a COLUNA inteira, no topo,
 * continua existindo (`app-shell-sidebar-toggle.test.tsx`).
 */
const fetchMock = vi.fn();
const CHAVE_MORTA = "synapse:nav-collapsed-groups";

const GRUPOS = ["Gestão", "Inteligência de Talentos", "Crescimento", "Administração"] as const;

describe("AppShell — grupos do menu sem setinha de colapso", () => {
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

  it("o cabeçalho do grupo é rótulo, não gatilho: nenhum botão e nenhum aria-expanded", async () => {
    renderShell();

    await screen.findByRole("link", { name: "Painel Executivo" });
    for (const grupo of GRUPOS) {
      expect(screen.queryByRole("button", { name: grupo })).toBeNull();
      expect(screen.getAllByText(grupo).length).toBeGreaterThan(0);
    }
    // O botão que recolhe a COLUNA inteira fica, e ele é `aria-expanded`;
    // o que não pode existir é gatilho de colapso DENTRO da navegação.
    for (const nav of document.querySelectorAll("nav")) {
      expect(nav.querySelectorAll("[aria-expanded]").length).toBe(0);
    }
  });

  it("todo item do grupo fica na ordem de tabulação: de 'Painel Executivo' vai direto ao irmão", async () => {
    renderShell();
    const user = userEvent.setup();

    const painel = await screen.findByRole("link", { name: "Painel Executivo" });
    painel.focus();
    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Talentos do Time" }));
  });

  it("a memória de grupos recolhidos morreu: valor antigo no navegador não esconde nada", async () => {
    window.localStorage.setItem(CHAVE_MORTA, JSON.stringify(["nav.group.admin"]));
    renderShell();

    await screen.findByRole("link", { name: "Painel Executivo" });
    expect(screen.getAllByText("Administração").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Contas e Acessos" })).toBeTruthy();
    // Nada é reescrito: a chave é lixo herdado, não preferência viva.
    expect(window.localStorage.getItem(CHAVE_MORTA)).toBe(JSON.stringify(["nav.group.admin"]));
  });

  it("a ordem declarada em NAV_GROUPS continua sendo a ordem na tela", async () => {
    routerState.pathname = "/team";
    renderShell();

    await screen.findByRole("link", { name: "Talentos do Time" });
    const rotulos = ["Painel Executivo", "Talentos do Time", "Avaliação de Desempenho"];
    const posicoes = rotulos.map((rotulo) =>
      [...document.querySelectorAll("[data-nav-label]")].findIndex(
        (el) => el.textContent === rotulo,
      ),
    );
    expect(posicoes).toEqual([...posicoes].sort((esquerda, direita) => esquerda - direita));
    expect(posicoes.every((posicao) => posicao >= 0)).toBe(true);
  });

  it("mesma régua na gaveta móvel", async () => {
    renderShell();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Abrir menu de navegação" }));
    const gaveta = await screen.findByRole("dialog");

    expect(within(gaveta).queryByRole("button", { name: "Crescimento" })).toBeNull();
    expect(within(gaveta).getByText("Crescimento")).toBeTruthy();
    expect(within(gaveta).getByRole("link", { name: "Mentoria e 1:1" })).toBeTruthy();
  });
});
