import { cleanup, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesma razão de `dashboard-roles.test.tsx`: `<Link>` exige RouterProvider real. */
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
import type { AppState, SessionUser } from "@/lib/api";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureMemberUser,
  fixtureState,
  fixtureTeamId,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { mockAppFetch, operationsOverviewRoute, renderWithApp } from "../helpers/render-app";

/**
 * Referência FIAP 2026-09-06, §2 item 1 — "uma dobra, uma ideia". O Painel
 * Executivo (gerente e tech lead) e a Visão do Sistema (admin) deixam de
 * empilhar cartões de mesmo peso: cada bloco tem um título forte, UM
 * número-síntese grande e o detalhe abaixo, mais leve. O que cada papel vê
 * NÃO muda (régua de papéis 2026-09-06): admin só contagens, liderança só o
 * seu time, profissional só a própria carreira.
 */
const fetchMock = vi.fn();

const DashboardPage = DashboardRoute.options.component as () => ReactNode;

function renderAs(user: SessionUser, state: AppState = fixtureState) {
  mockAppFetch(fetchMock, { user, state, routes: [operationsOverviewRoute] });
  return renderWithApp(<DashboardPage />);
}

const renderAsLeader = (user: SessionUser) =>
  renderAs(user, scopedFixtureStateFor(user, fixtureState, [fixtureTeamId]));

/** O bloco (a `section` do cartão) que carrega este título. */
const blocoDe = (titulo: string) => screen.getByText(titulo).closest("section")!;

const BLOCOS_DA_LIDERANCA = [
  "Avaliação do Ciclo",
  "Distâncias por severidade",
  "PDIs do ciclo",
  "Ações da Liderança",
];

const BLOCOS_DO_SISTEMA = [
  "Profissionais ativos",
  "Times ativos",
  "Contas ativas",
  "Ciclo vigente",
  "Avaliações do ciclo por estado",
];

describe("Painel Executivo — um bloco, uma ideia, um número-síntese", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    ["gerente", fixtureAssignedManagerUser],
    ["tech lead", fixtureAssignedTechLeadUser],
  ])(
    "%s: título 'Painel Executivo' e os quatro blocos, cada um com o seu número-síntese",
    async (_papel, user) => {
      renderAsLeader(user);
      expect(
        await screen.findByRole("heading", { level: 1, name: "Painel Executivo" }),
      ).toBeTruthy();

      for (const titulo of BLOCOS_DA_LIDERANCA) {
        const bloco = blocoDe(titulo);
        expect(bloco.querySelector("[data-key-figure]"), titulo).not.toBeNull();
      }
    },
  );

  it("a cobertura da avaliação é um percentual; as distâncias, uma contagem crítica; as ações, a fila", async () => {
    renderAsLeader(fixtureAssignedManagerUser);
    await screen.findByText("Painel Executivo");

    // Fixture: Ana e Bruno, as duas pessoas do time, têm avaliação concluída no ciclo.
    const cobertura = blocoDe("Avaliação do Ciclo").querySelector("[data-key-figure]")!;
    expect(within(cobertura as HTMLElement).getByText("100%")).toBeTruthy();
    expect(within(cobertura as HTMLElement).getByText(/2 de 2 concluídas/)).toBeTruthy();

    // O tom do número é decidido pela severidade: crítico quando há distância crítica, bom quando não há.
    const distancias = blocoDe("Distâncias por severidade").querySelector("[data-key-figure]")!;
    expect(["critical", "good"]).toContain(distancias.getAttribute("data-tone"));

    // "e1" na fixture: evidência Pending de "ana" — uma ação na fila.
    const acoes = blocoDe("Ações da Liderança");
    expect(acoes.querySelector("[data-key-figure]")?.getAttribute("data-tone")).toBe("attention");
    expect(within(acoes).getAllByText(/Ana Martins/).length).toBeGreaterThan(0);
  });

  it("a liderança sem vínculo vê o Painel Executivo com o estado vazio, sem números do time", async () => {
    renderAs(fixtureAssignedTechLeadUser, {
      ...scopedFixtureStateFor({ ...fixtureAssignedTechLeadUser, memberships: [] }),
    });
    await screen.findByText("Painel Executivo");
    expect(await screen.findByText("Nenhum profissional sob sua liderança ainda")).toBeTruthy();
    expect(screen.queryByText("Distâncias por severidade")).toBeNull();
  });

  it("admin: 'Visão do Sistema' com pessoas, times, contas, ciclo e avaliações por estado — cada um com número-síntese", async () => {
    renderAs(fixtureAdminUser);
    await screen.findByText("Visão do Sistema");

    for (const titulo of BLOCOS_DO_SISTEMA) {
      const figura = (await screen.findByText(titulo)).closest("[data-key-figure]");
      expect(figura, titulo).not.toBeNull();
    }
    // A régua de papéis não muda: nada de time no Painel do admin.
    for (const titulo of ["Distâncias por severidade", "Ações da Liderança"]) {
      expect(screen.queryByText(titulo), titulo).toBeNull();
    }
  });

  it("o profissional continua com 'Minha Evolução' — nenhum bloco de time", async () => {
    renderAs(fixtureMemberUser, scopedFixtureStateFor(fixtureMemberUser));
    await screen.findByText("Minha Evolução");
    for (const titulo of [...BLOCOS_DA_LIDERANCA, ...BLOCOS_DO_SISTEMA]) {
      expect(screen.queryByText(titulo), titulo).toBeNull();
    }
  });
});
