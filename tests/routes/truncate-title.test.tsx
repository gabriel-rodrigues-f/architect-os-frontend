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
import { emptyAuthUsersRoute, mockAppFetch, renderWithApp } from "./render-app";

/**
 * R2-VIS-02 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — texto com `truncate`
 * escondia a parte cortada sem nenhum jeito de ler o valor inteiro (nem
 * hover). Regra: todo `truncate` carrega `title` com o texto completo.
 */
const fetchMock = vi.fn();

/** OO3-11/D-7 — providers compartilhados em `render-app.tsx` (`renderWithApp`). */

const TeamPage = TeamRoute.options.component as () => ReactNode;

describe("Time — truncate sempre carrega title", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { routes: [emptyAuthUsersRoute] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("cartão de arquiteto: e-mail truncado tem title com o valor completo", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");
    const email = screen.getByText("ana@company.com");
    expect(email.getAttribute("title")).toBe("ana@company.com");
  });

  it("tabela: nome, e-mail e especialização truncados têm title", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");
    await userEvent.click(screen.getByRole("button", { name: "Tabela" }));

    const nameLinks = await screen.findAllByText("Ana Martins");
    expect(nameLinks.some((el) => el.getAttribute("title") === "Ana Martins")).toBe(true);

    const emailCells = screen.getAllByText("ana@company.com");
    expect(emailCells.some((el) => el.getAttribute("title") === "ana@company.com")).toBe(true);
  });
});
