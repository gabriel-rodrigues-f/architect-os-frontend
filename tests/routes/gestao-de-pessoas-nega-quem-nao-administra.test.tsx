import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/api";
import { Route as TeamsRoute } from "@/routes/teams";
import { Route as UsersRoute } from "@/routes/users";
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
 * Revisão de papéis (2026-09-05): Usuários e Times são do administrador e do
 * gerente com vínculo. O tech lead não cadastra (D4) e não compõe time; o
 * profissional nunca entrou. A tela é a última barreira: sem lista, sem botão.
 */
const fetchMock = vi.fn();

const TELAS: ReadonlyArray<{ rota: string; Page: () => ReactNode; negativa: RegExp }> = [
  {
    rota: "/users",
    Page: UsersRoute.options.component as () => ReactNode,
    // Profissional e tech lead recebem a mesma negativa: a tela é do
    // administrador e do gerente com vínculo.
    negativa: /cadastrar pessoas é do administrador e do gerente/i,
  },
  {
    rota: "/teams",
    Page: TeamsRoute.options.component as () => ReactNode,
    negativa: /restrito ao administrador e ao gerente/i,
  },
];

function renderAs(user: SessionUser, page: ReactNode) {
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAdminUser ? fixtureState : scopedFixtureStateFor(user),
  });
  return renderWithApp(page);
}

describe("gestão de pessoas — quem não administra não vê lista nem botão", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each(TELAS)(
    "$rota: tech lead (com ou sem vínculo) e profissional recebem a negativa",
    async ({ Page, negativa }) => {
      for (const user of [
        fixtureMemberUser,
        fixtureAssignedTechLeadUser,
        fixtureUnassignedTechLeadUser,
      ]) {
        renderAs(user, <Page />);
        expect(await screen.findByText(negativa)).toBeTruthy();
        expect(screen.queryByRole("button", { name: /cadastrar pessoa|novo time/i })).toBeNull();
        cleanup();
      }
    },
  );

  it.each(TELAS)("$rota: admin e gerente com vínculo alcançam", async ({ Page, negativa }) => {
    for (const user of [fixtureAdminUser, fixtureAssignedManagerUser]) {
      renderAs(user, <Page />);
      expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
      expect(screen.queryByText(negativa)).toBeNull();
      cleanup();
    }
  });
});
