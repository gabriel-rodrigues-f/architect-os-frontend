import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
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
import { AuthProvider, useAuth } from "../auth";
import { I18nProvider } from "../i18n";
import { StoreProvider } from "../store";
import { ThemeProvider } from "../theme";
import { fixtureAdminUser, fixtureState } from "./fixtures";

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

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <AuthReady>
              <StoreProvider>{children}</StoreProvider>
            </AuthReady>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AuthReady({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  if (loading) return null;
  return <>{children}</>;
}

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
    fetchMock.mockImplementation((url: string) => {
      const href = String(url);
      if (href.endsWith("/api/auth/me")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureAdminUser), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (href.endsWith("/api/state")) {
        return Promise.resolve(
          new Response(JSON.stringify(fixtureState), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const renderShell = () =>
    render(
      <Wrapper>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </Wrapper>,
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
