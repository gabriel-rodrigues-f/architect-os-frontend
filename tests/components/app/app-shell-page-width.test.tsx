import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de app-shell-sidebar-toggle.test.tsx: `<Link>` e `useRouterState` exigem router real. */
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
import { ThemeProvider } from "@/lib/theme";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * UX-02 — a página não tinha largura máxima nenhuma: em monitor ultrawide a
 * linha de texto esticava sem limite. A trava fica no shell, uma vez, e não
 * tela a tela — que é o que a auditoria mediu faltando (0 `mx-auto`, 0
 * `max-w` de página). Como em responsiveness.test.tsx, jsdom não mede largura
 * real: o que dá para travar é a presença das classes de layout.
 */
const fetchMock = vi.fn();

describe("AppShell — largura máxima da página", () => {
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

  const renderShell = () =>
    renderWithApp(
      <ThemeProvider>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </ThemeProvider>,
    );

  it("o conteúdo da página é centralizado e limitado", async () => {
    renderShell();
    const main = await screen.findByRole("main");
    expect(main.className).toContain("max-w-page");
    expect(main.className).toContain("mx-auto");
  });

  /** A barra fica sangrada de ponta a ponta, mas o conteúdo dela acompanha a página. */
  it("o cabeçalho alinha pela mesma medida do conteúdo", async () => {
    renderShell();
    const header = await screen.findByRole("banner");
    const faixa = header.firstElementChild;
    expect(faixa?.className).toContain("max-w-page");
    expect(faixa?.className).toContain("mx-auto");
  });
});
