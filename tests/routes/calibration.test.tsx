import { cleanup, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as CalibrationRoute } from "@/routes/calibration";
import { requireAdminReach } from "@/lib/route-guards";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Tela 3 (spec §3) — calibração entre líderes, distribuição de notas por
 * avaliador LADO A LADO. CONTRATO PRD-03: visível só para gestor + admin.
 * TODO nominal da spec: hoje o papel `lead` não distingue gestor de tech
 * lead, então a rota fica ADMIN-ONLY (`requireAdminReach`) até o modelo de
 * 4 perfis existir (onda 12+) — abrir para gestor é trocar a guarda, e este
 * teste é o lembrete vivo dessa decisão.
 *
 * Os dados vêm do InMemoryCalibrationGateway (PRD-03 backend na onda 21):
 * Marina 4.00 (leniente), Ricardo 3.00 (central), Paula 2.13 (severa) —
 * média geral ~3.12; Marina e Paula passam do limiar de alerta (0.5).
 */
const fetchMock = vi.fn();

const CalibrationPage = CalibrationRoute.options.component as () => ReactNode;

describe("/calibration — distribuição de notas por avaliador", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, { user: fixtureAdminUser, state: fixtureState });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a rota é admin-only pela guarda compartilhada (gestor entra com os 4 perfis)", () => {
    expect(CalibrationRoute.options.beforeLoad).toBe(requireAdminReach);
  });

  it("mostra os 3 avaliadores lado a lado, do mais desviante para o menos", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByText("Marina Lopes");
    const names = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(["Paula Souza", "Marina Lopes", "Ricardo Nunes"]);
  });

  it("quem passa do limiar leva o aviso de desvio; quem está na média, não", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByText("Marina Lopes");
    const cardOf = (name: string) =>
      screen.getByText(name).closest("[data-evaluator-card]") as HTMLElement;
    expect(within(cardOf("Marina Lopes")).getByRole("status")).toBeTruthy();
    expect(within(cardOf("Paula Souza")).getByRole("status")).toBeTruthy();
    expect(within(cardOf("Ricardo Nunes")).queryByRole("status")).toBeNull();
  });

  it("linha de contexto: média geral, nº de avaliadores e nº de avaliações", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByText("Marina Lopes");
    expect(screen.getByText("Média geral").parentElement?.textContent).toContain("3.12");
    expect(screen.getByText("Avaliadores").parentElement?.textContent).toContain("3");
    expect(screen.getByText("Avaliações").parentElement?.textContent).toContain("10");
  });

  it("cada card expõe a distribuição como tabela acessível (segundo canal além do gráfico)", async () => {
    renderWithApp(<CalibrationPage />);
    await screen.findByText("Marina Lopes");
    const marina = screen.getByText("Marina Lopes").closest("[data-evaluator-card]") as HTMLElement;
    const table = within(marina).getByRole("table");
    expect(table.textContent).toContain("L4");
  });
});
