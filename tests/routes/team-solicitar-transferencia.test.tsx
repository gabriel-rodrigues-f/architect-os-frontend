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

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

import { apiPath } from "@/lib/api-path";
import { Route as TeamRoute } from "@/routes/team";
import {
  fixtureAssignedManagerUser,
  fixtureAssignedTechLeadUser,
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
 * Decisão do dono (2026-09-06): para o GERENTE, "Mudar de time" deixa de ser
 * imediato e vira SOLICITAÇÃO — o gerente do time de destino é avisado e
 * aprova; só então a pessoa migra. A mudança de NÍVEL continua imediata (é
 * do gerente). O admin segue movendo direto: `team-mudar-time-ou-nivel.test`
 * é a prova dele. O tech lead não vê o botão.
 */
const fetchMock = vi.fn();

const TeamPage = TeamRoute.options.component as () => ReactNode;

const ana = fixtureState.professionals[0];
if (!ana) throw new Error("fixture sem Ana");

const times = [
  { id: fixtureTeamId, name: "Time Plataforma", active: true },
  { id: "time-dados", name: "Time Dados", active: true },
];

const TRANSICAO = apiPath("/professionals/ana/career-level-transition");
const ALOCACAO = apiPath("/professionals/ana/team-allocation");
const SOLICITACAO = apiPath("/professionals/ana/team-transfer-requests");

const escritas: string[] = [];

const rotas: FetchRoute = (href, init) => {
  const metodo = (init?.method ?? "GET").toUpperCase();
  if (metodo === "GET" && href.endsWith(apiPath("/teams"))) return jsonResponse(times);
  if (metodo === "GET" && href.includes(apiPath("/team-transfer-requests")))
    return jsonResponse([]);
  if (metodo === "POST" && href.endsWith(TRANSICAO)) {
    escritas.push("POST career-level-transition");
    const body = JSON.parse(String(init?.body)) as { toRole: string };
    return jsonResponse({ ...ana, role: body.toRole, version: 2 });
  }
  if (metodo === "POST" && href.endsWith(ALOCACAO)) {
    escritas.push("POST team-allocation");
    return jsonResponse({ ...ana, teamId: "time-dados", version: 3 });
  }
  if (metodo === "POST" && href.endsWith(SOLICITACAO)) {
    escritas.push("POST team-transfer-requests");
    const body = JSON.parse(String(init?.body)) as { toTeamId: string; reason: string };
    return jsonResponse(
      {
        data: {
          id: "req-1",
          professionalId: "ana",
          fromTeamId: fixtureTeamId,
          toTeamId: body.toTeamId,
          reason: body.reason,
          requestedByUserId: fixtureAssignedManagerUser.id,
          requestedAt: "2026-09-06T12:00:00.000Z",
          status: "pending",
          decidedByUserId: null,
          decidedAt: null,
          decisionNote: null,
          version: 1,
        },
        message: { code: "transfers.request.success" },
      },
      201,
    );
  }
  return undefined;
};

const corpoDa = (trecho: string): Record<string, unknown> => {
  const chamada = fetchMock.mock.calls.find(
    ([entrada, init]) =>
      String(entrada instanceof Request ? entrada.url : entrada).endsWith(trecho) &&
      (init as RequestInit | undefined)?.method === "POST",
  ) as [unknown, RequestInit] | undefined;
  if (!chamada) throw new Error(`nenhuma chamada POST ${trecho}`);
  return JSON.parse(String(chamada[1].body)) as Record<string, unknown>;
};

const abrirODialogo = async () => {
  renderWithApp(<TeamPage />);
  await screen.findByText("Ana Martins");
  await userEvent.click(screen.getByRole("button", { name: "Mudar time ou nível de Ana Martins" }));
  const dialogo = within(await screen.findByRole("dialog"));
  const nivel = (await dialogo.findByLabelText("Novo nível")) as HTMLSelectElement;
  const time = (await dialogo.findByLabelText("Novo time")) as HTMLSelectElement;
  await waitFor(() => expect(time.options.length).toBeGreaterThan(1));
  return { dialogo, nivel, time, motivo: dialogo.getByLabelText("Motivo da mudança") };
};

describe("/team — para o gerente, mudar de time é SOLICITAR transferência", () => {
  beforeEach(() => {
    escritas.length = 0;
    toastSuccess.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedManagerUser,
      state: fixtureState,
      routes: [careerLevelsRoute, emptyAuthUsersRoute, rotas],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("'Novo time' não oferece 'Sem time' — uma transferência tem destino; o botão vira 'Solicitar transferência' quando o time muda", async () => {
    const { dialogo, time, motivo } = await abrirODialogo();

    expect(Array.from(time.options).map((opcao) => opcao.textContent)).toEqual([
      "Time Plataforma",
      "Time Dados",
    ]);
    expect(dialogo.getByRole("button", { name: "Confirmar mudança" })).toBeTruthy();

    await userEvent.selectOptions(time, "time-dados");
    await userEvent.type(motivo, "Demanda do produto");
    expect(dialogo.getByRole("button", { name: "Solicitar transferência" })).toBeTruthy();
    expect(dialogo.getByText(/gerente do time de destino/i)).toBeTruthy();
  });

  it("solicitar vai por POST team-transfer-requests { toTeamId, reason } — nada de team-allocation — e avisa 'Solicitação enviada ao gerente de Time Dados'", async () => {
    const { dialogo, time, motivo } = await abrirODialogo();
    await userEvent.selectOptions(time, "time-dados");
    await userEvent.type(motivo, "Demanda do produto");
    await userEvent.click(dialogo.getByRole("button", { name: "Solicitar transferência" }));

    await waitFor(() => expect(escritas).toEqual(["POST team-transfer-requests"]));
    expect(corpoDa(SOLICITACAO)).toEqual({ toTeamId: "time-dados", reason: "Demanda do produto" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("Solicitação enviada ao gerente de Time Dados"),
    );
  });

  it("mudar só o nível continua imediato, sem solicitação", async () => {
    const { dialogo, nivel, motivo } = await abrirODialogo();
    await userEvent.selectOptions(nivel, "Sênior");
    await userEvent.type(motivo, "Promoção após o ciclo");
    await userEvent.click(dialogo.getByRole("button", { name: "Confirmar mudança" }));

    await waitFor(() => expect(escritas).toEqual(["POST career-level-transition"]));
  });

  it("nível e time no mesmo ato: o nível muda na hora e o time vira solicitação, os dois com o mesmo motivo", async () => {
    const { dialogo, nivel, time, motivo } = await abrirODialogo();
    await userEvent.selectOptions(nivel, "Sênior");
    await userEvent.selectOptions(time, "time-dados");
    await userEvent.type(motivo, "Promovida e pedida pelo outro time");
    await userEvent.click(dialogo.getByRole("button", { name: "Solicitar transferência" }));

    await waitFor(() =>
      expect(escritas).toEqual(["POST career-level-transition", "POST team-transfer-requests"]),
    );
    expect(corpoDa(TRANSICAO)).toMatchObject({ reason: "Promovida e pedida pelo outro time" });
    expect(corpoDa(SOLICITACAO)).toEqual({
      toTeamId: "time-dados",
      reason: "Promovida e pedida pelo outro time",
    });
  });
});

describe("/team — o tech lead não vê o botão", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state: fixtureState,
      routes: [careerLevelsRoute, emptyAuthUsersRoute, rotas],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("nem 'Mudar time ou nível' nem 'Transferências pendentes'", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");
    expect(screen.queryByRole("button", { name: /Mudar time ou nível/ })).toBeNull();
    expect(screen.queryByText("Transferências pendentes")).toBeNull();
  });
});
