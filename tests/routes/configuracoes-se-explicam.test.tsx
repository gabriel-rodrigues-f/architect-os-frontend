import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
);

import { Route as SettingsRoute } from "@/routes/settings";
import { fixtureAdminUser } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 35, item 13 do dono (2026-09-02), literal: "Grupos de configuração
 * (Severidade de distância, Risco de concentração, Catálogo, Textos, Operação,
 * Tipos de item de trilha, Tipos de ação do PDI, Vocabulários) ganham '?'
 * explicando finalidade e como configurar."
 *
 * É o mesmo `?` do cabeçalho de página, descido para o título de cada grupo:
 * um botão "Como configurar {grupo}" que abre finalidade e passo a passo.
 */

const fetchMock = vi.fn();
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

const GRUPOS_QUE_O_DONO_NOMEOU = [
  "Severidade de distância",
  "Risco de concentração",
  "Catálogo",
  "Textos",
  "Operação",
  "Tipos de item de trilha",
  "Tipos de ação do PDI",
  "Vocabulários",
] as const;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, { user: fixtureAdminUser, routes: [careerLevelsRoute] });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("cada grupo de configuração se explica", () => {
  it.each(GRUPOS_QUE_O_DONO_NOMEOU)('"%s" tem o ? ao lado do título', async (grupo) => {
    renderWithApp(<SettingsPage />);
    await screen.findByText("Vocabulários");

    expect(screen.getByRole("button", { name: `Como configurar ${grupo}` })).toBeTruthy();
  });

  it("o ? abre a finalidade e o como configurar do grupo", async () => {
    renderWithApp(<SettingsPage />);
    await screen.findByText("Vocabulários");

    await userEvent.click(screen.getByRole("button", { name: "Como configurar Vocabulários" }));

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo.textContent).toContain("Para que serve");
    expect(dialogo.textContent).toContain("Como configurar");
    expect(dialogo.textContent).toMatch(/listas de opções/);
  });
});
