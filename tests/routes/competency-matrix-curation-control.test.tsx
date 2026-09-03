import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AppState } from "@/lib/api";
import type { Capability, Competency } from "@/lib/domain";
import { Route as MatrixRoute } from "@/routes/competency-matrix";
import { fixtureState } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 35, achado 3 do dono: "Matriz › {capacidade}: badge 'Pronta' pequeno
 * demais (mesma fonte dos botões) e sem ação".
 *
 * O contrato (`api-contract.gen.ts`) não tem rota de mudança de curadoria:
 * `PATCH /capabilities/{id}` aceita só name/short/active, e o status é
 * DERIVADO — o backend o calcula por contagem de ativas contra o teto da
 * política (`CurationCounts.statusFor`). Então o controle é legível (mesma
 * tipografia dos botões vizinhos) e, ao clicar, EXPLICA o status e o que o
 * muda; ele não dispara escrita nenhuma.
 */

const fetchMock = vi.fn();

const overCapability: Capability = {
  id: "over",
  name: "Over Capability",
  short: "Over",
  active: true,
  curation: { activeCompetencyCount: 7, status: "REQUIRES_CURATION" },
};

const overCompetencies: Competency[] = [1, 2, 3, 4, 5, 6, 7].map((index) => ({
  id: `over-${index}`,
  name: `Competência ${index}`,
  capabilityId: "over",
  active: true,
}));

const state: AppState = {
  ...fixtureState,
  capabilities: [...fixtureState.capabilities, overCapability],
  competencies: [...fixtureState.competencies, ...overCompetencies],
};

const MatrixPage = MatrixRoute.options.component as () => ReactNode;

const cardOf = (name: string) => {
  const card = screen.getByText(name).closest(".surface-card");
  if (!card) throw new Error(`card de ${name} não encontrado`);
  return within(card as HTMLElement);
};

describe("Matriz de Competências — o status de curadoria é um controle, não um badge", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { state, routes: [careerLevelsRoute] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("'Pronta' é um botão com a mesma tipografia de 'Nova competência'", async () => {
    renderWithApp(<MatrixPage />);
    await screen.findByText("Cloud Architecture");

    const cloud = cardOf("Cloud Architecture");
    const status = cloud.getByRole("button", { name: /Pronta/ });
    const neighbour = cloud.getByRole("button", { name: "Nova competência" });

    const sizeTokens = (element: HTMLElement) =>
      element.className.split(/\s+/).filter((token) => /^(h-|text-)/.test(token));
    expect(sizeTokens(status)).toEqual(sizeTokens(neighbour));
    expect(status.className).not.toContain("text-[10px]");
  });

  it("clicar em 'Pronta' explica o status: dentro do teto, e o que o mudaria", async () => {
    renderWithApp(<MatrixPage />);
    await screen.findByText("Cloud Architecture");

    await userEvent.click(cardOf("Cloud Architecture").getByRole("button", { name: /Pronta/ }));

    const explanation = await screen.findByRole("dialog");
    expect(explanation.textContent).toContain("2 de 4 competências ativas");
    expect(explanation.textContent).toContain("pronta é ter de 1 até 4");
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("clicar em 'Requer curadoria' diz quantas estão acima do teto e como voltar a 'Pronta'", async () => {
    renderWithApp(<MatrixPage />);
    await screen.findByText("Over Capability");

    await userEvent.click(
      cardOf("Over Capability").getByRole("button", { name: /Requer curadoria/ }),
    );

    const explanation = await screen.findByRole("dialog");
    expect(explanation.textContent).toContain("7 de 4 competências ativas");
    expect(explanation.textContent).toContain("3 acima do máximo");
    expect(explanation.textContent).toMatch(/arquive ou exclua/i);
  });
});
