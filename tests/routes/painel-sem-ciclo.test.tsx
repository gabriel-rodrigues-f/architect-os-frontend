import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesma razão de `dashboard-roles.test.tsx`: `<Link>` exige RouterProvider
 * real. Aqui o `to` vira `href`, porque o destino do botão É a asserção.
 */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { Route as DashboardRoute } from "@/routes/index";
import type { AppState, SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import {
  fixtureSupportUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureState,
} from "../helpers/fixtures";
import { executiveBriefingRoute } from "../helpers/executive-briefing";
import {
  type FetchRoute,
  jsonResponse,
  mockAppFetch,
  operationsOverviewFor,
  renderWithApp,
} from "../helpers/render-app";

/**
 * Onda 35, achado 1 do dono (literal): "Painel sem ciclo cadastrado mostra
 * seletor vazio → mensagem 'não há ciclos cadastrados' + botão 'Cadastrar
 * ciclo' → tela de ciclos."
 *
 * Antes: o Painel do admin desenhava "Ciclo —" e oito cartões em zero; o da
 * liderança, quatro filas vazias. Nenhum dos dois dizia que o motivo era não
 * existir ciclo nenhum. Só o ramo vazio muda: com ciclo cadastrado, o Painel
 * de cada persona continua o que era.
 *
 * Revisão de papéis (dono, 2026-09-05, D1): o Painel do admin virou o Painel
 * de operação, e nele o ciclo é um CARTÃO ("Ciclo vigente"): sem ciclo ativo
 * o cartão diz "Nenhum ciclo ativo" e o atalho de Ciclos leva a /cycles. A
 * mensagem + botão "Cadastrar Ciclo" segue sendo a resposta da liderança.
 *
 * ONDA 3 — quem DESCOBRE a ausência mudou de lado. A liderança não soma mais
 * nada no navegador: ela pede a leitura do ciclo e o servidor responde "não
 * existe". A tela continua respondendo a mesma coisa — o bloco de vazio com o
 * botão —, e é isso que estes casos afirmam. A Visão do Sistema (agora do
 * SUPORTE, e com endereço próprio) continua lendo `/operations/overview`.
 */
const fetchMock = vi.fn();

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

const estadoSemCiclo: AppState = { ...fixtureState, cycles: [], activeCycleId: "" };

const MENSAGEM = "Nenhum ciclo cadastrado";
const BOTAO = "Cadastrar Ciclo";

/** O panorama espelha o estado: sem ciclo ativo no `/state`, `cycle` é nulo. */
const panoramaRoute =
  (state: AppState): FetchRoute =>
  (href) =>
    href.endsWith(apiPath("/operations/overview"))
      ? jsonResponse(
          operationsOverviewFor(
            state.activeCycleId ? { id: state.activeCycleId, name: "2026 H2" } : null,
          ),
        )
      : undefined;

/**
 * A leitura executiva quando NÃO HÁ CICLO: o servidor responde a recusa de
 * inexistente, byte a byte igual à de alcance (regra 18 do dono) — e a tela
 * NÃO a lê como ausência. Quem responde "não há ciclo" é o catálogo de ciclos
 * do contexto, e é por isso que o estado vazio aparece antes de qualquer
 * leitura chegar.
 */
const semCicloRoute: FetchRoute = (href) =>
  href.includes(apiPath("/dashboard/executive"))
    ? jsonResponse({ code: "NOT_FOUND", message: "Ciclo de desenvolvimento não encontrado." }, 404)
    : undefined;

function prepararPainel(user: SessionUser, state: AppState) {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  const leitura = state.cycles.length === 0 ? semCicloRoute : executiveBriefingRoute;
  mockAppFetch(fetchMock, { user, state, routes: [leitura, panoramaRoute(state)] });
  renderWithApp(<DashboardPage />);
}

describe("Painel sem nenhum ciclo cadastrado", () => {
  beforeEach(() => {
    window.localStorage.setItem("synapse:locale", "pt");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    ["gerente", fixtureAssignedManagerUser],
    ["tech lead", fixtureAssignedTechLeadUser],
  ])("%s vê a mensagem e o botão que leva a /cycles", async (_papel, user) => {
    prepararPainel(user, estadoSemCiclo);

    expect(await screen.findByText(MENSAGEM)).toBeTruthy();
    const botao = screen.getByRole("link", { name: BOTAO });
    expect(botao.getAttribute("href")).toBe("/cycles");
  });

  it("D1 (dono, 2026-09-05): o admin sem ciclo vê 'Nenhum ciclo ativo' no cartão de ciclo e o atalho de Ciclos leva a /cycles", async () => {
    prepararPainel(fixtureSupportUser, estadoSemCiclo);

    expect(await screen.findByText("Visão do Sistema")).toBeTruthy();
    expect(await screen.findByText("Nenhum ciclo ativo")).toBeTruthy();
    const atalho = screen.getByRole("link", { name: "Ciclos de Avaliação" });
    expect(atalho.getAttribute("href")).toBe("/cycles");
    // A mensagem + botão "Cadastrar Ciclo" é a resposta da liderança, não do painel de operação.
    expect(screen.queryByText(MENSAGEM)).toBeNull();
    expect(screen.queryByRole("link", { name: BOTAO })).toBeNull();
  });

  it("D1 (dono, 2026-09-05): o admin sem ciclo não vê a matriz antiga nem 'PDIs ativos' — só as contagens de operação", async () => {
    prepararPainel(fixtureSupportUser, estadoSemCiclo);

    await screen.findByText("Nenhum ciclo ativo");
    expect(screen.queryByText("PDIs ativos")).toBeNull();
    expect(screen.queryByText("Painel de Capacidades")).toBeNull();
    expect(screen.getByText("PDIs por estado")).toBeTruthy();
  });

  it("com ciclo cadastrado, o Painel de operação do admin nomeia o ciclo — sem a mensagem", async () => {
    prepararPainel(fixtureSupportUser, fixtureState);

    expect(await screen.findByText("Visão do Sistema")).toBeTruthy();
    expect(await screen.findByText("2026 H2")).toBeTruthy();
    expect(screen.queryByText("Nenhum ciclo ativo")).toBeNull();
    expect(screen.queryByText(MENSAGEM)).toBeNull();
    expect(screen.queryByRole("link", { name: BOTAO })).toBeNull();
  });

  it("com ciclo cadastrado, a liderança continua vendo as pendências — sem a mensagem", async () => {
    prepararPainel(fixtureAssignedManagerUser, fixtureState);

    expect(await screen.findByText("Painel Executivo")).toBeTruthy();
    expect(screen.queryByText(MENSAGEM)).toBeNull();
  });

  it("o profissional não é chamado a cadastrar ciclo — o Painel dele não muda", async () => {
    prepararPainel(fixtureMemberUser, estadoSemCiclo);

    expect(await screen.findByText("Minha Evolução")).toBeTruthy();
    expect(screen.queryByText(MENSAGEM)).toBeNull();
    expect(screen.queryByRole("link", { name: BOTAO })).toBeNull();
  });
});
