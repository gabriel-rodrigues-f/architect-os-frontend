import { cleanup, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `app-shell-sidebar-toggle.test.tsx`: `<Link>` e `useRouterState` exigem router real. */
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
import { fixtureAdminUser } from "../../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * O CABEÇALHO ENXUGA (dono, 2026-09-10, com duas capturas).
 *
 * Primeiro pedido: *"Remova o Avaliar → Priorizar… etc, etc do canto superior
 * da tela. E os demais botões — ciclo, notificações e configuração — vamos
 * jogar para o canto inferior."* E, no mesmo dia, ele melhorou o próprio
 * pedido: *"ao invés de termos um ícone de engrenagem para as configurações
 * (idioma e tema), vamos transformar isso em um menu e remover o ícone da
 * engrenagem. Vamos remover também o ícone de notificações. Agora o próprio
 * Central do Usuário → Avisos deve contabilizar, com um número bem ao lado."*
 *
 * Vale a SEGUNDA versão. O que ela apaga do topo: a trilha da jornada, a
 * engrenagem e o sino. O que ela move: o seletor de ciclo, que desce para o
 * rodapé da coluna, ao lado do bloco do usuário.
 *
 * Por que nenhuma função fica órfã: idioma e tema já moram em Minha Conta →
 * Preferências desde `3a41d28`, e a engrenagem era só o atalho para lá — o
 * caminho passa a ser o item de menu. O painel do sino (ler a lista e marcar
 * como lido) é o que a tela de Avisos já faz, com filtro e seleção por linha
 * que o painel não tinha; o que morre com ele é só a paginação "Ver mais",
 * porque a tela carrega a caixa inteira.
 */
const fetchMock = vi.fn();

describe("o cabeçalho enxuga — a trilha, a engrenagem e o sino saem do topo", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { user: fixtureAdminUser });
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

  const rodapeDaColuna = () => {
    const coluna = document.querySelector("aside");
    expect(coluna).toBeTruthy();
    const nome = within(coluna as HTMLElement).getByText(fixtureAdminUser.name);
    return nome.closest("[data-shell-footer]") as HTMLElement;
  };

  it("a trilha Avaliar → Priorizar → Desenvolver → Conversar → Evoluir não está mais na tela", async () => {
    renderShell();
    await screen.findByText("conteúdo");
    expect(screen.queryByText(/Avaliar → Priorizar/)).toBeNull();
  });

  it("o sino de avisos não existe mais — nenhum botão do cabeçalho abre a caixa", async () => {
    renderShell();
    await screen.findByText("conteúdo");
    expect(screen.queryByRole("button", { name: /avisos/i })).toBeNull();
  });

  it("a engrenagem saiu: o cabeçalho não leva mais a Minha Conta por atalho", async () => {
    renderShell();
    await screen.findByText("conteúdo");
    const cabecalho = document.querySelector("header");
    if (cabecalho) {
      expect(within(cabecalho).queryByLabelText("Minha Conta")).toBeNull();
    }
    // O caminho continua existindo, e agora é UM só: o item da coluna.
    expect(
      within(document.querySelector("aside") as HTMLElement).getByText("Minha Conta"),
    ).toBeTruthy();
  });

  it("o seletor de ciclo desce para o rodapé da coluna, ao lado do nome de quem está logado", async () => {
    renderShell();
    await screen.findByText("conteúdo");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ciclo" }).textContent).toContain("2026 H2"),
    );

    const rodape = rodapeDaColuna();
    expect(rodape).toBeTruthy();
    expect(within(rodape).getByRole("button", { name: "Ciclo" })).toBeTruthy();
  });

  it("o cabeçalho não hospeda mais seletor nenhum", async () => {
    renderShell();
    await screen.findByText("conteúdo");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ciclo" }).textContent).toContain("2026 H2"),
    );

    const cabecalho = document.querySelector("header");
    if (cabecalho) {
      expect(within(cabecalho).queryByRole("button", { name: "Ciclo" })).toBeNull();
    }
  });
});
