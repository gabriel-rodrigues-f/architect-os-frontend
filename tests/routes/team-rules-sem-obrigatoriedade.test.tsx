import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { Route as TeamRulesRoute } from "@/routes/team-rules";
import { fixtureState, fixtureTeamId } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Onda 36, item 5 do dono — fim da competência obrigatória: *"sem
 * RESTRITIVA/DESEJÁVEL em camada nenhuma; todas com o mesmo peso"*.
 *
 * Na régua do time isso significa: a competência ESTÁ ou NÃO ESTÁ na régua
 * (com um nível exigido), sem tipo de exigência, sem badge "Obrigatória",
 * sem troca de obrigatoriedade — e o PUT viaja sem `requirementType`, como o
 * contrato novo do backend (ADR-0082) define.
 */
const fetchMock = vi.fn();

const TeamRulesPage = TeamRulesRoute.options.component as () => ReactNode;

const teamsRoute: FetchRoute = (href) =>
  href.endsWith(apiPath("/teams"))
    ? jsonResponse([{ id: fixtureTeamId, name: "Time Plataforma", active: true }])
    : undefined;

/** A régua como o backend da onda 36 a devolve: competência sem tipo. */
const reguaSemTipo: FetchRoute = (href, init) =>
  href.includes("/rules/") && (init?.method ?? "GET") === "GET"
    ? jsonResponse({
        id: "regra-plataforma-i",
        teamId: fixtureTeamId,
        careerLevelId: "arquiteto-de-solucoes-i",
        minimumQualifiedCapabilities: 3,
        capabilityIds: ["cloud"],
        competencies: [{ competencyId: "cloud-k8s", requiredLevel: 4 }],
      })
    : undefined;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    state: fixtureState,
    routes: [careerLevelsRoute, teamsRoute, reguaSemTipo],
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("/team-rules sem obrigatoriedade", () => {
  it("a régua do contrato novo renderiza: sem coluna de obrigatoriedade, sem badge, sem troca", async () => {
    renderWithApp(<TeamRulesPage />);

    expect(await screen.findByText("Kubernetes")).toBeTruthy();
    expect(screen.queryByText("Obrigatoriedade")).toBeNull();
    expect(screen.queryByText("Obrigatória")).toBeNull();
    expect(screen.queryByText("Opcional")).toBeNull();
    expect(screen.queryByText(/Trocar obrigatoriedade/)).toBeNull();
  });

  it("incluir uma competência na régua pede só o nível, e o PUT sai sem requirementType", async () => {
    renderWithApp(<TeamRulesPage />);
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Na régua — Serverless"));
    await userEvent.click(await screen.findByRole("option", { name: "Na régua" }));

    await userEvent.click(screen.getByRole("button", { name: "Salvar régua" }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(
        (call) => (call as [string, RequestInit | undefined])[1]?.method === "PUT",
      );
      expect(put).toBeTruthy();
      const body = JSON.parse(String((put?.[1] as RequestInit).body)) as {
        competencies: Record<string, unknown>[];
      };
      expect(body.competencies).toHaveLength(2);
      for (const competency of body.competencies) {
        expect(Object.keys(competency).sort()).toEqual(["competencyId", "requiredLevel"]);
      }
    });
  });

  it("o rodapé fala de competências na régua, não de restritivas × não restritivas", async () => {
    renderWithApp(<TeamRulesPage />);
    await screen.findByText("Kubernetes");

    expect(screen.queryByText(/restritiva/i)).toBeNull();
    expect(screen.getByText(/1 competência na régua/)).toBeTruthy();
  });
});
