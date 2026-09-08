import { fixtureAdminUser } from "../helpers/fixtures";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesmo motivo de team-deactivate.test.tsx: sem RouterProvider real, `<Link>` vira âncora comum. */
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
 * R2-VIS-02 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — texto com `truncate`
 * escondia a parte cortada sem nenhum jeito de ler o valor inteiro. A regra
 * de então era "todo `truncate` carrega `title`".
 *
 * A revisão mestre de 2026-09-08 ([F-02]) trocou o COMO sem mexer no QUÊ: o
 * `title` do navegador não abre no toque nem por teclado, então o texto
 * inteiro passa a vir do `TruncatedText` — gatilho focalizável e balão da
 * casa. O que este arquivo cobra continua sendo o mesmo: o que a tela corta,
 * a tela devolve.
 */
const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const TeamPage = TeamRoute.options.component as () => ReactNode;

describe("Time — o que a tela corta, a tela devolve", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { user: fixtureAdminUser, routes: [emptyAuthUsersRoute] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("cartão de profissional: o e-mail cortado devolve o valor inteiro, alcançável por teclado", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");
    const email = screen.getByText("ana@company.com");
    expect(email.className).toContain("truncate");
    expect(email.getAttribute("tabindex")).toBe("0");
  });

  it("tabela: o nome e o e-mail cortados devolvem o valor inteiro", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");
    await userEvent.click(screen.getByRole("button", { name: "Tabela" }));

    // O nome é um LINK: o texto inteiro já está no nome acessível do próprio
    // link, e o `title` fica como redundância para quem enxerga o corte.
    const nameLinks = await screen.findAllByText("Ana Martins");
    expect(nameLinks.some((el) => el.getAttribute("title") === "Ana Martins")).toBe(true);

    const emailCells = screen.getAllByText("ana@company.com");
    expect(emailCells.some((el) => el.getAttribute("tabindex") === "0")).toBe(true);
  });
});
