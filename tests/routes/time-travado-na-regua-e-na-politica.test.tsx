import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
);

import type { SessionUser } from "@/lib/api";
import { Route as TeamRulesRoute } from "@/routes/team-rules";
import {
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureState,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import {
  TIME_INTEGRACOES,
  TIME_PLATAFORMA,
  doisTimesRoute,
  niveisDeCarreiraRoute,
} from "../helpers/politica-de-progressao";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Dono (2026-09-06): "Em Régua do Time > Time, ainda é possível clicar no
 * filtro de time. Com perfil de Gerente e Tech Lead não deve ser possível
 * clicar em menus de mudança de time. O time atual deve ser fixado e deve
 * aparecer um bloqueio ao passar o mouse por cima." Vale também para a
 * Política de Progressão. Quem lidera mais de um time continua escolhendo
 * entre os dele (o admin LÊ a régua e a política no agregado — D1 — e só
 * escolhe time em Cadastrar pessoa). O mesmo componente que já travava o
 * time em Cadastrar pessoa desenha o travamento nas três telas.
 */
const fetchMock = vi.fn();
const TeamRulesPage = TeamRulesRoute.options.component as () => ReactNode;

const gerenteDosDoisTimes: SessionUser = {
  ...fixtureAssignedManagerUser,
  memberships: [
    { teamId: TIME_PLATAFORMA, role: "manager" },
    { teamId: TIME_INTEGRACOES, role: "manager" },
  ],
};

const semRegua: FetchRoute = (href) =>
  href.includes("/rules/")
    ? jsonResponse(
        { code: "TeamRuleNotFoundError", message: "Este time não tem régua para o nível." },
        404,
      )
    : undefined;

const seletorDeTime = () => screen.findByLabelText("Time", { selector: "button" });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Régua do Time — o time fica travado para quem lidera um só", () => {
  const renderAs = (user: SessionUser) => {
    mockAppFetch(fetchMock, {
      user,
      state: user === fixtureAssignedManagerUser ? fixtureState : scopedFixtureStateFor(user),
      routes: [niveisDeCarreiraRoute, doisTimesRoute, semRegua],
    });
    renderWithApp(<TeamRulesPage />);
  };

  it.each([
    ["gerente", fixtureAssignedManagerUser],
    ["tech lead", fixtureAssignedTechLeadUser],
  ])(
    "%s de UM time: fixado nele, sem clique, com a explicação ao passar o mouse",
    async (_, user) => {
      renderAs(user);
      const seletor = await seletorDeTime();
      expect(seletor.textContent).toContain("Plataforma");
      expect(seletor.hasAttribute("disabled")).toBe(true);
      const explicacao = "Você lidera um time só — a régua é dele.";
      expect(seletor.getAttribute("title")).toBe(explicacao);
      expect(screen.getByText(explicacao)).toBeTruthy();

      await userEvent.click(seletor);
      expect(screen.queryByRole("option", { name: "Integrações" })).toBeNull();
    },
  );

  it("gerente de DOIS times escolhe entre os dele", async () => {
    renderAs(gerenteDosDoisTimes);
    const seletor = await seletorDeTime();
    expect(seletor.hasAttribute("disabled")).toBe(false);
    await userEvent.click(seletor);
    expect(screen.getByRole("option", { name: "Plataforma" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Integrações" })).toBeTruthy();
  });
});
