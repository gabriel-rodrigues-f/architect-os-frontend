import { act, cleanup, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesma razão de `app-shell-cycle-locale.test.tsx`: `<Link>` do TanStack Router
 * exige um `RouterProvider` real; `useRouterState` também é usado direto pelo
 * `AppShell`.
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
import { apiPath } from "@/lib/api-path";
import { ThemeProvider } from "@/lib/theme";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * ONDA 29, fatia `sessao-ociosa` — pedido literal do dono:
 *
 *   "precisamos revogar o usuário quando ele ficar 10 minutos sem mexer na
 *    tela e deslogá-lo. antes disso, deixamos uma mensagem no canto superior
 *    da tela 'Você ainda está aí'. Se depois de 1 minuto após a mensagem o
 *    usuário não mexer na tela, devemos deslogá-lo."
 *
 * Orçamento TOTAL de 10 minutos, já decidido: aviso aos 9, logout aos 10.
 *
 * Este arquivo é a metade de TELA: o aviso existe no topo, é anunciado como
 * alerta, some com atividade e o logout que revoga é o `POST /auth/logout` que
 * já existe (o backend põe o `jti` na denylist — `auth.controller.ts`).
 * A metade de MECANISMO — suspensão da máquina, várias abas, throttling —
 * está em `tests/lib/sessao-ociosa.test.ts`.
 *
 * VERMELHO contra o código de hoje: nada disso existe, então o aviso nunca
 * aparece e o logout nunca acontece.
 */
const fetchMock = vi.fn();

const NOVE_MINUTOS = 9 * 60_000;
const UM_MINUTO = 60_000;

describe("sessão ociosa — o aviso no topo da tela (onda 29)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  const renderShell = () =>
    renderWithApp(
      <ThemeProvider>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </ThemeProvider>,
    );

  const avancar = async (milissegundos: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(milissegundos);
    });
  };

  const mexerNaTela = async () => {
    await act(async () => {
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(1_000);
    });
  };

  const pediuLogout = () =>
    fetchMock.mock.calls.some(([entrada]) => String(entrada).includes(apiPath("/auth/logout")));

  it("não mostra nada enquanto o usuário está mexendo na tela", async () => {
    renderShell();
    await screen.findByText("conteúdo");

    await avancar(NOVE_MINUTOS - 1_000);
    await mexerNaTela();
    await avancar(NOVE_MINUTOS - 2_000);

    expect(screen.queryByText("Você ainda está aí?")).toBeNull();
    expect(pediuLogout()).toBe(false);
  });

  it("aos 9 minutos sem mexer na tela, avisa com as palavras do dono", async () => {
    renderShell();
    await screen.findByText("conteúdo");
    expect(screen.queryByText("Você ainda está aí?")).toBeNull();

    await avancar(NOVE_MINUTOS);

    const aviso = screen.getByText("Você ainda está aí?");
    expect(aviso.textContent).toContain("Você ainda está aí?");
    expect(pediuLogout()).toBe(false);
  });

  /**
   * Regra da casa (`src/lib/accessibility`): mudança de estado importante que
   * aparece sem o usuário pedir precisa ser ANUNCIADA, não só pintada.
   */
  it("o aviso é anunciado por leitor de tela, não só pintado", async () => {
    renderShell();
    await screen.findByText("conteúdo");

    await avancar(NOVE_MINUTOS);

    const alerta = screen.getByRole("alert");
    expect(alerta.textContent).toContain("Você ainda está aí?");
  });

  /** O aviso vive no `<header>` grudado no topo — "o canto superior da tela". */
  it("o aviso mora dentro do cabeçalho do topo", async () => {
    renderShell();
    await screen.findByText("conteúdo");

    await avancar(NOVE_MINUTOS);

    const alerta = screen.getByRole("alert");
    expect(alerta.closest("header")).not.toBeNull();
  });

  it("qualquer atividade dissolve o aviso e devolve o orçamento INTEIRO", async () => {
    renderShell();
    await screen.findByText("conteúdo");

    await avancar(NOVE_MINUTOS + 30_000);
    expect(screen.getByText("Você ainda está aí?")).toBeTruthy();

    await mexerNaTela();
    expect(screen.queryByText("Você ainda está aí?")).toBeNull();

    await avancar(NOVE_MINUTOS - 2_000);
    expect(screen.queryByText("Você ainda está aí?")).toBeNull();
    expect(pediuLogout()).toBe(false);
  });

  it("aos 10 minutos sem mexer na tela, desloga chamando o logout que revoga", async () => {
    renderShell();
    await screen.findByText("conteúdo");

    await avancar(NOVE_MINUTOS);
    expect(pediuLogout()).toBe(false);

    await avancar(UM_MINUTO);

    expect(pediuLogout()).toBe(true);
  });
});
