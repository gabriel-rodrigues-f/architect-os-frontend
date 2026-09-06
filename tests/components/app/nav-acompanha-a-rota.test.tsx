import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/lib/theme";
import { AppShell } from "@/components/app/AppShell";
import { fixtureAdminUser } from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

const routerState = vi.hoisted(() => ({ pathname: "/users" }));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => routerState.pathname,
    useNavigate: () => () => undefined,
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

const fetchMock = vi.fn();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Dono (2026-09-06): "quando clico em cadastrar usuários, o menu seleciona
 * usuários, mas continua visualmente em 'Times'". O item ativo é marcado
 * (`aria-current`) e a barra rola até ele.
 */
describe("menu — o item ativo é marcado e trazido à vista", () => {
  it("marca /users como página atual e rola o item para a vista", async () => {
    const rolagens: HTMLElement[] = [];
    Element.prototype.scrollIntoView = function scrollIntoView(this: HTMLElement) {
      rolagens.push(this);
    };
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { user: fixtureAdminUser });
    renderWithApp(
      <ThemeProvider>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </ThemeProvider>,
    );
    const atual = await screen.findAllByRole("link", { current: "page" });
    expect(atual.some((link) => link.getAttribute("href") === "/users")).toBe(true);
    expect(rolagens.some((el) => el.getAttribute("href") === "/users")).toBe(true);
  });
});
