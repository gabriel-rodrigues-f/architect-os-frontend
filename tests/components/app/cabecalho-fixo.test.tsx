import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** `ProfileTabs` desenha `<Link>`; sem RouterProvider, o mock de sempre. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
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

import { CareerFileHeadingSlot, ProfileHeading } from "@/components/app/CareerFileHeading";
import { GapTable } from "@/components/app/gap-analysis-shared";
import { StablePageFrame } from "@/components/app/PageFrame";
import { ProfileHeader } from "@/components/app/ProfileHeader";
import { SELECTOR_CONTEXTS } from "@/lib/context-scope";
import { I18nProvider } from "@/lib/i18n";
import { fixtureAssignedManagerUser, fixtureState } from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * Referência FIAP 2026-09-06, §2 item 7 — bloco fixo com conteúdo rolando ao
 * lado. Na ficha da pessoa, o cabeçalho (nome, posição, nível e abas) fica
 * fixo enquanto o corpo rola; na Prontidão para Progressão, o cabeçalho de
 * colunas fica fixo enquanto as linhas rolam.
 *
 * A regra da casa "mudança de menu nunca desloca a tela" manda: o bloco
 * fixo se prende logo ABAIXO do cabeçalho do shell, e a medida é a mesma
 * constante do `StablePageFrame` — não um número solto em cada tela.
 */
const fetchMock = vi.fn();

describe("cabeçalho fixo — a mesma régua do StablePageFrame", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o bloco fixo se prende abaixo do cabeçalho do shell, pela constante do frame", () => {
    const classe = StablePageFrame.pinnedUnderHeaderClass;
    expect(classe).toContain("sticky");
    expect(classe).toContain("top-(--shell-header-h)");
  });

  it("a ficha da pessoa: nome, posição/nível e abas num único bloco fixo", async () => {
    mockAppFetch(fetchMock, { user: fixtureAssignedManagerUser, state: fixtureState });
    // Como a rota-pai monta ([FA-08]): o bloco fixo abre o encaixe, a aba publica o título nele.
    renderWithApp(
      <CareerFileHeadingSlot>
        <ProfileHeader architect={fixtureState.architects[0]!} active="overview" />
        <ProfileHeading title="Ana Martins" description="Arquiteta · Nível II" />
      </CareerFileHeadingSlot>,
      { contexts: SELECTOR_CONTEXTS },
    );

    const bloco = (await screen.findByRole("heading", { level: 1, name: "Ana Martins" })).closest(
      "[data-pinned]",
    );
    expect(bloco).not.toBeNull();
    expect(bloco!.className).toContain(StablePageFrame.pinnedUnderHeaderClass);
    expect(bloco!.textContent).toContain("Arquiteta · Nível II");
    expect(bloco!.contains(screen.getByText("Visão geral"))).toBe(true);
  });

  it("a tabela de Prontidão para Progressão prende o cabeçalho de colunas", () => {
    render(
      <I18nProvider>
        <GapTable rows={[]} capabilities={[]} />
      </I18nProvider>,
    );
    const colunas = screen.getAllByRole("columnheader");
    expect(colunas.length).toBeGreaterThan(0);
    for (const coluna of colunas) {
      expect(coluna.className).toContain("sticky");
      expect(coluna.hasAttribute("data-pinned")).toBe(true);
    }
  });
});
