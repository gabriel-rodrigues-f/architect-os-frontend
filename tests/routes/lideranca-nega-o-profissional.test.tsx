import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `estrangulamento-team.test.tsx`: `<Link>` exige RouterProvider real. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to: _to,
      params: _params,
      search: _search,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown; search?: unknown }) => (
      <a {...rest}>{children}</a>
    ),
  };
});

import { apiPath } from "@/lib/api-path";
import type { SessionUser } from "@/lib/api";
import { Route as CyclesRoute } from "@/routes/cycles";
import { Route as SettingsRoute } from "@/routes/settings";
import { Route as TeamRoute } from "@/routes/team";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureState,
  fixtureAssignedTechLeadUser,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { careerLevelsRoute, mockAppFetch, renderWithApp } from "../helpers/render-app";

/**
 * O gêmeo de tela de `/team` e `/settings` — a metade que a guarda de
 * navegação não cobre.
 *
 * Pedido literal do dono (2026-09-01): "o profissional não pode ver os menus
 * 'time' e 'política de Progressão'". Tirar do menu não fecha a URL, e o
 * `beforeLoad` é CEGO À SESSÃO no SSR (`route-guards.ts` devolve `null` sem
 * `window`) — foi por esse buraco que `/calibration` vazou na onda 17. A
 * barreira que sobra é esta: a tela nega, e a consulta do roster não sai do
 * navegador.
 *
 * `tests/architecture/alcance-por-rota.test.ts` exige este arquivo de toda
 * rota declarada `lideranca`.
 */
const fetchMock = vi.fn();

const TeamPage = TeamRoute.options.component as () => ReactNode;
const SettingsPage = SettingsRoute.options.component as () => ReactNode;
const CyclesPage = CyclesRoute.options.component as () => ReactNode;

const TIME_VISAO_DE_LIDERANCA = "O Time é uma visão de liderança.";
const POLITICA_LEITURA_DE_LIDERANCA = "A Política de Progressão é uma leitura de liderança.";
const CICLOS_LEITURA_DE_LIDERANCA = "Os Ciclos de Desenvolvimento são uma leitura de liderança.";

function pediu(caminho: string): boolean {
  return fetchMock.mock.calls.some(([entrada]) =>
    String(entrada instanceof Request ? entrada.url : entrada).endsWith(apiPath(caminho)),
  );
}

function renderAs(user: SessionUser, page: ReactNode) {
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAdminUser ? fixtureState : scopedFixtureStateFor(user),
    routes: [careerLevelsRoute],
  });
  return renderWithApp(page);
}

describe("/team nega o profissional — a tela é a última barreira", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("member recebe a negativa, e o roster não sai do navegador", async () => {
    renderAs(fixtureMemberUser, <TeamPage />);
    expect(await screen.findByText(TIME_VISAO_DE_LIDERANCA)).toBeTruthy();
    expect(screen.queryByText("Ana Martins")).toBeNull();
    expect(pediu("/architects")).toBe(false);
  });

  it("a tela negada continua se explicando — o ? está lá", async () => {
    renderAs(fixtureMemberUser, <TeamPage />);
    await screen.findByText(TIME_VISAO_DE_LIDERANCA);
    expect(screen.getByRole("button", { name: /como usar/i })).toBeTruthy();
  });

  it("admin alcança o roster, e as pessoas chegam à tela", async () => {
    renderAs(fixtureAdminUser, <TeamPage />);
    expect((await screen.findAllByText("Ana Martins")).length).toBeGreaterThan(0);
    expect(screen.queryByText(TIME_VISAO_DE_LIDERANCA)).toBeNull();
  });
});

describe("/settings nega o profissional — a tela é a última barreira", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /**
   * As RÉGUAS (níveis, faixas, parâmetros, curadoria) são carregadas pelo
   * `StoreProvider` para toda tela — são catálogo global, não consulta desta
   * tela. O que é desta tela são os enfeites editáveis, e eles não saem.
   */
  it("member recebe a negativa, e nenhuma consulta própria da tela sai do navegador", async () => {
    renderAs(fixtureMemberUser, <SettingsPage />);
    expect(await screen.findByText(POLITICA_LEITURA_DE_LIDERANCA)).toBeTruthy();
    expect(pediu("/config/text-templates")).toBe(false);
    expect(pediu("/config/vocabularies")).toBe(false);
  });

  it("o tech lead alcança a política — para os outros papéis nada muda", async () => {
    renderAs(fixtureAssignedTechLeadUser, <SettingsPage />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Política de Progressão" }),
    ).toBeTruthy();
    expect(screen.queryByText(POLITICA_LEITURA_DE_LIDERANCA)).toBeNull();
  });
});

/**
 * Onda 33 — achado (4) da revisão de PO (2026-09-02): Ciclos mostrava ao
 * profissional "Comparação de competências — Nível final por ciclo (L4 →
 * L5)", competência a competência, e remetia a uma Matriz que ele não tem.
 * É a metade de baixo da tela que a decisão do dono manda esconder; a tela
 * inteira passa a ser leitura de liderança.
 */
describe("/cycles nega o profissional — a tela é a última barreira", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("member recebe a negativa, e o nível final por ciclo não é desenhado", async () => {
    const { container } = renderAs(fixtureMemberUser, <CyclesPage />);
    expect(await screen.findByText(CICLOS_LEITURA_DE_LIDERANCA)).toBeTruthy();
    expect(screen.queryByText("Comparação de competências")).toBeNull();
    expect([...container.querySelectorAll("table")]).toEqual([]);
  });

  it("a tela negada continua se explicando — o ? está lá", async () => {
    renderAs(fixtureMemberUser, <CyclesPage />);
    await screen.findByText(CICLOS_LEITURA_DE_LIDERANCA);
    expect(screen.getByRole("button", { name: /como usar/i })).toBeTruthy();
  });

  it("o tech lead alcança os ciclos e a comparação — para os outros papéis nada muda", async () => {
    renderAs(fixtureAssignedTechLeadUser, <CyclesPage />);
    expect(await screen.findByText("Comparação de competências")).toBeTruthy();
    expect(screen.queryByText(CICLOS_LEITURA_DE_LIDERANCA)).toBeNull();
  });
});
