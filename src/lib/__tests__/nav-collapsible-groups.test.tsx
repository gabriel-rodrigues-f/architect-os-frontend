import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesmo motivo de app-shell-sidebar-toggle.test.tsx: `<Link>`/`useRouterState` exigem RouterProvider real. */
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
 * R2-UX-14 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — seções do menu viram
 * colapsáveis: cabeçalho vira botão com `aria-expanded`, persiste em
 * `synapse:nav-collapsed-groups`. Feedback ao vivo do product owner (Bloco
 * 7) corrigiu um bug real: o grupo da rota ativa não podia ser recolhido
 * de verdade. Agora QUALQUER grupo recolhe — a diferença é que, se o grupo
 * contém a rota ativa, o item ativo fica fixo (nunca some) e só os irmãos
 * dele recolhem (`partitionGroupItems`, testado isoladamente em
 * `nav-role.test.ts`). `useRouterState` mockado fixa a rota em "/", que
 * pertence ao grupo "Operação" — é o que permite testar esse comportamento
 * "item fixo + irmãos recolhem" contra ele e o comportamento comum (grupo
 * inteiro recolhe, sem rota ativa dentro) contra "Desenvolvimento".
 */
const fetchMock = vi.fn();
const STORAGE_KEY = "synapse:nav-collapsed-groups";

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

describe("AppShell — seções colapsáveis do menu (R2-UX-14)", () => {
  beforeEach(() => {
    window.localStorage.clear();
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

  it("clicar no cabeçalho de 'Desenvolvimento' colapsa o grupo e persiste no localStorage", async () => {
    renderShell();
    const user = userEvent.setup();

    const header = await screen.findByRole("button", { name: "Desenvolvimento" });
    expect(header.getAttribute("aria-expanded")).toBe("true");
    // `<Link>` mockado não define `href`, então não ganha role="link" implícito — verifica pelo texto.
    expect(screen.getByText("Mentoria")).toBeTruthy();

    await user.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("false");
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
    expect(saved).toContain("nav.group.development");
  });

  /**
   * Este repo não tem `@testing-library/jest-dom` instalado (nenhum teste
   * da suíte usa `toBeVisible()`/`toBeInTheDocument()`), então a asserção
   * de "escondido" não pode se apoiar num matcher de visibilidade — lê-se
   * o `style.gridTemplateRows` do painel (0fr = recolhido, 1fr = aberto)
   * via `aria-controls` → `id`, o mesmo mecanismo que a animação usa em
   * produção.
   */
  it("colapsar o grupo da rota ativa ('Operação') some com os irmãos e mantém só 'Painel' fixo", async () => {
    renderShell();
    const user = userEvent.setup();

    const header = await screen.findByRole("button", { name: "Operação" });
    expect(header.getAttribute("aria-expanded")).toBe("true");

    const panelId = header.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)?.style.gridTemplateRows).toBe("1fr");
    // "Time" é irmão do Painel em "Operação" — visível enquanto expandido.
    expect(within(document.getElementById(panelId!)!).getByText("Time")).toBeTruthy();

    await user.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("false");
    // Painel (rota ativa) está fixado FORA do wrapper animado — nunca some.
    expect(screen.getAllByText("Painel").length).toBeGreaterThan(0);
    // O wrapper que guarda os irmãos agora está com altura 0 — mesmo
    // mecanismo que já funciona para "Desenvolvimento"; os nós continuam
    // montados (é o que garante a animação suave), só a altura mudou.
    const panel = document.getElementById(panelId!);
    expect(panel?.style.gridTemplateRows).toBe("0fr");
    expect(within(panel!).getByText("Time")).toBeTruthy();
  });

  it("nasce com a preferência salva: grupo previamente colapsado carrega já fechado", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["nav.group.admin"]));
    renderShell();

    const header = await screen.findByRole("button", { name: "Administração" });
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });

  it("mesmo comportamento no drawer mobile", async () => {
    renderShell();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Abrir menu de navegação" }));
    const drawer = await screen.findByRole("dialog");
    const header = within(drawer).getByRole("button", { name: "Desenvolvimento" });
    expect(header.getAttribute("aria-expanded")).toBe("true");

    await user.click(header);

    expect(header.getAttribute("aria-expanded")).toBe("false");
  });
});
