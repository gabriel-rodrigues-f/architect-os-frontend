import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
);

import { apiPath } from "@/lib/api-path";
import { Route as SettingsRoute } from "@/routes/settings";
import {
  NIVEL_JUNIOR,
  TIME_PLATAFORMA,
  estadoCom,
  linhaDoNivel,
  niveisDeCarreiraRoute,
  regra,
} from "../helpers/politica-de-progressao";
import { jsonResponse, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * Onda 36.1 — pedido do dono, literal: *"a quantidade de capacidades minima de
 * um time não pode ser 3, tem que ser 1."* O backend já aceita 1
 * (`career.schemas`, migração 20260903500000000).
 *
 * O que segurava o 1 na tela era o piso OPERACIONAL (`career.minimumQualifiedFloor`,
 * 3 de fábrica) sendo usado como limite inferior do editor. Ele é o mínimo
 * PADRÃO — o que vale para o time que não acertou régua nenhuma —, não o menor
 * valor que uma régua pode ter. O editor passa a usar o piso do MODELO.
 */

const fetchMock = vi.fn();
const SettingsPage = SettingsRoute.options.component as () => ReactNode;

const gravacoes: unknown[] = [];

const reguaVigente = {
  id: "regra-plataforma-i",
  teamId: TIME_PLATAFORMA,
  careerLevelId: NIVEL_JUNIOR,
  minimumQualifiedCapabilities: 2,
  capabilityIds: [],
  competencies: [],
};

const reguaRoute = (href: string, init?: RequestInit) => {
  const rota = apiPath(`/teams/${TIME_PLATAFORMA}/rules/${NIVEL_JUNIOR}`);
  if (!href.endsWith(rota)) return undefined;
  const metodo = (init?.method ?? "GET").toUpperCase();
  if (metodo === "GET") return jsonResponse(reguaVigente);
  if (metodo !== "PUT") return undefined;
  const corpo = JSON.parse(String(init?.body)) as { minimumQualifiedCapabilities: number };
  gravacoes.push(corpo);
  return jsonResponse({ ...reguaVigente, ...corpo });
};

beforeEach(() => {
  fetchMock.mockReset();
  gravacoes.length = 0;
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    state: estadoCom([regra("regra-plataforma-i", TIME_PLATAFORMA, 2)]),
    routes: [reguaRoute, niveisDeCarreiraRoute],
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Política de Progressão — o mínimo de capacidades qualificadas aceita 1", () => {
  it("o campo declara 1 como menor valor, não o piso operacional", async () => {
    renderWithApp(<SettingsPage />);
    const linha = await linhaDoNivel();
    await userEvent.click(within(linha).getByRole("button", { name: "Editar" }));

    expect(within(linha).getByRole("spinbutton").getAttribute("min")).toBe("1");
  });

  it("digitar 1 mantém 'Salvar' aceso e grava o mínimo 1", async () => {
    renderWithApp(<SettingsPage />);
    const linha = await linhaDoNivel();
    await userEvent.click(within(linha).getByRole("button", { name: "Editar" }));

    const campo = within(linha).getByRole("spinbutton");
    await userEvent.clear(campo);
    await userEvent.type(campo, "1");

    const salvar = within(linha).getByRole("button", { name: "Salvar" });
    expect(salvar).toHaveProperty("disabled", false);

    await userEvent.click(salvar);
    await waitFor(() =>
      expect(gravacoes).toEqual([
        { minimumQualifiedCapabilities: 1, capabilityIds: [], competencies: [] },
      ]),
    );
  });

  it("zero continua recusado — 1 é o piso, não a ausência de régua", async () => {
    renderWithApp(<SettingsPage />);
    const linha = await linhaDoNivel();
    await userEvent.click(within(linha).getByRole("button", { name: "Editar" }));

    const campo = within(linha).getByRole("spinbutton");
    await userEvent.clear(campo);
    await userEvent.type(campo, "0");

    expect(within(linha).getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", true);
    expect(screen.queryByText("Salvando…")).toBeNull();
  });
});
