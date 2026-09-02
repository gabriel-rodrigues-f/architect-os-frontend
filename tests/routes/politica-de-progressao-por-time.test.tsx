import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { Route as SettingsRoute } from "@/routes/settings";
import { fixtureAdminUser, fixtureAssignedTechLeadUser } from "../helpers/fixtures";
import {
  NIVEL_JUNIOR,
  NIVEL_PLENO,
  TIME_INTEGRACOES,
  TIME_PLATAFORMA,
  celulaDoMinimo,
  doisTimesRoute,
  estadoCom,
  linhaDoNivel,
  niveisDeCarreiraRoute,
  regra,
} from "../helpers/politica-de-progressao";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Pedido literal do dono (2026-09-02): "essa tela precisa levar em
 * consideração o time selecionado".
 *
 * A onda 27 fez a Política de Progressão AGREGAR as réguas de todos os times
 * por nível ("3 · 5 / varia entre os times"), e com isso o admin perdeu o
 * botão de editar sempre que há mais de um time — a tela não sabia em qual
 * time gravar. O seletor de time resolve a ambiguidade: "Todos os times" é o
 * padrão e mantém o agregado; time escolhido mostra a régua EXATA daquele
 * time e grava nele.
 */

const fetchMock = vi.fn();
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

const reguaDeIntegracoesJunior = {
  id: "regra-integracoes-i",
  teamId: TIME_INTEGRACOES,
  careerLevelId: NIVEL_JUNIOR,
  minimumQualifiedCapabilities: 5,
  capabilityIds: ["cloud"],
  competencies: [],
};

const gravacoes: { url: string; body: unknown }[] = [];

const reguasDeIntegracoesRoute: FetchRoute = (href, init) => {
  const metodo = (init?.method ?? "GET").toUpperCase();
  if (!href.includes(apiPath(`/teams/${TIME_INTEGRACOES}/rules/`))) return undefined;
  if (metodo === "PUT") {
    gravacoes.push({ url: href, body: JSON.parse(String(init?.body)) });
    const careerLevelId = href.split("/rules/")[1] as string;
    return jsonResponse({
      ...reguaDeIntegracoesJunior,
      id: `regra-integracoes-${careerLevelId}`,
      careerLevelId,
      minimumQualifiedCapabilities: (
        JSON.parse(String(init?.body)) as { minimumQualifiedCapabilities: number }
      ).minimumQualifiedCapabilities,
    });
  }
  if (href.endsWith(NIVEL_JUNIOR)) return jsonResponse(reguaDeIntegracoesJunior);
  return jsonResponse(
    { code: "TeamRuleNotFoundError", message: "Este time não tem régua para o nível." },
    404,
  );
};

const doisTimesDivergem = () =>
  estadoCom([
    regra("regra-plataforma-i", TIME_PLATAFORMA, 3),
    regra("regra-integracoes-i", TIME_INTEGRACOES, 5),
    regra("regra-plataforma-ii", TIME_PLATAFORMA, 4, NIVEL_PLENO),
  ]);

const seletorDeTime = () => screen.findByLabelText("Time", { selector: "button" });

async function escolherTime(nome: string): Promise<void> {
  await userEvent.click(await seletorDeTime());
  await userEvent.click(screen.getByRole("option", { name: nome }));
}

beforeEach(() => {
  fetchMock.mockReset();
  gravacoes.length = 0;
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Política de Progressão leva em consideração o time selecionado", () => {
  it('"Todos os times" é o padrão e mantém o agregado da onda 27', async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: doisTimesDivergem(),
      routes: [niveisDeCarreiraRoute, doisTimesRoute],
    });
    renderWithApp(<SettingsPage />);

    const celula = await celulaDoMinimo();
    expect((await seletorDeTime()).textContent).toContain("Todos os times");
    expect(celula.textContent).toContain("3");
    expect(celula.textContent).toContain("5");
    expect(await within(await linhaDoNivel()).findByText(/varia/i)).toBeTruthy();
  });

  it("escolher um time mostra a régua EXATA daquele time por nível, sem 'varia'", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: doisTimesDivergem(),
      routes: [niveisDeCarreiraRoute, doisTimesRoute],
    });
    renderWithApp(<SettingsPage />);
    await celulaDoMinimo();

    await escolherTime("Integrações");

    const celula = await celulaDoMinimo();
    expect(celula.textContent).toContain("5");
    expect(celula.textContent).not.toContain("3");
    expect(within(await linhaDoNivel()).queryByText(/varia/i)).toBeNull();
    expect(within(await linhaDoNivel()).getByText(/pelo menos 5/)).toBeTruthy();
  });

  it("com o time escolhido o admin volta a editar, e o salvar grava NAQUELE time", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: doisTimesDivergem(),
      routes: [niveisDeCarreiraRoute, doisTimesRoute, reguasDeIntegracoesRoute],
    });
    renderWithApp(<SettingsPage />);
    await celulaDoMinimo();

    await escolherTime("Integrações");

    const linha = await linhaDoNivel();
    await userEvent.click(within(linha).getByRole("button", { name: "Editar" }));
    const campo = within(linha).getByRole("spinbutton");
    await userEvent.clear(campo);
    await userEvent.type(campo, "6");
    await userEvent.click(within(linha).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(gravacoes).toHaveLength(1));
    expect(gravacoes[0]?.url).toContain(
      apiPath(`/teams/${TIME_INTEGRACOES}/rules/${NIVEL_JUNIOR}`),
    );
    expect(gravacoes[0]?.body).toMatchObject({ minimumQualifiedCapabilities: 6 });
  });

  it("nível sem régua no time escolhido: a tela diz de quem é a ausência e deixa o admin criar a régua", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: doisTimesDivergem(),
      routes: [niveisDeCarreiraRoute, doisTimesRoute, reguasDeIntegracoesRoute],
    });
    renderWithApp(<SettingsPage />);
    await celulaDoMinimo();

    await escolherTime("Integrações");

    const linha = await linhaDoNivel("Pleno");
    expect((await celulaDoMinimo("Pleno")).textContent).toContain("—");
    expect(within(linha).getByText(/Integrações ainda não definiu régua para Pleno/)).toBeTruthy();

    await userEvent.click(within(linha).getByRole("button", { name: "Editar" }));
    const campo = within(linha).getByRole("spinbutton");
    await userEvent.clear(campo);
    await userEvent.type(campo, "4");
    await userEvent.click(within(linha).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(gravacoes).toHaveLength(1));
    expect(gravacoes[0]?.url).toContain(apiPath(`/teams/${TIME_INTEGRACOES}/rules/${NIVEL_PLENO}`));
    expect(gravacoes[0]?.body).toMatchObject({ minimumQualifiedCapabilities: 4 });
  });

  it("cancelar a edição devolve o rascunho ao mínimo do time, nunca a '[object Object]'", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: doisTimesDivergem(),
      routes: [niveisDeCarreiraRoute, doisTimesRoute, reguasDeIntegracoesRoute],
    });
    renderWithApp(<SettingsPage />);
    await celulaDoMinimo();

    await escolherTime("Integrações");

    const linha = await linhaDoNivel();
    await userEvent.click(within(linha).getByRole("button", { name: "Editar" }));
    const campo = within(linha).getByRole("spinbutton");
    await userEvent.clear(campo);
    await userEvent.type(campo, "9");
    await userEvent.click(within(linha).getByRole("button", { name: "Cancelar" }));
    await userEvent.click(within(linha).getByRole("button", { name: "Editar" }));

    expect((within(linha).getByRole("spinbutton") as HTMLInputElement).value).toBe("5");
  });

  it("o tech lead só escolhe entre os times que alcança", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state: doisTimesDivergem(),
      routes: [niveisDeCarreiraRoute, doisTimesRoute],
    });
    renderWithApp(<SettingsPage />);
    await celulaDoMinimo();

    await userEvent.click(await seletorDeTime());

    expect(screen.getByRole("option", { name: "Todos os times" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Plataforma" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Integrações" })).toBeNull();
  });
});
