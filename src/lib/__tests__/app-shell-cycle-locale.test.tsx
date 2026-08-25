import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesma razão de `app-shell-sidebar-toggle.test.tsx`: `<Link>` do TanStack
 * Router exige um `RouterProvider` real; `useRouterState` também é usado
 * direto pelo `AppShell`.
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
 * R3-008 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o seletor de Ciclo (só
 * admin) e o seletor de idioma (dentro de `PreferencesMenu`) trocaram de
 * `<select>` nativo por `SingleSelectFilter`. Estes testes provam que a
 * troca de controle não mudou o comportamento: abrir, escolher uma opção,
 * ver o valor mudar — só o "chrome" visual é diferente agora.
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

describe("AppShell — seletor de Ciclo e de idioma (R3-008)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // I18nProvider decide o idioma no efeito de montagem: sem repor pt aqui,
    // o teste herdaria o idioma do jsdom (en-US) e quebraria as asserções de texto.
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

  it("mostra o ciclo ativo no gatilho e troca ao escolher outro na lista", async () => {
    renderShell();
    const user = userEvent.setup();

    /**
     * O gatilho não tem `label` próprio (uso compacto — R3-008): o nome
     * acessível vem do `<label htmlFor="cycle">`/`ariaLabel` fixo ("Ciclo"),
     * igual ao que já acontece com "Ordenar por" em `single-select-filter.test.tsx`
     * — o texto VISÍVEL (o ciclo selecionado) é conferido à parte, via
     * `textContent`, nunca pelo nome do `role`.
     */
    const trigger = await screen.findByRole("button", { name: "Ciclo" });
    // fixtureState tem "2026 H1" (fechado) e "2026 H2" (ativo, activeCycleId).
    expect(trigger.textContent).toContain("2026 H2");

    await user.click(trigger);
    const option = await screen.findByRole("option", { name: "2026 H1" });
    await user.click(option);

    // O gatilho passa a mostrar o novo ciclo escolhido — mesma troca de
    // `value` que o `<select>` nativo fazia via `onChange`.
    expect(trigger.textContent).toContain("2026 H1");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("Escape fecha o popover do Ciclo e devolve o foco pro gatilho", async () => {
    renderShell();
    const user = userEvent.setup();

    const trigger = await screen.findByRole("button", { name: "Ciclo" });
    await user.click(trigger);
    expect(await screen.findByRole("listbox")).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("o menu de preferências troca o idioma ao escolher 'English' na lista", async () => {
    renderShell();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Preferências" }));
    // Mesmo raciocínio do teste de Ciclo: o nome acessível é o rótulo fixo
    // "Idioma", o idioma atual ("Português") é o texto visível dentro do gatilho.
    const languageTrigger = await screen.findByRole("button", { name: "Idioma" });
    expect(languageTrigger.textContent).toContain("Português");

    await user.click(languageTrigger);
    const englishOption = await screen.findByRole("option", { name: "English" });
    await user.click(englishOption);

    // Trocar o idioma reflete de imediato num texto já traduzido em outro
    // ponto da tela (prova que `setLocale` foi chamado com o código certo) —
    // "Ciclo" (rótulo ao lado do seletor de Ciclo) vira "Cycle".
    expect(await screen.findByText("Cycle")).toBeTruthy();
  });
});
