import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      to: _to,
      params: _params,
      ...rest
    }: ComponentProps<"a"> & { to?: string; params?: unknown }) => <a {...rest}>{children}</a>,
  };
});

import { apiPath } from "@/lib/api-path";
import type { TeamTransferRequestView } from "@/lib/domain";
import { Route as TeamRoute } from "@/routes/team";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureState,
  fixtureTeamId,
} from "../helpers/fixtures";
import {
  careerLevelsRoute,
  emptyAuthUsersRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Decisão do dono (2026-09-06): as pendências ficam VISÍVEIS na tela Time —
 * um bloco "Transferências pendentes" com o que é a aprovar por mim e o que
 * eu solicitei, com Aprovar / Recusar (nota) / Cancelar conforme o papel —
 * e a pessoa com solicitação pendente ganha um selo no roster.
 *
 * O gerente da fixture é gerente de Time Plataforma: a solicitação que CHEGA
 * (destino = Plataforma) ele decide; a que ele PEDIU (Ana → Dados) ele cancela.
 */
const fetchMock = vi.fn();

const TeamPage = TeamRoute.options.component as () => ReactNode;

const times = [
  { id: fixtureTeamId, name: "Time Plataforma", active: true },
  { id: "time-dados", name: "Time Dados", active: true },
];

const base: TeamTransferRequestView = {
  id: "req-base",
  professionalId: "ana",
  fromTeamId: fixtureTeamId,
  toTeamId: "time-dados",
  reason: "Demanda do produto",
  requestedByUserId: fixtureAssignedManagerUser.id,
  requestedAt: "2026-09-06T12:00:00.000Z",
  status: "pending",
  decidedByUserId: null,
  decidedAt: null,
  decisionNote: null,
  version: 1,
  professionalName: "Ana Martins",
  fromTeamName: "Time Plataforma",
  toTeamName: "Time Dados",
  requestedByName: "Gerente do time",
  decidedByName: null,
};

/** Chega para o gerente de Plataforma decidir: Carla, de Dados para Plataforma. */
const chegando: TeamTransferRequestView = {
  ...base,
  id: "req-carla",
  professionalId: "carla",
  fromTeamId: "time-dados",
  toTeamId: fixtureTeamId,
  reason: "Carla quer voltar para a plataforma",
  requestedByUserId: "gerente-de-dados",
  professionalName: "Carla Souza",
  fromTeamName: "Time Dados",
  toTeamName: "Time Plataforma",
  requestedByName: "Gerente de Dados",
};

/** Pedida pelo próprio gerente: Ana, de Plataforma para Dados. */
const pedidaPorMim: TeamTransferRequestView = { ...base, id: "req-ana" };

const decisoes: string[] = [];

const rotas =
  (pendentes: TeamTransferRequestView[]): FetchRoute =>
  (href, init) => {
    const metodo = (init?.method ?? "GET").toUpperCase();
    if (metodo === "GET" && href.endsWith(apiPath("/teams"))) return jsonResponse(times);
    if (metodo === "GET" && href.includes(apiPath("/team-transfer-requests")))
      return jsonResponse(pendentes);
    const decisao = /team-transfer-requests\/([^/]+)\/(approve|refuse|cancel)$/.exec(href);
    if (metodo === "POST" && decisao) {
      decisoes.push(`${decisao[2]} ${decisao[1]} ${String(init?.body ?? "")}`);
      const alvo = pendentes.find((pendente) => pendente.id === decisao[1]) ?? base;
      return jsonResponse({
        data: { ...alvo, status: `${decisao[2]}d`.replace("cancel", "cancelle") },
        message: { code: `transfers.${decisao[2]}.success` },
      });
    }
    return undefined;
  };

const montar = (user = fixtureAssignedManagerUser, pendentes = [chegando, pedidaPorMim]) => {
  decisoes.length = 0;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user,
    state: fixtureState,
    routes: [careerLevelsRoute, emptyAuthUsersRoute, rotas(pendentes)],
  });
  renderWithApp(<TeamPage />);
};

describe("/team — bloco 'Transferências pendentes'", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("separa 'A aprovar por você' de 'Solicitadas por você', cada uma com pessoa, origem → destino e motivo", async () => {
    montar();
    const bloco = within(await screen.findByRole("region", { name: "Transferências pendentes" }));

    const aAprovar = within(bloco.getByRole("list", { name: "A aprovar por você" }));
    expect(aAprovar.getByText("Carla Souza")).toBeTruthy();
    expect(aAprovar.getByText(/Time Dados → Time Plataforma/)).toBeTruthy();
    expect(aAprovar.getByText(/Carla quer voltar para a plataforma/)).toBeTruthy();
    expect(aAprovar.getByRole("button", { name: "Aprovar" })).toBeTruthy();
    expect(aAprovar.getByRole("button", { name: "Recusar" })).toBeTruthy();
    expect(aAprovar.queryByRole("button", { name: "Cancelar solicitação" })).toBeNull();

    const pedidas = within(bloco.getByRole("list", { name: "Solicitadas por você" }));
    expect(pedidas.getByText("Ana Martins")).toBeTruthy();
    expect(pedidas.getByRole("button", { name: "Cancelar solicitação" })).toBeTruthy();
    expect(pedidas.queryByRole("button", { name: "Aprovar" })).toBeNull();
  });

  it("Aprovar chama POST /team-transfer-requests/:id/approve", async () => {
    montar();
    const bloco = within(await screen.findByRole("region", { name: "Transferências pendentes" }));
    await userEvent.click(bloco.getByRole("button", { name: "Aprovar" }));
    await waitFor(() => expect(decisoes).toEqual(["approve req-carla {}"]));
  });

  it("Recusar exige a nota e manda { note } em POST .../refuse", async () => {
    montar();
    const bloco = within(await screen.findByRole("region", { name: "Transferências pendentes" }));
    await userEvent.click(bloco.getByRole("button", { name: "Recusar" }));
    const dialogo = within(await screen.findByRole("dialog"));
    const confirmar = dialogo.getByRole("button", { name: "Recusar transferência" });
    expect(confirmar).toHaveProperty("disabled", true);
    await userEvent.type(
      dialogo.getByLabelText("Nota para quem solicitou"),
      "Sem vaga neste ciclo",
    );
    await userEvent.click(confirmar);
    await waitFor(() =>
      expect(decisoes).toEqual(['refuse req-carla {"note":"Sem vaga neste ciclo"}']),
    );
  });

  it("Cancelar solicitação chama POST .../cancel sem corpo", async () => {
    montar();
    const bloco = within(await screen.findByRole("region", { name: "Transferências pendentes" }));
    await userEvent.click(bloco.getByRole("button", { name: "Cancelar solicitação" }));
    await waitFor(() => expect(decisoes).toEqual(["cancel req-ana "]));
  });

  it("sem pendência, o bloco não aparece", async () => {
    montar(fixtureAssignedManagerUser, []);
    await screen.findByText("Ana Martins");
    expect(screen.queryByText("Transferências pendentes")).toBeNull();
  });

  it("o admin decide todas — e pode cancelar qualquer uma", async () => {
    montar(fixtureAdminUser);
    const bloco = within(await screen.findByRole("region", { name: "Transferências pendentes" }));
    expect(bloco.getAllByRole("button", { name: "Aprovar" })).toHaveLength(2);
    expect(bloco.getAllByRole("button", { name: "Cancelar solicitação" })).toHaveLength(2);
    expect(bloco.queryByRole("list", { name: "Solicitadas por você" })).toBeNull();
  });
});

describe("/team — o selo no roster", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("a pessoa com solicitação pendente aparece com 'Transferência pendente → {destino}'", async () => {
    montar();
    await screen.findByText("Ana Martins");
    expect(await screen.findByText("Transferência pendente → Time Dados")).toBeTruthy();
  });

  it("sem pendência, nenhum selo", async () => {
    montar(fixtureAssignedManagerUser, []);
    await screen.findByText("Ana Martins");
    expect(screen.queryByText(/Transferência pendente/)).toBeNull();
  });
});
