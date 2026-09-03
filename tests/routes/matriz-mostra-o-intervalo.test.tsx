import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import type { Capability } from "@/lib/domain";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { fixtureState } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Onda 36.1/37, item 3 — o intervalo do modelo aparece inteiro na tela: o
 * contador diz quantas de quantas E qual é o piso, a capacidade abaixo do piso
 * diz que está abaixo dele e oferece a saída, e a que passou do teto recebe a
 * recusa DO SERVIÇO em vez de um botão morto.
 *
 * A política deste arquivo diz 4 — o piso continua sendo o do modelo (3). Se
 * algum número estiver escrito na tela, este arquivo o pega.
 */

const fetchMock = vi.fn();
const MatrixPage = MatrixRoute.options.component as () => ReactNode;

const curationPolicyMax4: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/config/curation-policy")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse({ maxActiveCompetencies: 4 })
    : undefined;

const limitRefusal =
  'A capacidade "Full Capability" já está no limite de 4 competências ativas — arquive uma competência antes de ativar outra.';

const refuseCompetencyCreation: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/competencies")) && init?.method === "POST"
    ? jsonResponse(
        {
          code: "CAPABILITY_COMPETENCY_LIMIT_REACHED",
          message: limitRefusal,
          correlationId: "x",
        },
        409,
      )
    : undefined;

const belowMinimum: Capability = {
  id: "below",
  name: "Data Platforms",
  short: "Data",
  active: true,
  curation: { activeCompetencyCount: 1, status: "REQUIRES_CURATION" },
};

const atMaximum: Capability = {
  id: "full",
  name: "Full Capability",
  short: "Full",
  active: true,
  curation: { activeCompetencyCount: 4, status: "READY" },
};

const state: AppState = {
  ...fixtureState,
  capabilities: [...fixtureState.capabilities, belowMinimum, atMaximum],
};

const cardOf = (name: string) => {
  const card = screen.getByText(name).closest(".surface-card");
  if (!card) throw new Error(`card de ${name} não encontrado`);
  return within(card as HTMLElement);
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Matriz — o intervalo do modelo aparece na tela", () => {
  it("o contador mostra quantas de quantas E o mínimo, os dois vindos da política", async () => {
    mockAppFetch(fetchMock, { state, routes: [careerLevelsRoute, curationPolicyMax4] });
    renderWithApp(<MatrixPage />);
    await screen.findByText("Cloud Architecture");

    expect(cardOf("Cloud Architecture").getByText("2/4 · mín. 3")).toBeTruthy();
    expect(screen.queryByText(/\/6/)).toBeNull();
  });

  it("abaixo do mínimo, a curadoria diz isso e oferece 'Nova competência'", async () => {
    mockAppFetch(fetchMock, { state, routes: [careerLevelsRoute, curationPolicyMax4] });
    renderWithApp(<MatrixPage />);
    await screen.findByText("Data Platforms");

    const status = cardOf("Data Platforms").getByRole("button", {
      name: "Requer curadoria: abaixo do mínimo de 3",
    });
    await userEvent.click(status);

    const explanation = await screen.findByRole("dialog");
    expect(explanation.textContent).toContain("abaixo do mínimo de 3");
    await userEvent.click(within(explanation).getByRole("button", { name: "Nova competência" }));

    expect(await screen.findByText("Nova competência em Data Platforms")).toBeTruthy();
  });

  it("no teto, 'Nova competência' continua acessível e a recusa vem do serviço", async () => {
    mockAppFetch(fetchMock, {
      state,
      routes: [refuseCompetencyCreation, careerLevelsRoute, curationPolicyMax4],
    });
    renderWithApp(<MatrixPage />);
    await screen.findByText("Full Capability");

    const novaCompetencia = cardOf("Full Capability").getByRole("button", {
      name: "Nova competência",
    });
    expect(novaCompetencia).toHaveProperty("disabled", false);

    await userEvent.click(novaCompetencia);
    await userEvent.type(screen.getByLabelText("Nome"), "A sétima");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText(limitRefusal)).toBeTruthy();
  });
});
