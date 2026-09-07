import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    createFileRoute:
      (..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({
        ...options,
        options,
        useParams: () => ({ architectId: "ana" }),
      }),
  };
});

import { Route as ProfileRoute } from "@/routes/architects.$architectId.index";
import {
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureTeamId,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Dono, 2026-09-06: com "Minha carreira" virando um GRUPO do menu (Visão
 * geral, Evolução, Extrato, Roteiro), "morre o botão 'Voltar' do canto
 * superior direito" — na PRÓPRIA ficha. Quem lidera, olhando a ficha de
 * outra pessoa, continua voltando para o Time.
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;

describe("a própria ficha não tem 'Voltar' (dono, 2026-09-06)", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("o profissional na própria Visão geral não vê 'Voltar' — o menu já leva a cada aba", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureMemberUser,
      state: scopedFixtureStateFor(fixtureMemberUser),
    });
    renderWithApp(<ProfilePage />);

    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Voltar")).toBeNull();
  });

  it("quem lidera, na ficha de outra pessoa, mantém o 'Voltar' para o Time", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state: scopedFixtureStateFor(fixtureAssignedTechLeadUser, undefined, [fixtureTeamId]),
    });
    renderWithApp(<ProfilePage />);

    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.getByText("Voltar")).toBeTruthy();
  });
});
