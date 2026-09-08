import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `painel-executivo-blocos.test.tsx`: `<Link>` exige RouterProvider real. */
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

import { Route as DashboardRoute } from "@/routes/index";
import {
  fixtureAssignedManagerUser,
  fixtureState,
  fixtureTeamId,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch, operationsOverviewRoute, renderWithApp } from "../helpers/render-app";

/**
 * Item 6 do lote do dono (2026-09-08): *"Painel Executivo: alinhar melhor —
 * na captura há um bloco vazio com moldura no canto direito, abaixo de
 * 'Distâncias por severidade'"*.
 *
 * A moldura solta era o CARTÃO parando na altura do próprio conteúdo dentro
 * de uma célula de grade que já se estica: o `h-full` precisa estar no
 * cartão, não no conteúdo. E o quarto cartão era o único sem o "?" que os
 * outros três têm.
 */
const fetchMock = vi.fn();

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

const BLOCOS = [
  "Avaliação do Ciclo",
  "Distâncias por severidade",
  "PDIs do ciclo",
  "Ações da Liderança",
];

const blocoDe = (titulo: string) => screen.getByText(titulo).closest("section") as HTMLElement;

describe("Painel Executivo — os quatro cartões da linha têm a mesma altura", () => {
  beforeEach(async () => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: scopedFixtureStateFor(fixtureAssignedManagerUser, fixtureState, [fixtureTeamId]),
      routes: [operationsOverviewRoute],
    });
    renderWithApp(<DashboardPage />);
    await screen.findByText("Painel Executivo");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o cartão ocupa a célula inteira da grade — é o cartão que estica, não o conteúdo", () => {
    for (const titulo of BLOCOS) {
      expect(blocoDe(titulo).className, titulo).toContain("h-full");
    }
  });

  it("os quatro cartões se explicam: o quarto ganha o '?' que faltava", () => {
    for (const titulo of BLOCOS) {
      expect(
        within(blocoDe(titulo)).getByRole("button", { name: /^Como ler / }),
        titulo,
      ).toBeTruthy();
    }
  });

  it("o '?' das Ações da Liderança fala das FILAS, não de outro cartão", () => {
    const ajuda = within(blocoDe("Ações da Liderança")).getByRole("button", { name: /^Como ler / });

    expect(ajuda.getAttribute("aria-label")).toBe("Como ler Ações da Liderança");
  });
});
