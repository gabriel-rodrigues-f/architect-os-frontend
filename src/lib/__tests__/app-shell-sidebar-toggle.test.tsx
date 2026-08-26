import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesma razão de dashboard-roles.test.tsx: `<Link>` exige RouterProvider
 * real. `useRouterState` também é usado direto por `AppShell` (só o
 * `pathname` para destacar o item ativo) — precisa do mesmo tratamento.
 */
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

import { AppShell } from "@/components/app/AppShell";
import { ThemeProvider } from "../theme";
import { mockAppFetch, renderWithApp } from "./render-app";

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, B-41 (§41, Fase 4/5) —
 * antes, recolher a sidebar desmontava o botão `PanelLeftClose` (dentro do
 * cabeçalho) e montava um `PanelLeftOpen` NOVO num bloco abaixo — o
 * deslocamento vertical visível que o produto reportou, e o foco de
 * teclado se perdia (o nó DOM focado deixava de existir). A correção usa
 * UM botão sempre montado, só trocando ícone/rótulo. Os dois testes abaixo
 * provam exatamente essas duas garantias: o mesmo nó DOM sobrevive à
 * alternância (nada remonta) e o foco nele sobrevive também.
 */
const fetchMock = vi.fn();

/**
 * OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`).
 * O `ThemeProvider` (que o helper não inclui) entra como filho: é contexto
 * independente dos demais providers, a posição na árvore não muda nada.
 */

describe("AppShell — botão único de recolher/expandir a sidebar (B-41)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // test-setup.ts fixa pt no carregamento do arquivo (roda uma vez só);
    // limpar localStorage por teste (para o estado da sidebar não vazar de
    // um teste pro outro) também apaga essa chave — sem repor, o provider
    // cai no idioma do jsdom (en-US) e as asserções de texto quebram.
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

  it("o mesmo botão (nó DOM) sobrevive a 3 alternâncias — nunca desmonta/remonta", async () => {
    renderShell();
    const user = userEvent.setup();

    const initial = await screen.findByRole("button", { name: "Esconder menu lateral" });
    const node = initial;

    for (let i = 0; i < 3; i++) {
      await user.click(node);
      // Mesmo elemento, só o aria-label/rótulo muda — nunca some da árvore.
      expect(document.body.contains(node)).toBe(true);
    }

    // Depois de 3 cliques (ímpar), terminou recolhida — rótulo de "mostrar".
    expect(node.getAttribute("aria-label")).toBe("Mostrar menu lateral");
    expect(node.getAttribute("aria-expanded")).toBe("false");
  });

  it("o foco no botão sobrevive à alternância — nunca cai para o body", async () => {
    renderShell();
    const user = userEvent.setup();

    const toggle = await screen.findByRole("button", { name: "Esconder menu lateral" });
    toggle.focus();
    expect(document.activeElement).toBe(toggle);

    await user.keyboard("{Enter}");

    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute("aria-label")).toBe("Mostrar menu lateral");
  });
});
