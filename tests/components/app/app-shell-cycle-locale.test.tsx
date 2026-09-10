import { fixtureAdminUser } from "../../helpers/fixtures";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesma razão de `app-shell-sidebar-toggle.test.tsx`: `<Link>` do TanStack
 * Router exige um `RouterProvider` real; `useRouterState` também é usado
 * direto pelo `AppShell`.
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
import { ThemeProvider } from "@/lib/theme";
import { mockAppFetch, renderWithApp } from "../../helpers/render-app";

/**
 * R3-008 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — o seletor de Ciclo (só
 * admin) e o seletor de idioma (dentro de `PreferencesMenu`) trocaram de
 * `<select>` nativo por `SingleSelectFilter`. Estes testes provam que a
 * troca de controle não mudou o comportamento: abrir, escolher uma opção,
 * ver o valor mudar — só o "chrome" visual é diferente agora.
 *
 * O CICLO MUDOU DE CANTO (dono, 2026-09-10): ele morava no alto, à direita, e
 * desceu para o rodapé da coluna, ao lado do bloco do usuário. O que este
 * arquivo prende é o COMPORTAMENTO do seletor, e ele não mudou de casa junto
 * com o seletor: abrir, escolher, ver o valor trocar, sair com Escape. Onde
 * ele fica é prendido em `o-cabecalho-enxuga.test.tsx`.
 */
const fetchMock = vi.fn();

/**
 * OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`).
 * O `ThemeProvider` (que o helper não inclui) entra como filho: é contexto
 * independente dos demais providers, a posição na árvore não muda nada.
 */

describe("AppShell — seletor de Ciclo e de idioma (R3-008)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // I18nProvider decide o idioma no efeito de montagem: sem repor pt aqui,
    // o teste herdaria o idioma do jsdom (en-US) e quebraria as asserções de texto.
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

  /**
   * O gatilho não tem `label` próprio (uso compacto — R3-008): o nome
   * acessível vem do `<label htmlFor="cycle">`/`ariaLabel` fixo ("Ciclo"),
   * igual ao que já acontece com "Ordenar por" em `single-select-filter.test.tsx`
   * — o texto VISÍVEL (o ciclo selecionado) é conferido à parte, via
   * `textContent`, nunca pelo nome do `role`.
   *
   * O gatilho é buscado DE NOVO depois da carga: enquanto a lista de ciclos
   * não chega, quem desenha é o estado vazio ("Nenhum ciclo cadastrado",
   * dono 2026-09-08) — outro elemento, e guardar a referência do primeiro
   * deixaria o teste falando com um nó que já saiu da tela.
   */
  const gatilhoDoCiclo = async () => {
    // fixtureState tem "2026 H1" (fechado) e "2026 H2" (ativo, activeCycleId).
    // ADR-0011 fase 1: o seletor lê o contexto `cycles` (não mais o blob
    // /state), então o rótulo chega quando a query resolve — daí o waitFor.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ciclo" }).textContent).toContain("2026 H2"),
    );
    return screen.getByRole("button", { name: "Ciclo" });
  };

  it("mostra o ciclo ativo no gatilho e troca ao escolher outro na lista", async () => {
    renderShell();
    const user = userEvent.setup();

    const trigger = await gatilhoDoCiclo();

    await user.click(trigger);
    const option = await screen.findByRole("option", { name: "2026 H1" });
    await user.click(option);

    // O gatilho passa a mostrar o novo ciclo escolhido — mesma troca de
    // `value` que o `<select>` nativo fazia via `onChange`.
    expect(trigger.textContent).toContain("2026 H1");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("Escape fecha o popover do Ciclo e devolve o foco pro gatilho", async () => {
    renderShell();
    const user = userEvent.setup();

    const trigger = await gatilhoDoCiclo();
    await user.click(trigger);
    expect(await screen.findByRole("listbox")).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  /**
   * A TROCA DE IDIOMA MUDOU DE CASA (fatia Minha Conta, 2026-09-10).
   *
   * Ela vivia no popover da engrenagem do cabeçalho. Com Minha Conta, o
   * seletor passou para **Minha Conta → Preferências**, e a prova mudou junto
   * para `tests/routes/preferencias-da-conta-na-escala.test.tsx`. Horas
   * depois, no mesmo dia, o dono removeu a própria engrenagem — *"ao invés de
   * termos um ícone de engrenagem para as configurações (idioma e tema),
   * vamos transformar isso em um menu e remover o ícone da engrenagem"* —, e
   * o caminho passou a ser o item da coluna. O que fica aqui é o que este
   * arquivo sempre guardou: o popover antigo não voltou.
   */
  it("o painel de preferências não mora mais no cabeçalho", async () => {
    renderShell();
    await screen.findByLabelText("Ciclo");
    expect(screen.queryByRole("button", { name: "Preferências" })).toBeNull();
  });
});
