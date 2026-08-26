import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuerySection } from "@/components/app/QuerySection";
import { I18nProvider } from "@/lib/i18n";

/**
 * OO3-18/F-2 — o bloco loading/erro de seção alimentada por `useQuery` virou
 * um esqueleto só: pendente = skeleton com `aria-busy`/`aria-live` + texto
 * sr-only; erro (ou dado fora do formato) = `role="alert"` + "Tentar
 * novamente" que refaz a consulta; sucesso = `children(data)` verbatim.
 * Antes, `users.tsx` e `evolution.tsx` resolviam o mesmo problema SEM retry
 * e SEM ARIA — a padronização que este componente garante.
 */
describe("QuerySection", () => {
  afterEach(() => cleanup());

  const renderWith = (ui: ReactNode) => render(<I18nProvider>{ui}</I18nProvider>);

  const baseQuery = {
    data: undefined as { items?: string[] } | undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  };

  it("pendente: mostra o skeleton do call site com aria-busy/aria-live e texto sr-only", () => {
    renderWith(
      <QuerySection
        query={{ ...baseQuery, isPending: true }}
        title="Portfólio"
        description="Capacidades do ciclo"
        errorMessage="Não deu"
        skeleton={<div data-testid="skeleton" className="h-9 animate-pulse" />}
      >
        {() => <p>conteúdo</p>}
      </QuerySection>,
    );

    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toBeTruthy();
    const busy = skeleton.closest("[aria-busy='true']");
    expect(busy).not.toBeNull();
    expect(busy?.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText("Carregando…").className).toContain("sr-only");
    // O SectionCard dos estados intermediários leva o título da seção.
    expect(screen.getByRole("heading", { name: "Portfólio" })).toBeTruthy();
    expect(screen.queryByText("conteúdo")).toBeNull();
  });

  it("erro: role='alert' com a mensagem e botão de retry que refaz a consulta", async () => {
    const refetch = vi.fn();
    renderWith(
      <QuerySection
        query={{ ...baseQuery, isError: true, refetch }}
        title="Portfólio"
        errorMessage="Não foi possível carregar"
        skeleton={<div />}
      >
        {() => <p>conteúdo</p>}
      </QuerySection>,
    );

    expect(screen.getByRole("alert").textContent).toBe("Não foi possível carregar");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("conteúdo")).toBeNull();
  });

  it("dado presente mas fora do formato (isEmpty) conta como erro — caso do `{}` de mock genérico", () => {
    renderWith(
      <QuerySection
        query={{ ...baseQuery, data: {} as { items?: string[] } }}
        title="Portfólio"
        errorMessage="Formato inesperado"
        skeleton={<div />}
        isEmpty={(d) => !d.items}
      >
        {() => <p>conteúdo</p>}
      </QuerySection>,
    );

    expect(screen.getByRole("alert").textContent).toBe("Formato inesperado");
  });

  it("sucesso: renderiza children(data) verbatim, sem SectionCard extra por fora", () => {
    renderWith(
      <QuerySection
        query={{ ...baseQuery, data: { items: ["a", "b"] } }}
        title="Portfólio"
        errorMessage="Não deu"
        skeleton={<div />}
      >
        {(data) => <p>tem {data.items?.length} itens</p>}
      </QuerySection>,
    );

    expect(screen.getByText("tem 2 itens")).toBeTruthy();
    // O card dos estados intermediários NÃO embrulha o sucesso: telas cujo
    // conteúdo já traz o próprio card não ganham card duplicado.
    expect(screen.queryByRole("heading", { name: "Portfólio" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sem `title`, pendente/erro rendem crus — caso de evolution.tsx, cujos estados vivem fora de card", () => {
    const { container } = renderWith(
      <QuerySection
        query={{ ...baseQuery, isPending: true }}
        errorMessage="Não deu"
        skeleton={<p>Carregando dados…</p>}
      >
        {() => <p>conteúdo</p>}
      </QuerySection>,
    );

    expect(screen.getByText("Carregando dados…")).toBeTruthy();
    expect(container.querySelector("section")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
