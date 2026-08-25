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
 * `synapse:nav-collapsed-groups`, e o grupo da rota ativa nunca fecha.
 * `useRouterState` mockado fixa a rota em "/", que pertence ao grupo
 * "Operação" — é o que permite testar a regra de "nunca fecha" contra ele
 * e o comportamento normal de colapsar contra "Desenvolvimento".
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

  it("o grupo da rota ativa ('Operação', pathname '/') nunca fecha, mesmo clicando no cabeçalho", async () => {
    renderShell();
    const user = userEvent.setup();

    const header = await screen.findByRole("button", { name: "Operação" });
    expect(header.getAttribute("aria-expanded")).toBe("true");

    await user.click(header);

    // Continua expandido visualmente — o link do Painel (rota ativa) segue visível.
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByText("Painel").length).toBeGreaterThan(0);
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
