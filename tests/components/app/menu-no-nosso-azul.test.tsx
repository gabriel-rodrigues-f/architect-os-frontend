import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** `<Link>` exige RouterProvider; `useRouterState` dá só o `pathname` ao shell. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  const { PlainLink } = await import("../../helpers/react-router-mock");
  return {
    ...actual,
    useRouterState: () => "/assessments",
    Link: PlainLink,
  };
});

import { AppShell, MAIN_CONTENT_ID } from "@/components/app/AppShell";
import { NavLinkStyle } from "@/components/app/NavLinkItem";
import { SidebarPreferences } from "@/lib/sidebar-preferences";
import { ThemeProvider } from "@/lib/theme";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * Decisão do dono (2026-09-08, referência FIAP, "no nosso azul"): o ícone
 * do item é SEMPRE azul, o texto neutro; no hover o texto pinta de azul
 * sobre um fundo sutil; o item ativo tem texto azul, fundo sutil e um
 * indicador lateral. UM renderizador serve a coluna e a gaveta móvel
 * ([N-01], [FA-12]) — a gaveta ganha `aria-current`, que não tinha.
 */
const fetchMock = vi.fn();

const renderShell = () =>
  renderWithApp(
    <ThemeProvider>
      <AppShell>
        <div>conteúdo</div>
      </AppShell>
    </ThemeProvider>,
  );

describe("o item do menu, à FIAP e no nosso azul", () => {
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
    vi.restoreAllMocks();
  });

  it("o ícone de todo item é azul; o texto do item em repouso é neutro e pinta de azul no hover", async () => {
    renderShell();
    await screen.findByRole("button", { name: "Esconder menu lateral" });
    const aside = document.querySelector("aside")!;
    const avaliacoes = within(aside).getByRole("link", { name: "Avaliação de Desempenho" });
    const painel = within(aside).getByRole("link", { name: "Painel Executivo" });
    for (const link of [avaliacoes, painel]) {
      expect(link.querySelector("svg")?.getAttribute("class")).toContain("text-sidebar-emphasis");
    }
    expect(painel.className).toContain("hover:text-sidebar-emphasis");
    expect(painel.className.split(" ")).not.toContain("bg-sidebar-emphasis-subtle");
    expect(painel.getAttribute("data-active")).toBe("false");
  });

  it("o item ativo tem texto azul, fundo sutil e o indicador lateral", async () => {
    renderShell();
    await screen.findByRole("button", { name: "Esconder menu lateral" });
    const aside = document.querySelector("aside")!;
    const ativo = within(aside).getByRole("link", { name: "Avaliação de Desempenho" });
    expect(ativo.getAttribute("aria-current")).toBe("page");
    expect(ativo.getAttribute("data-active")).toBe("true");
    for (const classe of NavLinkStyle.active.split(" ")) expect(ativo.className).toContain(classe);
    expect(NavLinkStyle.active).toContain("text-sidebar-emphasis");
    expect(NavLinkStyle.active).toContain("bg-sidebar-emphasis-subtle");
    expect(NavLinkStyle.base).toContain("before:w-0.5");
    expect(NavLinkStyle.base).toContain("before:bg-sidebar-emphasis");
    expect(NavLinkStyle.active).toContain("before:opacity-100");
  });

  it("a gaveta móvel usa o MESMO item: o ativo tem aria-current e o mesmo indicador", async () => {
    renderShell();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Abrir menu de navegação" }));
    const gaveta = await screen.findByRole("dialog");
    const ativo = within(gaveta).getByRole("link", { name: "Avaliação de Desempenho" });
    expect(ativo.getAttribute("aria-current")).toBe("page");
    for (const classe of NavLinkStyle.active.split(" ")) expect(ativo.className).toContain(classe);
    expect(
      within(gaveta).getByRole("link", { name: "Painel Executivo" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("o skip link aponta para o main, e o main é focável por script", async () => {
    renderShell();
    const atalho = await screen.findByRole("link", { name: "Ir para o conteúdo" });
    expect(atalho.getAttribute("href")).toBe(`#${MAIN_CONTENT_ID}`);
    const main = document.querySelector("main");
    expect(main?.id).toBe(MAIN_CONTENT_ID);
    expect(main?.getAttribute("tabindex")).toBe("-1");
  });
});

describe("storage bloqueado não derruba o clique ([FA-05])", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("recolher o menu funciona mesmo com o navegador recusando gravar", async () => {
    renderShell();
    const user = userEvent.setup();
    const toggle = await screen.findByRole("button", { name: "Esconder menu lateral" });
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    expect(window.localStorage.getItem(SidebarPreferences.COLLAPSED_KEY)).toBeNull();
  });
});
