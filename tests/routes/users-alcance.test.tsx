import { cleanup, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import type { SessionUser } from "@/lib/api";
import { Route as UsersRoute } from "@/routes/users";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureState,
  fixtureUnassignedTechLeadUser,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * O gêmeo de tela de `/users` — a metade que faltava.
 *
 * A guarda de navegação já era provada em `route-guards.test.ts`, mas ela é
 * CEGA À SESSÃO no SSR (`route-guards.ts` devolve `null` sem `window`): foi
 * exatamente esse buraco que deixou `/calibration` alcançável por URL direta
 * na onda 17. A barreira que sobra é esta — a tela nega, e a consulta de
 * contas não sai do navegador.
 *
 * Este arquivo nasceu vermelho: a rede `tests/architecture/alcance-por-rota.test.ts`
 * exige de toda rota restrita o par navegação+tela, e `/users` era a única
 * das quatro sem o gêmeo de tela escrito. O achado foi da rede, não de um
 * agente de QA — que é o ponto da regra 28.
 */
const fetchMock = vi.fn();

const UsersPage = UsersRoute.options.component as () => ReactNode;

const contas: SessionUser[] = [
  fixtureAdminUser,
  { ...fixtureMemberUser, id: "conta-ana", name: "Ana Martins" },
];

const rotaDeContas: FetchRoute = (href) =>
  href.endsWith(apiPath("/auth/users")) ? jsonResponse(contas) : undefined;

function pediuAsContas(): boolean {
  return fetchMock.mock.calls.some(([entrada]) =>
    String(entrada instanceof Request ? entrada.url : entrada).endsWith(apiPath("/auth/users")),
  );
}

function renderAs(user: SessionUser) {
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAdminUser ? fixtureState : scopedFixtureStateFor(user),
    routes: [rotaDeContas],
  });
  return renderWithApp(<UsersPage />);
}

describe("/users nega DADO a quem não é admin — a tela é a última barreira", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("member recebe a negativa, e nenhuma consulta de contas sai do navegador", async () => {
    renderAs(fixtureMemberUser);
    expect(
      await screen.findByText("Diretório de contas é restrito a administradores."),
    ).toBeTruthy();
    expect(screen.queryByText("Ana Martins")).toBeNull();
    expect(pediuAsContas()).toBe(false);
  });

  it("lead também não — o diretório de contas é administrativo, não de liderança", async () => {
    renderAs(fixtureUnassignedTechLeadUser);
    expect(
      await screen.findByText("Diretório de contas é restrito a administradores."),
    ).toBeTruthy();
    expect(pediuAsContas()).toBe(false);
  });

  it("quem não é admin não recebe a ação de criar conta", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Diretório de contas é restrito a administradores.");
    expect(screen.queryByRole("button", { name: "Criar conta" })).toBeNull();
  });

  it("admin alcança o diretório, recebe a ação de criar e as contas chegam à tela", async () => {
    renderAs(fixtureAdminUser);
    expect(await screen.findByText("Ana Martins")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeTruthy();
    expect(pediuAsContas()).toBe(true);
  });
});
