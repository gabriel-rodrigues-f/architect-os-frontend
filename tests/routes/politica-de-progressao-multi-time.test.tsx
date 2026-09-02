import { cleanup, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
);

import { Route as SettingsRoute } from "@/routes/settings";
import { fixtureAdminUser } from "../helpers/fixtures";
import {
  TIME_INTEGRACOES,
  TIME_PLATAFORMA,
  celulaDoMinimo,
  estadoCom,
  linhaDoNivel,
  niveisDeCarreiraRoute,
  regra,
} from "../helpers/politica-de-progressao";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * O travessão da coluna "mínimo de capacidades qualificadas" tem de significar
 * AUSÊNCIA, nunca ABUNDÂNCIA.
 *
 * Medido na tela do dono: com dois times na organização, admin e gestor
 * recebem DUAS réguas por nível de carreira e a tela mostra "—"; tech lead e
 * membro alcançam um time só, recebem UMA régua, e veem o número. Os dois
 * perfis de maior alcance viam MENOS que os de menor alcance, na mesma tela,
 * e "duas réguas que concordam" ficava indistinguível de "nenhuma régua".
 *
 * Sem seletor de time acionado (onda 32), o padrão "Todos os times" mantém
 * exatamente este agregado.
 */

const fetchMock = vi.fn();
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

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
        regra("regra-plataforma-i", TIME_PLATAFORMA, 3),
        regra("regra-integracoes-i", TIME_INTEGRACOES, 3),
      ]),
      routes: [niveisDeCarreiraRoute],
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
        regra("regra-plataforma-i", TIME_PLATAFORMA, 3),
        regra("regra-integracoes-i", TIME_INTEGRACOES, 5),
      ]),
      routes: [niveisDeCarreiraRoute],
    });
    renderWithApp(<SettingsPage />);

    const celula = await celulaDoMinimo();
    expect(celula.textContent).toContain("3");
    expect(celula.textContent).toContain("5");
    expect(celula.textContent).not.toContain("—");
    expect(await within(await linhaDoNivel()).findByText(/varia/i)).toBeTruthy();
  });

  /**
   * O mesmo silêncio, no aviso: com N réguas `minimum` era `undefined`, e o
   * alerta de "a política exige mais capacidades do que existem prontas"
   * simplesmente não aparecia para quem alcança dois times. A régua vinculante
   * é a MAIS ALTA — 5 exigidas contra 2 capacidades READY na fixture.
   */
  it("continua avisando que a régua é inalcançável, pelo maior mínimo entre os times", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: estadoCom([
        regra("regra-plataforma-i", TIME_PLATAFORMA, 3),
        regra("regra-integracoes-i", TIME_INTEGRACOES, 5),
      ]),
      routes: [niveisDeCarreiraRoute],
    });
    renderWithApp(<SettingsPage />);

    const alerta = await within(await linhaDoNivel()).findByRole("alert");
    expect(alerta.textContent).toContain("Faltam 3 competências prontas");
  });

  it("o travessão fica reservado para quando nenhum time definiu régua", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: estadoCom([]),
      routes: [niveisDeCarreiraRoute],
    });
    renderWithApp(<SettingsPage />);

    const celula = await celulaDoMinimo();
    expect(celula.textContent).toContain("—");
    expect(within(await linhaDoNivel()).getByText(/régua de cada time/i)).toBeTruthy();
  });

  it("com N réguas o admin não fica com um botão de salvar que não salva — a tela diz onde se configura", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: estadoCom([
        regra("regra-plataforma-i", TIME_PLATAFORMA, 3),
        regra("regra-integracoes-i", TIME_INTEGRACOES, 3),
      ]),
      routes: [niveisDeCarreiraRoute],
    });
    renderWithApp(<SettingsPage />);

    const linha = await linhaDoNivel();
    expect(within(linha).queryByRole("button", { name: "Editar" })).toBeNull();
    expect(within(linha).getByText(/régua de cada time/i)).toBeTruthy();
  });

  it("com UMA régua o admin continua editando pela própria tela", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: estadoCom([regra("regra-plataforma-i", TIME_PLATAFORMA, 3)]),
      routes: [niveisDeCarreiraRoute],
    });
    renderWithApp(<SettingsPage />);

    const linha = await linhaDoNivel();
    expect(within(linha).getByRole("button", { name: "Editar" })).toBeTruthy();
  });
});
