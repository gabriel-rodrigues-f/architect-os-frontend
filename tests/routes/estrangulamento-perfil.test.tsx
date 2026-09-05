import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `architect-profile-fora-do-escopo.test.tsx`: `Route.useParams()` exige árvore montada. */
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
import { apiPath } from "@/lib/api-path";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * ADR-0011, fase 1 — terceira tela: o perfil do arquiteto consome os
 * contextos ESCOPADOS pela pessoa (`?architectId=`/`?menteeId=`), não o
 * blob. Três invariantes:
 *   1. a tela renderiza o perfil completo alimentada só pelos contextos;
 *   2. NENHUMA requisição a `/api/v1/state` acontece;
 *   3. os contextos por pessoa vão FILTRADOS na querystring — é o corte de
 *      payload que motivou a fase 1 (não baixar o time inteiro para ver um).
 * Nasceu VERMELHO: sem o ContextScope, o perfil em modo "contexts" caía em
 * "Arquiteto não encontrado.".
 */
const fetchMock = vi.fn();

const ProfilePage = ProfileRoute.options.component as () => ReactNode;

describe("estrangulamento fase 1 — perfil do arquiteto vive sem o blob /state", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: fixtureState });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renderiza o perfil pelos contextos escopados, sem nenhuma chamada a /state", async () => {
    renderWithApp(<ProfilePage />);

    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(await screen.findByText("ADR-014")).toBeTruthy();

    const requestedPaths = fetchMock.mock.calls.map((call) =>
      call[0] instanceof Request ? call[0].url : String(call[0]),
    );
    expect(requestedPaths.some((href) => href.endsWith(apiPath("/state")))).toBe(false);
    expect(
      requestedPaths.some((href) => href.endsWith(`${apiPath("/assessments")}?architectId=ana`)),
    ).toBe(true);
    expect(
      requestedPaths.some((href) => href.endsWith(`${apiPath("/evidences")}?architectId=ana`)),
    ).toBe(true);
    expect(
      requestedPaths.some((href) =>
        href.endsWith(`${apiPath("/mentoring-sessions")}?menteeId=ana`),
      ),
    ).toBe(true);
  });
});
