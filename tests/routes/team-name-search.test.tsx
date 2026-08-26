import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesmo motivo do team-deactivate.test.tsx: sem RouterProvider real, `<Link>` vira âncora comum. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to: _to,
      params: _params,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown }) => <a {...rest}>{children}</a>,
  };
});

import { Route as TeamRoute } from "@/routes/team";
import { emptyAuthUsersRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * AUDITORIA-FINAL-ENTERPRISE-SYNAPSE-2026-08-22.md, P1-12/B-13 — "achar a
 * Marina" entre dezenas de cards não tinha como ser resolvido pelos filtros
 * de composição por caixinha (Status/Papel/Especialização/Capacidade).
 *
 * R2-UX-06 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md, Anexo B) — a busca livre
 * virou `ArchitectNameCombobox`, seleção múltipla pesquisável: "Todos os
 * registros" (tri-state) desmarca/marca tudo de uma vez, e cada pessoa tem
 * seu próprio checkbox — mesmo padrão de composição por caixinha das
 * outras facetas, nunca texto livre filtrando a tabela direto.
 */
const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const TeamPage = TeamRoute.options.component as () => ReactNode;

describe("Time — seleção de pessoas (ArchitectNameCombobox)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { routes: [emptyAuthUsersRoute] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("desmarcar 'Todos os registros' e marcar uma pessoa isola a lista; o chip 'Pessoas' limpa a seleção", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");
    expect(screen.getByText("Bruno Almeida")).toBeTruthy();

    await userEvent.click(screen.getByRole("combobox", { name: "Pessoas" }));
    await userEvent.click(await screen.findByText("Todos os registros"));
    await userEvent.click(await screen.findByText("Ana Martins"));
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText("Bruno Almeida")).toBeNull());
    // "Ana Martins" agora também aparece no resumo do combobox — só uma pessoa selecionada.
    expect(screen.getAllByText("Ana Martins").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: /Pessoas: 1 selecionadas/ }));

    expect(await screen.findByText("Bruno Almeida")).toBeTruthy();
    expect(screen.getAllByText("Ana Martins").length).toBeGreaterThan(0);
  });
});
