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

import { AppShell } from "@/components/app/AppShell";
import { NAV_GROUPS, filterNavGroups, isNavItemActive } from "@/lib/navigation-catalog";
import type { SessionUser } from "@/lib/api";
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

/** Quem lidera E é profissional: o único caso em que "Minha carreira" ainda aparece. */
const liderComProfissional: SessionUser = { ...fixtureAssignedTechLeadUser, professionalId: "ana" };

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

  const renderEm = async (pathname: string, user: SessionUser = fixtureAdminUser) => {
    routerState.pathname = pathname;
    mockAppFetch(fetchMock, { user });
    renderWithApp(
      <ThemeProvider>
        <AppShell>
          <div>conteúdo</div>
        </AppShell>
      </ThemeProvider>,
    );
    await screen.findByRole("link", { name: "Painel Executivo" });
  };

  it("em /team-rules só o Perfil de Competências do Time acende — 'Talentos do Time' não é prefixo de caminho dele", async () => {
    await renderEm("/team-rules");

    expect(itensAtivos()).toEqual(["Perfil de Competências do Time"]);
  });

  it("em /team só o Time acende", async () => {
    await renderEm("/team");

    expect(itensAtivos()).toEqual(["Talentos do Time"]);
  });

  /**
   * Onda 35 — achado 9 do dono (2026-09-02), literal: "Ao ver um
   * profissional, a barra lateral deve marcar 'Time'." A ficha
   * (/professionals/$id/*) é aberta a partir do roster de /team e nenhum item
   * acendia. Quem lidera E tem a própria ficha continua com "Minha carreira"
   * acesa na PRÓPRIA ficha — o item mais específico ganha; em qualquer outra
   * ficha, é o Time.
   */
  it("na ficha de uma pessoa (/professionals/ana) o Time acende", async () => {
    await renderEm("/professionals/ana");

    expect(itensAtivos()).toEqual(["Talentos do Time"]);
  });

  it("nas abas da ficha (/professionals/ana/evolution) o Time continua aceso", async () => {
    await renderEm("/professionals/ana/evolution");

    expect(itensAtivos()).toEqual(["Talentos do Time"]);
  });

  it("quem lidera e tem a própria ficha: na própria, só a aba do grupo Minha carreira (dono, 2026-09-06); na de outra pessoa, só Talentos do Time", async () => {
    await renderEm("/professionals/ana/roadmap", liderComProfissional);
    expect(itensAtivos()).toEqual(["Roteiro"]);
    cleanup();

    await renderEm("/professionals/ana", liderComProfissional);
    expect(itensAtivos()).toEqual(["Visão geral"]);
    cleanup();

    await renderEm("/professionals/bruno", liderComProfissional);
    expect(itensAtivos()).toEqual(["Talentos do Time"]);
  });

  /**
   * Dono (2026-09-08), literal: "quando estou em Estrutura de Times e clico em
   * Métricas, a seleção continua em Estrutura de Times e vejo os dois
   * selecionados; o menu selecionado deve passar a ser ele". A causa não era
   * a régua de item ativo: era o item das Métricas ser uma âncora externa,
   * que não muda a rota. Virou rota — e o menu volta a dizer a verdade.
   */
  it("ao sair de Estrutura de Times para as Métricas da Plataforma, só as Métricas acendem", async () => {
    await renderEm("/teams");
    expect(itensAtivos()).toEqual(["Estrutura de Times"]);
    cleanup();

    await renderEm("/platform-metrics");
    expect(itensAtivos()).toEqual(["Métricas da Plataforma"]);
  });

  it("nenhuma rota do menu acende mais de um item, para nenhum papel", () => {
    const perfis = [
      fixtureAdminUser,
      fixtureMemberUser,
      fixtureAssignedTechLeadUser,
      fixtureUnassignedTechLeadUser,
      liderComProfissional,
    ];
    for (const user of perfis) {
      const itens = filterNavGroups(NAV_GROUPS, user).flatMap((grupo) => grupo.items);
      for (const rota of itens.map((item) => item.to)) {
        const acesos = itens
          .filter((item) => isNavItemActive(item, rota, itens))
          .map((item) => item.to);
        expect(acesos, `${user.email} em ${rota}`).toEqual([rota]);
      }
    }
  });
});
