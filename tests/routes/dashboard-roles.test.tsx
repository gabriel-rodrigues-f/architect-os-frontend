import { cleanup, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de team-deactivate.test.tsx: `<Link>` exige RouterProvider real. */
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

import { Route as DashboardRoute } from "@/routes/index";
import { type AppState, type SessionUser } from "@/lib/api";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureState,
  fixtureSupportUser,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { executiveBriefingRoute } from "../helpers/executive-briefing";
import { mockAppFetch, operationsOverviewRoute, renderWithApp } from "../helpers/render-app";

/**
 * O DESPACHO DE `/` POR PAPEL — e só ele.
 *
 * FASE 2 (quinta rodada) criou as homes distintas; a ONDA 3 do Painel
 * Executivo mudou quem recebe qual: o ADMINISTRADOR passou a ler o painel de
 * NEGÓCIO (era ele quem caía na "Visão do Sistema", que é contagem de
 * cadastro por desenho), e a operação do sistema ganhou endereço próprio,
 * `/system-view`, servido também aqui para o SUPORTE — que opera o sistema e
 * não lê a carreira de ninguém (papéis, 2026-09-08, adendo 2).
 *
 * O QUE SAIU DAQUI, e para onde: os casos de ALCANCE da liderança ("sem
 * vínculo a fila é vazia mesmo com gente no payload"). Eles eram desta suíte
 * quando a tela BAIXAVA nove coleções e recortava no navegador. Agora o
 * recorte é do servidor, num pedido só, e a prova mora onde a decisão mora —
 * `readsTheExecutivePanel` + `visibleProfessionalIds`, na matriz de permissão
 * e no teste de controller do backend. Prova de tela do painel novo:
 * `painel-executivo.test.tsx`.
 */

const fetchMock = vi.fn();

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

/** OO3-11/D-7 — setup compartilhado em `render-app.tsx`. */
function renderAs(user: SessionUser, state: AppState = fixtureState) {
  mockAppFetch(fetchMock, {
    user,
    state,
    routes: [executiveBriefingRoute, operationsOverviewRoute],
  });
  return renderWithApp(<DashboardPage />);
}

describe("Painel — Home por papel", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("administrador vê o Painel Executivo — negócio, não contagem de cadastro", async () => {
    renderAs(fixtureAdminUser);
    await screen.findByText("Painel Executivo");
    expect(screen.queryByText("Visão do Sistema")).toBeNull();
    expect(screen.queryByText("Contas por cargo")).toBeNull();
  });

  it("suporte vê a Visão do Sistema — contagens, sem nome de pessoa", async () => {
    renderAs(fixtureSupportUser);
    await screen.findByText("Visão do Sistema");
    expect(await screen.findByText("Profissionais ativos")).toBeTruthy();
    expect(screen.getByText("Contas por cargo")).toBeTruthy();
    expect(screen.queryByText("Ana Martins")).toBeNull();
  });

  it("gerente com vínculo vê o Painel Executivo, nunca a operação do sistema", async () => {
    renderAs(fixtureAssignedManagerUser, scopedFixtureStateFor(fixtureAssignedManagerUser));
    await screen.findByText("Painel Executivo");
    expect(screen.queryByText("Contas por cargo")).toBeNull();
  });

  it("member vê 'Minha Evolução', não a visão de time", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Minha Evolução");
    expect(screen.queryByText("Painel de Capacidades")).toBeNull();
    expect(screen.queryByText("Profissionais")).toBeNull();
    expect(await screen.findByText("Meu PDI")).toBeTruthy();
  });

  /**
   * Onda 31 — pedido literal do dono (2026-09-01): "eu não quero que o
   * profissional veja seus números de avaliação. isso pode influenciá-lo
   * negativamente. pode remover o 'Nível médio' e 'gaps abertos'". Os dois
   * cartões saem SÓ da visão do profissional; a ficha que a liderança abre
   * continua com eles.
   */
  it("member não vê 'Nível médio' nem a contagem de competências em evolução no painel", async () => {
    renderAs(fixtureMemberUser);
    await screen.findByText("Minha Evolução");
    expect(await screen.findByText("Avaliação")).toBeTruthy();
    expect(screen.queryByText("Nível médio")).toBeNull();
    expect(screen.queryByText("Competências em evolução")).toBeNull();
  });

  it("member sem professionalId vinculado vê o estado de conta não vinculada", async () => {
    const unlinked: SessionUser = { ...fixtureMemberUser, professionalId: null };
    renderAs(unlinked);
    await screen.findByText("Minha Evolução");
    expect(
      await screen.findByText("Sua conta ainda não está vinculada a um perfil profissional"),
    ).toBeTruthy();
  });
});
