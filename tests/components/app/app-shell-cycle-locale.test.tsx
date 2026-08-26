import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
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
import { ThemeProvider } from "../theme";
import { mockAppFetch, renderWithApp } from "./render-app";

/**
 * R3-008 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o seletor de Ciclo (só
 * admin) e o seletor de idioma (dentro de `PreferencesMenu`) trocaram de
 * `<select>` nativo por `SingleSelectFilter`. Estes testes provam que a
 * troca de controle não mudou o comportamento: abrir, escolher uma opção,
 * ver o valor mudar — só o "chrome" visual é diferente agora.
 */
const fetchMock = vi.fn();

/**
 * OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`).
 * O `ThemeProvider` (que o helper não inclui) entra como filho: é contexto
 * independente dos demais providers, a posição na árvore não muda nada.
 */

describe("AppShell — seletor de Ciclo e de idioma (R3-008)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // I18nProvider decide o idioma no efeito de montagem: sem repor pt aqui,
    // o teste herdaria o idioma do jsdom (en-US) e quebraria as asserções de texto.
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
