import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
);

import { apiPath } from "@/lib/api-path";
import { Route as SettingsRoute } from "@/routes/settings";
import { fixtureAdminUser, fixtureState } from "../helpers/fixtures";
import {
  TIME_PLATAFORMA,
  celulaDoMinimo,
  estadoCom,
  linhaDoNivel,
  niveisDeCarreiraRoute,
  regra,
} from "../helpers/politica-de-progressao";
import { mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 35, item 12 do dono (2026-09-02), literal: "Política › mínimo
 * qualificado acima do que existe: não deixar salvar + mensagem clicável para
 * cadastrar as que faltam; 'Capacidades' → 'Competências' no campo."
 *
 * Antes, o campo aceitava qualquer número e a tela só mostrava um texto
 * vermelho DEPOIS de salvo — a régua nascia inalcançável e ninguém era levado
 * ao lugar onde se resolve isso. A fixture tem 2 capacidades prontas.
 */

const fetchMock = vi.fn();
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

const gravacoes: unknown[] = [];

const gravaReguaRoute = (href: string, init?: RequestInit) => {
  if ((init?.method ?? "GET").toUpperCase() !== "PUT") return undefined;
  if (!href.includes(apiPath(`/teams/${TIME_PLATAFORMA}/rules/`))) return undefined;
  gravacoes.push(JSON.parse(String(init?.body)));
  return undefined;
};

const terceiraCapacidadePronta = {
  id: "integration",
  name: "Integration",
  short: "Integração",
  active: true,
  curation: { activeCompetencyCount: 2, status: "READY" as const },
};

/** O piso operacional de fábrica é 3; com 3 prontas o mínimo 3 é o alcançável. */
const umTimeComMinimoAlcancavel = () => ({
  ...estadoCom([regra("regra-plataforma-i", TIME_PLATAFORMA, 3)]),
  capabilities: [...fixtureState.capabilities, terceiraCapacidadePronta],
});
const umTimeComMinimoInalcancavel = () =>
  estadoCom([regra("regra-plataforma-i", TIME_PLATAFORMA, 3)]);

async function editarJunior(): Promise<HTMLTableRowElement> {
  const linha = await linhaDoNivel();
  await userEvent.click(within(linha).getByRole("button", { name: "Editar" }));
  return linha;
}

async function digitarMinimo(linha: HTMLElement, valor: string): Promise<void> {
  const campo = within(linha).getByRole("spinbutton");
  await userEvent.clear(campo);
  await userEvent.type(campo, valor);
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

describe("o mínimo qualificado não passa do que existe pronto", () => {
  it('o campo se chama "Mínimo de competências qualificadas"', async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: umTimeComMinimoAlcancavel(),
      routes: [niveisDeCarreiraRoute],
    });
    renderWithApp(<SettingsPage />);

    expect(
      await screen.findByRole("columnheader", { name: "Mínimo de competências qualificadas" }),
    ).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: /capacidades/i })).toBeNull();
  });

  it("acima do que existe pronto, Salvar apaga e a mensagem clicável leva à Matriz", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: umTimeComMinimoAlcancavel(),
      routes: [niveisDeCarreiraRoute, gravaReguaRoute],
    });
    renderWithApp(<SettingsPage />);

    const linha = await editarJunior();
    await digitarMinimo(linha, "6");

    const salvar = within(linha).getByRole("button", { name: "Salvar" });
    expect((salvar as HTMLButtonElement).disabled).toBe(true);

    const aviso = within(linha).getByRole("alert");
    const link = within(aviso).getByRole("link", {
      name: "Faltam 3 competências prontas — cadastrar na Matriz",
    });
    expect(link.getAttribute("href")).toBe("/competency-matrix");

    await userEvent.click(salvar);
    expect(gravacoes).toEqual([]);
  });

  it("dentro do que existe pronto, nada avisa e Salvar volta a acender", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: umTimeComMinimoAlcancavel(),
      routes: [niveisDeCarreiraRoute, gravaReguaRoute],
    });
    renderWithApp(<SettingsPage />);

    const linha = await editarJunior();
    await digitarMinimo(linha, "6");
    await digitarMinimo(linha, "3");

    expect(within(linha).queryByRole("alert")).toBeNull();
    expect(
      (within(linha).getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("uma régua já gravada acima do pronto mostra a mesma mensagem clicável, no singular", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: umTimeComMinimoInalcancavel(),
      routes: [niveisDeCarreiraRoute],
    });
    renderWithApp(<SettingsPage />);

    await celulaDoMinimo();
    const aviso = within(await linhaDoNivel()).getByRole("alert");
    const link = within(aviso).getByRole("link", {
      name: "Falta 1 competência pronta — cadastrar na Matriz",
    });
    expect(link.getAttribute("href")).toBe("/competency-matrix");
    expect(aviso.textContent).not.toMatch(/READY/);
  });
});
