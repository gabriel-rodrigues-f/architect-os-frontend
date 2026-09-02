import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import { Route as TeamRulesRoute } from "@/routes/team-rules";
import {
  fixtureAdminUser,
  fixtureMemberUser,
  fixtureState,
  fixtureTeamId,
  fixtureAssignedTechLeadUser,
  fixtureUnassignedTechLeadUser,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import {
  careerLevelsRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Fase C, tela 1 (spec §1) — configuração da régua do time. A sub-fatia 1
 * entregou o núcleo (`TeamRuleEditorViewModel`, `canConfigureRulesOf`,
 * `requireLeadReach`); esta é a TELA.
 *
 * O bloco que abre este arquivo é o gêmeo do que segura `/users` e
 * `/calibration`: a lição BLOQUEANTE da onda 17 é que `beforeLoad` roda no
 * SSR e é CEGO À SESSÃO lá — por URL direta a guarda não corre no navegador,
 * e quem barra é a PRÓPRIA TELA (negativa renderizada + consulta desligada).
 * Guarda de rota sozinha não protege nada.
 */
const fetchMock = vi.fn();

const TeamRulesPage = TeamRulesRoute.options.component as () => ReactNode;

const teamsRoute: FetchRoute = (href) =>
  href.endsWith(apiPath("/teams"))
    ? jsonResponse([
        { id: fixtureTeamId, name: "Time Plataforma", active: true },
        { id: "time-dados", name: "Time Dados", active: true },
      ])
    : undefined;

const semRegua: FetchRoute = (href) =>
  href.includes("/rules/")
    ? jsonResponse(
        { code: "TeamRuleNotFoundError", message: "Este time não tem régua para o nível." },
        404,
      )
    : undefined;

const comRegua: FetchRoute = (href) =>
  href.includes("/rules/")
    ? jsonResponse({
        id: "regra-plataforma-i",
        teamId: fixtureTeamId,
        careerLevelId: "arquiteto-de-solucoes-i",
        minimumQualifiedCapabilities: 3,
        capabilityIds: ["cloud"],
        competencies: [
          { competencyId: "cloud-k8s", requirementType: "RESTRICTIVE", requiredLevel: 4 },
          {
            competencyId: "cloud-serverless",
            requirementType: "NON_RESTRICTIVE",
            requiredLevel: 2,
          },
        ],
      })
    : undefined;

const renderAs = (user: typeof fixtureMemberUser, routes: FetchRoute[] = []) => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAdminUser ? fixtureState : scopedFixtureStateFor(user),
    routes: [careerLevelsRoute, teamsRoute, ...routes],
  });
  renderWithApp(<TeamRulesPage />);
};

const pediuRegua = (): boolean =>
  fetchMock.mock.calls.some((call) => String(call[0]).includes("/rules/"));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("/team-rules nega DADO a quem não rege régua — a tela é a última barreira", () => {
  it("member recebe a negativa, e nenhuma consulta de régua sai do navegador", async () => {
    renderAs(fixtureMemberUser, [comRegua]);
    expect(
      await screen.findByText("Configurar a régua do time é restrito a quem lidera o time."),
    ).toBeTruthy();
    expect(screen.queryByText("Time Plataforma")).toBeNull();
    expect(pediuRegua()).toBe(false);
  });

  it("lead sem vínculo também não — não há time que ele reja", async () => {
    renderAs(fixtureUnassignedTechLeadUser, [comRegua]);
    expect(
      await screen.findByText("Configurar a régua do time é restrito a quem lidera o time."),
    ).toBeTruthy();
    expect(screen.queryByText("Time Plataforma")).toBeNull();
    expect(pediuRegua()).toBe(false);
  });

  it("lead com vínculo só enxerga os times que rege — nunca a lista inteira", async () => {
    renderAs(fixtureAssignedTechLeadUser, [comRegua]);
    expect(await screen.findByText("Time Plataforma")).toBeTruthy();

    await userEvent.click(screen.getByLabelText("Time"));

    expect(screen.getByRole("option", { name: "Time Plataforma" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Time Dados" })).toBeNull();
  });

  it("admin alcança a tela e a régua do time selecionado", async () => {
    renderAs(fixtureAdminUser, [comRegua]);
    expect(await screen.findByText("Kubernetes")).toBeTruthy();
    expect(
      screen.queryByText("Configurar a régua do time é restrito a quem lidera o time."),
    ).toBeNull();
  });
});

describe("/team-rules — os estados obrigatórios da régua", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("404 TeamRuleNotFoundError vira 'ainda não tem régua', nunca erro de tela", async () => {
    renderAs(fixtureAdminUser, [semRegua]);
    expect(
      await screen.findByText("Este time ainda não tem régua para Júnior.", {
        exact: false,
      }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Definir régua" })).toBeTruthy();
  });

  it("o rodapé mostra o peso por razão: restritivas ×1,5 e não restritivas", async () => {
    renderAs(fixtureAdminUser, [comRegua]);
    expect(await screen.findByText("1 restritivas ×1,5 + 1 não restritivas")).toBeTruthy();
  });

  it("capacidade que exige curadoria continua selecionável, com aviso — teto é sinal, nunca trava", async () => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: {
        ...fixtureState,
        capabilities: fixtureState.capabilities.map((capability) =>
          capability.id === "cloud"
            ? {
                ...capability,
                curation: { activeCompetencyCount: 2, status: "REQUIRES_CURATION" as const },
              }
            : capability,
        ),
      },
      routes: [careerLevelsRoute, teamsRoute, comRegua],
    });
    renderWithApp(<TeamRulesPage />);

    expect(await screen.findByText("Kubernetes")).toBeTruthy();
    expect(screen.getByText("Requer curadoria")).toBeTruthy();

    await userEvent.click(screen.getByLabelText("Capacidades exigidas"));
    const opcao = screen.getByRole("option", { name: /Cloud Architecture/ });
    expect(opcao.getAttribute("aria-selected")).toBe("true");
    expect((opcao as HTMLButtonElement).disabled).toBe(false);
  });
});

/**
 * Troca de obrigatoriedade e conflito de versão — as duas metades que
 * saem do rascunho e chegam ao servidor.
 *
 * `swapTeamRuleRequirement` é operação de NEGÓCIO nomeada (não um PUT
 * genérico da régua inteira): troca a obrigatoriedade entre um PAR de
 * competências, e por isso pede confirmação antes de valer. O conflito
 * segue o padrão 409 já vivo no resumo de desenvolvimento
 * (`assessments-shared.tsx`): aviso + recarregar, nunca sobrescrever
 * calado o trabalho de outra pessoa.
 */
describe("/team-rules — o que sai do rascunho e chega ao servidor", () => {
  const chamadas = (trecho: string) =>
    fetchMock.mock.calls.filter((call) => String(call[0]).includes(trecho));

  it("trocar obrigatoriedade passa por confirmação e chama a operação de negócio", async () => {
    const swapRoute: FetchRoute = (href, init) =>
      href.includes("/swap-requirement") && (init?.method ?? "GET") === "POST"
        ? jsonResponse({
            id: "regra-plataforma-i",
            teamId: fixtureTeamId,
            careerLevelId: "arquiteto-de-solucoes-i",
            minimumQualifiedCapabilities: 3,
            capabilityIds: ["cloud"],
            competencies: [
              { competencyId: "cloud-k8s", requirementType: "NON_RESTRICTIVE", requiredLevel: 4 },
              {
                competencyId: "cloud-serverless",
                requirementType: "RESTRICTIVE",
                requiredLevel: 2,
              },
            ],
          })
        : undefined;
    renderAs(fixtureAdminUser, [swapRoute, comRegua]);
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Trocar obrigatoriedade — Kubernetes"));
    await userEvent.click(screen.getByRole("option", { name: "Serverless" }));

    expect(chamadas("/swap-requirement")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Trocar" }));
    expect(chamadas("/swap-requirement")).toHaveLength(1);
  });

  it("sem rascunho não há o que salvar: o botão nasce desabilitado", async () => {
    renderAs(fixtureAdminUser, [comRegua]);
    await screen.findByText("Kubernetes");
    expect(
      (screen.getByRole("button", { name: "Salvar régua" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await userEvent.click(screen.getByLabelText("Nível mínimo — Kubernetes"));
    await userEvent.click(screen.getByRole("option", { name: "L5" }));
    expect(
      (screen.getByRole("button", { name: "Salvar régua" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("409 no salvar vira aviso de conflito com recarregar, nunca sobrescrita calada", async () => {
    const conflitoRoute: FetchRoute = (href, init) =>
      href.includes("/rules/") && (init?.method ?? "GET") === "PUT"
        ? jsonResponse({ code: "OptimisticLockError", message: "conflito" }, 409)
        : undefined;
    renderAs(fixtureAdminUser, [conflitoRoute, comRegua]);
    await screen.findByText("Kubernetes");

    await userEvent.click(screen.getByLabelText("Nível mínimo — Kubernetes"));
    await userEvent.click(screen.getByRole("option", { name: "L5" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar régua" }));

    expect(
      await screen.findByText(
        "Esta régua foi alterada por outra pessoa enquanto você editava. Recarregue a versão mais recente antes de salvar de novo.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recarregar a régua" })).toBeTruthy();
  });
});
