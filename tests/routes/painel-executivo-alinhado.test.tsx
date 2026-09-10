import { executiveBriefingRoute } from "../helpers/executive-briefing";
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
 * cartão, não no conteúdo.
 *
 * ONDA 3 — a linha de cartões mudou de conteúdo (o Executive Summary tem
 * TRÊS: cobertura, decisões e a fila de gente), e a régua continua a mesma:
 * quem estica é o cartão. O caso do "?" ficou junto porque é a mesma linha —
 * cada número-síntese se explica.
 */
const fetchMock = vi.fn();

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

const BLOCOS = ["Pessoas avaliadas no ciclo", "Decisões na sua mesa"];

const blocoDe = (titulo: string) => screen.getByText(titulo).closest("section") as HTMLElement;

describe("Painel Executivo — os cartões da linha têm a mesma altura", () => {
  beforeEach(async () => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: scopedFixtureStateFor(fixtureAssignedManagerUser, fixtureState, [fixtureTeamId]),
      routes: [executiveBriefingRoute, operationsOverviewRoute],
    });
    renderWithApp(<DashboardPage />);
    // O cabeçalho aparece antes da leitura chegar: espera-se o CARTÃO.
    await screen.findByText(BLOCOS[0]!);
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

  it("os cartões se explicam: cada número-síntese leva o seu '?'", () => {
    for (const titulo of BLOCOS) {
      expect(
        within(blocoDe(titulo)).getByRole("button", { name: /^Como ler / }),
        titulo,
      ).toBeTruthy();
    }
  });

  it("o '?' das decisões fala das FILAS, não de outro cartão", () => {
    const ajuda = within(blocoDe("Decisões na sua mesa")).getByRole("button", {
      name: /^Como ler /,
    });

    expect(ajuda.getAttribute("aria-label")).toBe("Como ler Ações da Liderança");
  });
});
