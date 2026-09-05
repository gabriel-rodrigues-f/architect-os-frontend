import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/api";
import { Route as CompareRoute } from "@/routes/compare";
import { Route as ProgressionRoute } from "@/routes/progression";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureState,
  fixtureUnassignedTechLeadUser,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * D5 (dono, 2026-09-05): o mapa pessoa × competência com nome — Progressão e
 * Comparativo — é ferramenta do TECH LEAD vinculado. Gerente, admin, tech lead
 * sem vínculo e profissional recebem a negativa, e nenhum nome é desenhado.
 */
const fetchMock = vi.fn();
const NEGATIVA = "O mapa pessoa × competência é do tech lead do time.";

const TELAS: ReadonlyArray<{ rota: string; Page: () => ReactNode }> = [
  { rota: "/progression", Page: ProgressionRoute.options.component as () => ReactNode },
  { rota: "/compare", Page: CompareRoute.options.component as () => ReactNode },
];

function renderAs(user: SessionUser, page: ReactNode) {
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAdminUser ? fixtureState : scopedFixtureStateFor(user),
  });
  return renderWithApp(page);
}

describe("o mapa técnico é do tech lead vinculado", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each(TELAS)(
    "$rota: profissional, gerente, admin e tech lead sem vínculo recebem a negativa",
    async ({ Page }) => {
      for (const user of [
        fixtureMemberUser,
        fixtureAssignedManagerUser,
        fixtureAdminUser,
        fixtureUnassignedTechLeadUser,
      ]) {
        renderAs(user, <Page />);
        expect(await screen.findByText(NEGATIVA)).toBeTruthy();
        expect(screen.queryByText("Ana Martins")).toBeNull();
        cleanup();
      }
    },
  );

  it.each(TELAS)("$rota: o tech lead com vínculo alcança", async ({ Page }) => {
    renderAs(fixtureAssignedTechLeadUser, <Page />);
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByText(NEGATIVA)).toBeNull();
  });
});
