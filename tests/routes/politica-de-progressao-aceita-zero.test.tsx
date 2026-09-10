import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () =>
  import("../helpers/react-router-mock").then((mod) => mod.reactRouterWithPlainLinks()),
);

import { apiPath } from "@/lib/api-path";
import { Route as EligibilityRoute } from "@/routes/eligibility";
import { fixtureAssignedManagerUser } from "../helpers/fixtures";
import {
  NIVEL_JUNIOR,
  TIME_PLATAFORMA,
  estadoCom,
  linhaDoNivel,
  niveisDeCarreiraRoute,
  regra,
} from "../helpers/politica-de-progressao";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Dono (2026-09-08, regra 12), literal: *"vamos manter a configuração de
 * capacidade mínima por perfil por time, apenas vamos remover a regra de que 3
 * é o mínimo. Não haverá mais valor mínimo."*
 *
 * Esta suíte era a da onda 36.1, que provava o piso 1 (*"não pode ser 3, tem
 * que ser 1"*). O piso caiu de novo, e desta vez acabou: ZERO é um valor de
 * negócio — existe Trainee que não exige capacidade qualificada nenhuma —, e a
 * tela precisa dizer isso sem parecer erro.
 *
 * O que NÃO mudou, e é o que o último caso guarda: o piso OPERACIONAL
 * (`career.minimumQualifiedFloor`) continua sendo o mínimo PADRÃO — o que vale
 * para o time que não acertou régua nenhuma, e o valor que o editor sugere —,
 * nunca o menor valor que uma régua pode ter. Usá-lo como limite era a
 * organização decidindo a régua do time pela porta dos fundos.
 *
 * Revisão de papéis (dono, 2026-09-05, D1): quem edita a régua é o gerente
 * COM vínculo no time — o admin só a lê. O ator aqui é o gerente de Plataforma.
 */

const fetchMock = vi.fn();
const EligibilityPage = EligibilityRoute.options.component as () => ReactNode;

/** GET /config/settings com PISO OPERACIONAL 4 — o valor sugerido, não o limite. */
const pisoOperacionalDe =
  (piso: number): FetchRoute =>
  (href, init) =>
    href.endsWith(apiPath("/config/settings")) && (init?.method ?? "GET") === "GET"
      ? jsonResponse({
          settings: [
            {
              key: "career.minimumQualifiedFloor",
              value: piso,
              valueType: "int",
              scope: "operational",
              description: null,
              updatedAt: "2026-08-26T00:00:00Z",
              updatedBy: null,
            },
          ],
        })
      : undefined;

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
    user: fixtureAssignedManagerUser,
    state: estadoCom([regra("regra-plataforma-i", TIME_PLATAFORMA, 2)]),
    routes: [reguaRoute, niveisDeCarreiraRoute],
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Política de Progressão — o mínimo de capacidades qualificadas acabou", () => {
  it("o campo declara ZERO como menor valor, não o piso operacional", async () => {
    renderWithApp(<EligibilityPage />);
    const linha = await linhaDoNivel();
    await userEvent.click(within(linha).getByRole("button", { name: "Editar" }));

    expect(within(linha).getByRole("spinbutton").getAttribute("min")).toBe("0");
  });

  it("digitar 1 mantém 'Salvar' aceso e grava o mínimo 1", async () => {
    renderWithApp(<EligibilityPage />);
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

  it("digitar ZERO mantém 'Salvar' aceso e grava zero — não é régua faltando, é régua que não exige capacidade", async () => {
    renderWithApp(<EligibilityPage />);
    const linha = await linhaDoNivel();
    await userEvent.click(within(linha).getByRole("button", { name: "Editar" }));

    const campo = within(linha).getByRole("spinbutton");
    await userEvent.clear(campo);
    await userEvent.type(campo, "0");

    const salvar = within(linha).getByRole("button", { name: "Salvar" });
    expect(salvar).toHaveProperty("disabled", false);

    await userEvent.click(salvar);
    await waitFor(() =>
      expect(gravacoes).toEqual([
        { minimumQualifiedCapabilities: 0, capabilityIds: [], competencies: [] },
      ]),
    );
  });

  it("negativo continua recusado — zero é ausência de exigência, -1 é lixo", async () => {
    renderWithApp(<EligibilityPage />);
    const linha = await linhaDoNivel();
    await userEvent.click(within(linha).getByRole("button", { name: "Editar" }));

    const campo = within(linha).getByRole("spinbutton");
    await userEvent.clear(campo);
    await userEvent.type(campo, "-1");

    expect(within(linha).getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", true);
    expect(screen.queryByText("Salvando…")).toBeNull();
  });

  /**
   * Vinha de `settings-operational.test.tsx`, e mudou de casa junto com a
   * tela: desde a fatia do GRUPO (dono, 2026-09-10) o piso operacional mora em
   * "Réguas e limiares" e a régua do time em "Elegibilidade" — duas rotas,
   * dois donos. O que este caso guarda é justamente que uma não manda na
   * outra: o piso é o valor SUGERIDO, nunca o menor valor gravável.
   */
  it("o piso operacional NÃO rege o campo da régua: o piso do modelo continua ZERO", async () => {
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: estadoCom([regra("regra-plataforma-i", TIME_PLATAFORMA, 2)]),
      routes: [reguaRoute, niveisDeCarreiraRoute, pisoOperacionalDe(4)],
    });
    renderWithApp(<EligibilityPage />);
    const linha = await linhaDoNivel();
    await userEvent.click(within(linha).getByRole("button", { name: "Editar" }));

    const campo = within(linha).getByRole("spinbutton");
    expect(campo.getAttribute("min")).toBe("0");

    await userEvent.clear(campo);
    await userEvent.type(campo, "1");
    expect(within(linha).getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", false);
  });
});
