import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, type SessionUser } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import type { Architect } from "@/lib/domain";
import { InMemoryTeamAllocationGateway } from "@/lib/gateways/team-allocation.gateway";
import { Route as TeamsRoute } from "@/routes/teams";
import {
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
  fixtureState,
  fixtureTeamId,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Onda 33 — achado (2) da revisão de PO (2026-09-02): "o admin não consegue
 * colocar uma pessoa num time. [...] o quadro seguiu dizendo 'Nenhuma pessoa
 * ativa neste time'". O Quadro só vinculava CONTAS; o vínculo do PROFISSIONAL
 * com o time é `architects.team_id`, e ele nasce aqui pela operação de
 * negócio `POST/DELETE /architects/:id/team-allocation`.
 *
 * Quem aloca e retira é quem compõe o time (`canComposeTeam`): admin sempre,
 * gestor só do time que gere — o espelho da regra do backend. O tech lead
 * lidera tecnicamente e não compõe.
 */
const fetchMock = vi.fn();

const TeamsPage = TeamsRoute.options.component as () => ReactNode;

const times = [
  { id: fixtureTeamId, name: "Time Plataforma", active: true },
  { id: "time-dados", name: "Time Dados", active: true },
];

const diego: Architect = {
  id: "diego",
  name: "Diego Ramos",
  role: "Júnior",
  yearsAsArchitect: 2,
  specialization: "",
  email: "diego@company.com",
  active: true,
  teamId: null,
  version: 1,
};

const elisa: Architect = {
  id: "elisa",
  name: "Elisa Costa",
  role: "Pleno",
  yearsAsArchitect: 4,
  specialization: "",
  email: "elisa@company.com",
  active: true,
  teamId: "time-dados",
  version: 1,
};

const fabio: Architect = {
  id: "fabio",
  name: "Fábio Lima",
  role: "Sênior",
  yearsAsArchitect: 9,
  specialization: "",
  email: "fabio@company.com",
  active: false,
  teamId: null,
  version: 1,
};

const CAMINHO_DO_QUADRO = apiPath(`/teams/${fixtureTeamId}/memberships`);

/** Onda 35: alocar exige motivo — `{ teamId, reason }`, 400 sem ele. */
const MOTIVO = "Reforço na plataforma";

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(times)
    : undefined;

const rotaDeContas: FetchRoute = (href) =>
  href.endsWith(apiPath("/auth/users")) ? jsonResponse([]) : undefined;

const rotaDoQuadroVazio: FetchRoute = (href, init) =>
  href.endsWith(CAMINHO_DO_QUADRO) && (init?.method ?? "GET") === "GET"
    ? jsonResponse([])
    : undefined;

const chamadas = (metodo: string, trecho: string) =>
  fetchMock.mock.calls.filter(
    ([entrada, init]) =>
      String(entrada instanceof Request ? entrada.url : entrada).endsWith(trecho) &&
      ((init as RequestInit | undefined)?.method ?? "GET") === metodo,
  );

function renderAs(user: SessionUser, routes: FetchRoute[] = []) {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  const scoped = scopedFixtureStateFor(user, fixtureState, [fixtureTeamId]);
  mockAppFetch(fetchMock, {
    user,
    state: { ...scoped, architects: [...scoped.architects, diego, elisa, fabio] },
    routes: [...routes, rotaDeTimes, rotaDeContas, rotaDoQuadroVazio],
  });
  return renderWithApp(<TeamsPage />);
}

async function abrirOQuadro() {
  await screen.findByText("Time Plataforma");
  await userEvent.click(screen.getByLabelText("Quadro de Time Plataforma"));
  await screen.findByText("Pessoas do time");
}

const secaoDePessoas = () =>
  within(screen.getByText("Pessoas do time").closest("section") as HTMLElement);

async function abrirODialogoDeAlocacao() {
  await userEvent.click(screen.getByRole("button", { name: "Alocar pessoa" }));
  return within(await screen.findByRole("dialog"));
}

beforeEach(() => {
  try {
    window.localStorage.removeItem("synapse:section-open:teams.registry");
    window.localStorage.removeItem("synapse:section-open:teams.roster");
  } catch {
    return;
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("/teams — alocar pessoa ao time, pelo gateway em memória (o oráculo do contrato)", () => {
  it("o gestor do time vê 'Alocar pessoa', escolhe entre os ativos que não estão neste time e a pessoa entra no quadro", async () => {
    const gateway = new InMemoryTeamAllocationGateway([...fixtureState.architects, diego], times);
    vi.spyOn(api, "allocateArchitectToTeam").mockImplementation(gateway.allocateArchitectToTeam);

    renderAs(fixtureAssignedManagerUser);
    await abrirOQuadro();

    expect(secaoDePessoas().getByText("Ana Martins")).toBeTruthy();
    expect(secaoDePessoas().queryByText("Diego Ramos")).toBeNull();

    const dialogo = await abrirODialogoDeAlocacao();
    await userEvent.click(dialogo.getByLabelText("Pessoa"));
    const opcoes = screen.getAllByRole("option").map((opcao) => opcao.textContent?.trim());
    expect(opcoes).toContain("Diego Ramos — sem time");
    expect(opcoes).toContain("Elisa Costa — Time Dados");
    expect(opcoes.some((texto) => texto?.startsWith("Ana Martins"))).toBe(false);
    expect(opcoes.some((texto) => texto?.startsWith("Bruno Almeida"))).toBe(false);
    expect(opcoes.some((texto) => texto?.startsWith("Fábio Lima"))).toBe(false);

    await userEvent.click(screen.getByRole("option", { name: "Diego Ramos — sem time" }));
    await userEvent.type(dialogo.getByLabelText("Motivo da mudança"), MOTIVO);
    await userEvent.click(dialogo.getByRole("button", { name: "Alocar" }));

    expect(await secaoDePessoas().findByText("Diego Ramos")).toBeTruthy();
    expect(gateway.allocationsMade).toEqual([
      { architectId: "diego", teamId: fixtureTeamId, reason: MOTIVO },
    ]);
  });

  it("a recusa do serviço aparece no diálogo, com a mensagem dele, e o quadro não muda", async () => {
    const gateway = new InMemoryTeamAllocationGateway(
      [...fixtureState.architects, diego],
      times.map((time) => (time.id === fixtureTeamId ? { ...time, active: false } : time)),
    );
    vi.spyOn(api, "allocateArchitectToTeam").mockImplementation(gateway.allocateArchitectToTeam);

    renderAs(fixtureAssignedManagerUser);
    await abrirOQuadro();

    const dialogo = await abrirODialogoDeAlocacao();
    await userEvent.click(dialogo.getByLabelText("Pessoa"));
    await userEvent.click(screen.getByRole("option", { name: "Diego Ramos — sem time" }));
    await userEvent.type(dialogo.getByLabelText("Motivo da mudança"), MOTIVO);
    await userEvent.click(dialogo.getByRole("button", { name: "Alocar" }));

    expect((await dialogo.findByRole("alert")).textContent).toContain(
      "O time está desativado e não recebe pessoas.",
    );
    expect(secaoDePessoas().queryByText("Diego Ramos")).toBeNull();
  });
});

describe("/teams — alocar e retirar pelo container de produção (o contrato no fio)", () => {
  it("alocar chama POST /architects/:id/team-allocation com { teamId, reason } e a pessoa passa a listar no quadro", async () => {
    const alocacao: FetchRoute = (href, init) => {
      if (href.endsWith(apiPath("/architects/diego/team-allocation")) && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { teamId: string };
        return jsonResponse({
          data: { ...diego, teamId: body.teamId, version: 2 },
          message: { code: "people.allocate.success" },
        });
      }
      return undefined;
    };
    renderAs(fixtureAssignedManagerUser, [alocacao]);
    await abrirOQuadro();

    const dialogo = await abrirODialogoDeAlocacao();
    await userEvent.click(dialogo.getByLabelText("Pessoa"));
    await userEvent.click(screen.getByRole("option", { name: "Diego Ramos — sem time" }));
    await userEvent.type(dialogo.getByLabelText("Motivo da mudança"), MOTIVO);
    await userEvent.click(dialogo.getByRole("button", { name: "Alocar" }));

    expect(await secaoDePessoas().findByText("Diego Ramos")).toBeTruthy();
    const [chamada] = chamadas("POST", apiPath("/architects/diego/team-allocation"));
    expect(JSON.parse(String((chamada?.[1] as RequestInit).body))).toEqual({
      teamId: fixtureTeamId,
      reason: MOTIVO,
    });
  });

  it("retirar pede confirmação, chama DELETE /architects/:id/team-allocation e a pessoa some do quadro", async () => {
    const retirada: FetchRoute = (href, init) =>
      href.endsWith(apiPath("/architects/ana/team-allocation")) && init?.method === "DELETE"
        ? jsonResponse({
            data: { ...fixtureState.architects[0], teamId: null, version: 2 },
            message: { code: "people.release.success" },
          })
        : undefined;
    renderAs(fixtureAssignedManagerUser, [retirada]);
    await abrirOQuadro();

    await userEvent.click(screen.getByLabelText("Retirar Ana Martins do time"));
    expect(chamadas("DELETE", apiPath("/architects/ana/team-allocation"))).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Retirar do time" }));

    await waitFor(() => expect(secaoDePessoas().queryByText("Ana Martins")).toBeNull());
    expect(chamadas("DELETE", apiPath("/architects/ana/team-allocation"))).toHaveLength(1);
    expect(secaoDePessoas().getByText("Bruno Almeida")).toBeTruthy();
  });

  it("o 409 do serviço nomeia a recusa — o diálogo mostra a mensagem dele, não inventa outra", async () => {
    const recusa: FetchRoute = (href, init) =>
      href.endsWith(apiPath("/architects/diego/team-allocation")) && init?.method === "POST"
        ? jsonResponse(
            { code: "ARCHITECT_ALREADY_IN_TEAM", message: "Diego Ramos já está neste time." },
            409,
          )
        : undefined;
    renderAs(fixtureAssignedManagerUser, [recusa]);
    await abrirOQuadro();

    const dialogo = await abrirODialogoDeAlocacao();
    await userEvent.click(dialogo.getByLabelText("Pessoa"));
    await userEvent.click(screen.getByRole("option", { name: "Diego Ramos — sem time" }));
    await userEvent.type(dialogo.getByLabelText("Motivo da mudança"), MOTIVO);
    await userEvent.click(dialogo.getByRole("button", { name: "Alocar" }));

    expect((await dialogo.findByRole("alert")).textContent).toContain(
      "Diego Ramos já está neste time.",
    );
    expect(secaoDePessoas().queryByText("Diego Ramos")).toBeNull();
  });
});

describe("/teams — quem não compõe o time não aloca", () => {
  it("o tech lead não vê 'Alocar pessoa' nem 'Retirar do time'", async () => {
    renderAs(fixtureAssignedTechLeadUser);
    await screen.findByText(/restrito ao administrador e ao gestor designado/i);

    expect(screen.queryByRole("button", { name: "Alocar pessoa" })).toBeNull();
    expect(screen.queryByLabelText(/Retirar .* do time/)).toBeNull();
  });
});
