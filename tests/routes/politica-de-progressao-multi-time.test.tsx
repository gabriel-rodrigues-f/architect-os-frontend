import { cleanup, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppState, TeamLevelRule } from "@/lib/api";
import { Route as SettingsRoute } from "@/routes/settings";
import { fixtureAdminUser, fixtureState, fixtureTeamId } from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * O travessão da coluna "mínimo de capacidades qualificadas" tem de significar
 * AUSÊNCIA, nunca ABUNDÂNCIA.
 *
 * Medido na tela do dono: com dois times na organização, admin e gestor
 * recebem DUAS réguas por nível de carreira e a tela mostra "—"; tech lead e
 * membro alcançam um time só, recebem UMA régua, e veem o número. Os dois
 * perfis de maior alcance viam MENOS que os de menor alcance, na mesma tela,
 * e "duas réguas que concordam" ficava indistinguível de "nenhuma régua".
 */

const fetchMock = vi.fn();
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

const OUTRO_TIME = "time-integracoes";
const NIVEL_I = "arquiteto-de-solucoes-i";

const regra = (id: string, teamId: string, minimo: number): TeamLevelRule => ({
  id,
  teamId,
  careerLevelId: NIVEL_I,
  minimumQualifiedCapabilities: minimo,
});

/** O `/state` que o servidor manda para quem alcança N times. */
const estadoCom = (regras: readonly TeamLevelRule[]): AppState => ({
  ...fixtureState,
  teamLevelRules: [
    ...fixtureState.teamLevelRules.filter((r) => r.careerLevelId !== NIVEL_I),
    ...regras,
  ],
});

/** A célula do mínimo na linha do nível de carreira. */
async function celulaDoMinimo(nivel = "Arquiteto de Soluções I"): Promise<HTMLElement> {
  const nome = await screen.findByText(nivel);
  const linha = nome.closest("tr") as HTMLTableRowElement;
  return linha.querySelectorAll("td")[1] as HTMLElement;
}

async function linhaDoNivel(nivel = "Arquiteto de Soluções I"): Promise<HTMLTableRowElement> {
  const nome = await screen.findByText(nivel);
  return nome.closest("tr") as HTMLTableRowElement;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Política de Progressão com mais de um time no alcance", () => {
  it("mostra o valor quando as réguas dos times CONCORDAM", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: estadoCom([
        regra("regra-plataforma-i", fixtureTeamId, 3),
        regra("regra-integracoes-i", OUTRO_TIME, 3),
      ]),
      routes: [careerLevelsRoute],
    });
    renderWithApp(<SettingsPage />);

    const celula = await celulaDoMinimo();
    expect(celula.textContent).toContain("3");
    expect(celula.textContent).not.toContain("—");
  });

  it("não esconde a divergência atrás de travessão: diz que varia e mostra os valores", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: estadoCom([
        regra("regra-plataforma-i", fixtureTeamId, 3),
        regra("regra-integracoes-i", OUTRO_TIME, 5),
      ]),
      routes: [careerLevelsRoute],
    });
    renderWithApp(<SettingsPage />);

    const celula = await celulaDoMinimo();
    expect(celula.textContent).toContain("3");
    expect(celula.textContent).toContain("5");
    expect(celula.textContent).not.toContain("—");
    expect(await within(await linhaDoNivel()).findByText(/varia/i)).toBeTruthy();
  });

  it("o travessão fica reservado para quando nenhum time definiu régua", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: estadoCom([]),
      routes: [careerLevelsRoute],
    });
    renderWithApp(<SettingsPage />);

    const celula = await celulaDoMinimo();
    expect(celula.textContent).toContain("—");
  });

  it("com N réguas o admin não fica com um botão de salvar que não salva — a tela diz onde se configura", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: estadoCom([
        regra("regra-plataforma-i", fixtureTeamId, 3),
        regra("regra-integracoes-i", OUTRO_TIME, 3),
      ]),
      routes: [careerLevelsRoute],
    });
    renderWithApp(<SettingsPage />);

    const linha = await linhaDoNivel();
    expect(within(linha).queryByRole("button", { name: "Editar" })).toBeNull();
    expect(within(linha).getByText(/régua de cada time/i)).toBeTruthy();
  });

  it("com UMA régua o admin continua editando pela própria tela", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: estadoCom([regra("regra-plataforma-i", fixtureTeamId, 3)]),
      routes: [careerLevelsRoute],
    });
    renderWithApp(<SettingsPage />);

    const linha = await linhaDoNivel();
    expect(within(linha).getByRole("button", { name: "Editar" })).toBeTruthy();
  });
});
