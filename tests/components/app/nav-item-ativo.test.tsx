import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routerState = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouterState: () => routerState.pathname,
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

import { AppShell, filterNavGroups, isNavItemActive, NAV_GROUPS } from "@/components/app/AppShell";
import { ThemeProvider } from "@/lib/theme";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureAssignedTechLeadUser,
  fixtureUnassignedTechLeadUser,
} from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * Defeito visto na captura da Régua do Time que o dono mandou em 2026-08-30,
 * e reproduzido no navegador contra a `main` antes desta fatia: em
 * `/team-rules` o menu acende DOIS itens, "Time" e "Régua do Time".
 *
 * A causa é a regra de item ativo: `pathname.startsWith(item.to)` com
 * `item.to === "/team"` casa `/team-rules`, porque a comparação é de texto e
 * não de segmento de caminho. Quem olha o menu lê que está em duas telas ao
 * mesmo tempo — e o mesmo casamento frouxo vale para qualquer par de rotas em
 * que uma seja prefixo textual da outra, hoje e no futuro.
 *
 * O invariante é o que se afirma abaixo, não o par: em qualquer rota, no
 * máximo um item do menu está ativo.
 */
const fetchMock = vi.fn();

const itensAtivos = (): string[] => {
  const aside = document.querySelector("aside");
  if (!aside) throw new Error("a coluna lateral não montou");
  return [...aside.querySelectorAll("a")]
    .filter((link) => link.className.includes("font-medium"))
    .map((link) => link.textContent?.trim() ?? "");
};

describe("item ativo do menu — a rota acende um item, nunca dois", () => {
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

  const renderEm = async (pathname: string) => {
    routerState.pathname = pathname;
    renderWithApp(
      <ThemeProvider>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </ThemeProvider>,
    );
    await screen.findByRole("link", { name: "Painel" });
  };

  it("em /team-rules só a Régua do Time acende — 'Time' não é prefixo de caminho dela", async () => {
    await renderEm("/team-rules");

    expect(itensAtivos()).toEqual(["Régua do Time"]);
  });

  it("em /team só o Time acende", async () => {
    await renderEm("/team");

    expect(itensAtivos()).toEqual(["Time"]);
  });

  it("nenhuma rota do menu acende mais de um item, para nenhum papel", () => {
    const perfis = [
      fixtureAdminUser,
      fixtureMemberUser,
      fixtureAssignedTechLeadUser,
      fixtureUnassignedTechLeadUser,
    ];
    for (const user of perfis) {
      const itens = filterNavGroups(NAV_GROUPS, user).flatMap((grupo) => grupo.items);
      for (const rota of itens.map((item) => item.to)) {
        const acesos = itens.filter((item) => isNavItemActive(item, rota)).map((item) => item.to);
        expect(acesos, `${user.email} em ${rota}`).toEqual([rota]);
      }
    }
  });
});
