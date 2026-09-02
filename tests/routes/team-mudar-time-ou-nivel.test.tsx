import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { api } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { InMemoryTeamAllocationGateway } from "@/lib/gateways/team-allocation.gateway";
import { Route as TeamRoute } from "@/routes/team";
import { fixtureAdminUser, fixtureState, fixtureTeamId } from "../helpers/fixtures";
import {
  careerLevelsRoute,
  emptyAuthUsersRoute,
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../helpers/render-app";

/**
 * Onda 35 — achados 7 e 17 do dono (2026-09-02), literais:
 *   7.  "Time › Novo nível: não mostrar o nível atual, só os outros;
 *       'Confirmar mudança' sempre aceso."
 *   17. "Depois de cadastrado, o time não muda pelo lápis; só pelo diálogo
 *       da setinha, com motivo obrigatório; 'Confirmar' exige (novo time OU
 *       novo nível) E motivo."
 *
 * O diálogo da setinha vira "Mudar time ou nível". O time muda pela
 * operação de negócio `POST /architects/:id/team-allocation { teamId, reason }`
 * (contrato novo desta onda; o gateway em memória é o oráculo) e "Sem time"
 * pelo DELETE que já existia; o nível, pela transição que já existia — com o
 * mesmo motivo. Quando os dois mudam, o nível vai ANTES: a transição carrega
 * `expectedVersion` do estado em mão, e a alocação devolve a versão nova.
 */
const fetchMock = vi.fn();

const TeamPage = TeamRoute.options.component as () => ReactNode;

const ana = fixtureState.architects[0];
if (!ana) throw new Error("fixture sem Ana");

const times = [
  { id: fixtureTeamId, name: "Time Plataforma", active: true },
  { id: "time-dados", name: "Time Dados", active: true },
  { id: "time-legado", name: "Time Legado", active: false },
];

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(times)
    : undefined;

const TRANSICAO = apiPath("/architects/ana/career-level-transition");
const ALOCACAO = apiPath("/architects/ana/team-allocation");

const escritas: string[] = [];

const rotaDeEscrita: FetchRoute = (href, init) => {
  if (init?.method === "POST" && href.endsWith(TRANSICAO)) {
    escritas.push("POST career-level-transition");
    const body = JSON.parse(String(init.body)) as { toRole: string };
    return jsonResponse({ ...ana, role: body.toRole, version: 2 });
  }
  if (init?.method === "POST" && href.endsWith(ALOCACAO)) {
    escritas.push("POST team-allocation");
    const body = JSON.parse(String(init.body)) as { teamId: string };
    return jsonResponse({
      data: { ...ana, teamId: body.teamId, version: 3 },
      message: { code: "people.allocate.success" },
    });
  }
  if (init?.method === "DELETE" && href.endsWith(ALOCACAO)) {
    escritas.push("DELETE team-allocation");
    return jsonResponse({
      data: { ...ana, teamId: null, version: 2 },
      message: { code: "people.release.success" },
    });
  }
  return undefined;
};

const corpoDa = (metodo: string, trecho: string): Record<string, unknown> => {
  const chamada = fetchMock.mock.calls.find(
    ([entrada, init]) =>
      String(entrada instanceof Request ? entrada.url : entrada).endsWith(trecho) &&
      (init as RequestInit | undefined)?.method === metodo,
  ) as [unknown, RequestInit] | undefined;
  if (!chamada) throw new Error(`nenhuma chamada ${metodo} ${trecho}`);
  return JSON.parse(String(chamada[1].body)) as Record<string, unknown>;
};

const abrirODialogo = async () => {
  renderWithApp(<TeamPage />);
  await screen.findByText("Ana Martins");
  await userEvent.click(screen.getByRole("button", { name: "Mudar time ou nível de Ana Martins" }));
  const dialogo = await screen.findByRole("dialog");
  const campos = within(dialogo);
  const nivel = (await campos.findByLabelText("Novo nível")) as HTMLSelectElement;
  const time = (await campos.findByLabelText("Novo time")) as HTMLSelectElement;
  await waitFor(() => expect(time.options.length).toBe(3));
  return {
    dialogo: campos,
    nivel,
    time,
    motivo: campos.getByLabelText("Motivo da mudança"),
    confirmar: campos.getByRole("button", { name: "Confirmar mudança" }),
  };
};

describe("/team — o diálogo da setinha é 'Mudar time ou nível'", () => {
  beforeEach(() => {
    escritas.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAdminUser,
      state: fixtureState,
      routes: [careerLevelsRoute, emptyAuthUsersRoute, rotaDeTimes, rotaDeEscrita],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("o título diz o que é; 'Novo nível' oferece só os OUTROS níveis; 'Novo time' oferece Sem time e só os times ativos, nascendo no time atual", async () => {
    const { dialogo, nivel, time } = await abrirODialogo();

    expect(dialogo.getByText("Mudar time ou nível — Ana Martins")).toBeTruthy();

    const niveis = Array.from(nivel.options).map((opcao) => opcao.textContent);
    expect(niveis).not.toContain("Pleno");
    expect(niveis).toContain("Júnior");
    expect(niveis).toContain("Sênior");
    expect(nivel.value).toBe("");

    expect(Array.from(time.options).map((opcao) => opcao.textContent)).toEqual([
      "Sem time",
      "Time Plataforma",
      "Time Dados",
    ]);
    expect(time.value).toBe(fixtureTeamId);
  });

  it("'Confirmar mudança' acende se e só se (time mudou OU nível mudou) E o motivo está preenchido", async () => {
    const { nivel, time, motivo, confirmar } = await abrirODialogo();

    expect(confirmar).toHaveProperty("disabled", true);

    await userEvent.type(motivo, "Promoção após o ciclo");
    expect(confirmar).toHaveProperty("disabled", true);

    await userEvent.selectOptions(nivel, "Sênior");
    expect(confirmar).toHaveProperty("disabled", false);

    await userEvent.selectOptions(nivel, "");
    expect(confirmar).toHaveProperty("disabled", true);

    await userEvent.selectOptions(time, "time-dados");
    expect(confirmar).toHaveProperty("disabled", false);

    await userEvent.clear(motivo);
    expect(confirmar).toHaveProperty("disabled", true);
  });

  it("mudar só o time vai pelo gateway em memória com o motivo — o oráculo do contrato", async () => {
    const gateway = new InMemoryTeamAllocationGateway(fixtureState.architects, times);
    vi.spyOn(api, "allocateArchitectToTeam").mockImplementation(gateway.allocateArchitectToTeam);

    const { time, motivo, confirmar } = await abrirODialogo();
    await userEvent.selectOptions(time, "time-dados");
    await userEvent.type(motivo, "Realocação por demanda do produto");
    await userEvent.click(confirmar);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(gateway.allocationsMade).toEqual([
      { architectId: "ana", teamId: "time-dados", reason: "Realocação por demanda do produto" },
    ]);
    expect(escritas).toEqual([]);
  });

  it("no fio: mudar só o time chama POST team-allocation com { teamId, reason } e nada de transição de nível", async () => {
    const { time, motivo, confirmar } = await abrirODialogo();
    await userEvent.selectOptions(time, "time-dados");
    await userEvent.type(motivo, "Realocação por demanda do produto");
    await userEvent.click(confirmar);

    await waitFor(() => expect(escritas).toEqual(["POST team-allocation"]));
    expect(corpoDa("POST", ALOCACAO)).toEqual({
      teamId: "time-dados",
      reason: "Realocação por demanda do produto",
    });
  });

  it("'Sem time' vai pelo DELETE que já existia", async () => {
    const { time, motivo, confirmar } = await abrirODialogo();
    await userEvent.selectOptions(time, "");
    await userEvent.type(motivo, "Saiu do time enquanto o novo não é definido");
    await userEvent.click(confirmar);

    await waitFor(() => expect(escritas).toEqual(["DELETE team-allocation"]));
  });

  it("mudar nível e time no mesmo ato: a transição de nível vai ANTES da alocação, as duas com o mesmo motivo", async () => {
    const { nivel, time, motivo, confirmar } = await abrirODialogo();
    await userEvent.selectOptions(nivel, "Sênior");
    await userEvent.selectOptions(time, "time-dados");
    await userEvent.type(motivo, "Promovida e movida para o time novo");
    await userEvent.click(confirmar);

    await waitFor(() =>
      expect(escritas).toEqual(["POST career-level-transition", "POST team-allocation"]),
    );
    expect(corpoDa("POST", TRANSICAO)).toMatchObject({
      toRole: "Sênior",
      reason: "Promovida e movida para o time novo",
    });
    expect(corpoDa("POST", ALOCACAO)).toEqual({
      teamId: "time-dados",
      reason: "Promovida e movida para o time novo",
    });
  });
});
