import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** `Route.useParams()` da ficha exige árvore montada — mesmo mock de `estrangulamento-perfil`. */
const parametrosDaRota = vi.hoisted(() => ({ architectId: "carla" }));

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
    createFileRoute:
      (..._args: unknown[]) =>
      (options: Record<string, unknown>) => ({
        ...options,
        options,
        useParams: () => parametrosDaRota,
      }),
  };
});

import type { AppState } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import type { Architect } from "@/lib/domain";
import { Route as ArchitectRoute } from "@/routes/architects.$architectId.index";
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
 * ONDA 37 (backend ADR-0084) — cargo e senioridade se separaram: gestor e
 * tech lead nascem SEM senioridade e o servidor devolve `role: null` e
 * `careerLevelId: null` nesses profissionais.
 *
 * O invariante que faltava, e que teria pego o defeito: UM item sem
 * senioridade não pode derrubar a LISTA INTEIRA. O contrato do frontend
 * exigia `role: string`, então o `/state` inteiro morria com ZodError e a
 * aplicação não renderizava para admin, gestor nem tech lead.
 *
 * Onde a senioridade é RÓTULO (coluna do Time, ficha), a ausência aparece
 * como travessão — o símbolo que `frontend/DECISOES.md` já reservou para
 * ausência. Onde a leitura é POR NÍVEL (o filtro de nível de carreira), quem
 * não tem senioridade fica de fora da leitura e continua contado como pessoa.
 */
const fetchMock = vi.fn();

const TeamPage = TeamRoute.options.component as () => ReactNode;
const ArchitectPage = ArchitectRoute.options.component as () => ReactNode;

const SEM_SENIORIDADE = "carla";

/** O tech lead do time: cargo sim, senioridade não. */
const carla: Architect = {
  id: SEM_SENIORIDADE,
  name: "Carla Ribeiro",
  role: null,
  careerLevelId: null,
  yearsAsArchitect: 9,
  specialization: "Platform",
  email: "carla@company.com",
  active: true,
  teamId: fixtureTeamId,
  version: 1,
};

const stateComLideranca: AppState = {
  ...fixtureState,
  architects: [...fixtureState.architects, carla],
};

const times = [
  { id: fixtureTeamId, name: "Time Plataforma", active: true },
  { id: "time-dados", name: "Time Dados", active: true },
];

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(times)
    : undefined;

const ALOCACAO = apiPath(`/architects/${SEM_SENIORIDADE}/team-allocation`);
const TRANSICAO = apiPath(`/architects/${SEM_SENIORIDADE}/career-level-transition`);

const escritas: string[] = [];

const rotaDeEscrita: FetchRoute = (href, init) => {
  if (init?.method === "POST" && href.endsWith(TRANSICAO)) {
    escritas.push("POST career-level-transition");
    return jsonResponse(carla);
  }
  if (init?.method === "POST" && href.endsWith(ALOCACAO)) {
    escritas.push("POST team-allocation");
    const body = JSON.parse(String(init.body)) as { teamId: string };
    return jsonResponse({
      data: { ...carla, teamId: body.teamId, version: 2 },
      message: { code: "people.allocate.success" },
    });
  }
  return undefined;
};

const montarTime = (): void => {
  mockAppFetch(fetchMock, {
    user: fixtureAdminUser,
    state: stateComLideranca,
    routes: [careerLevelsRoute, emptyAuthUsersRoute, rotaDeTimes, rotaDeEscrita],
  });
};

describe("ONDA 37 — quem não tem senioridade não derruba a tela", () => {
  beforeEach(() => {
    escritas.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("um profissional sem senioridade no /state não derruba a leitura — a lista renderiza e ele aparece", async () => {
    montarTime();
    renderWithApp(<TeamPage />);

    expect(await screen.findByText("Carla Ribeiro")).toBeTruthy();
    expect(screen.getByText("Ana Martins")).toBeTruthy();
    expect(screen.getByText("Bruno Almeida")).toBeTruthy();
  });

  it("o mesmo vale para as telas que vivem de contexto, sem o blob /state", async () => {
    montarTime();
    renderWithApp(<TeamPage />, { storeMode: "contexts" });

    expect(await screen.findByText("Carla Ribeiro")).toBeTruthy();
  });

  it("na tabela do Time a senioridade ausente é o travessão, e a ausência tem nome acessível", async () => {
    montarTime();
    renderWithApp(<TeamPage />);
    await screen.findByText("Carla Ribeiro");

    await userEvent.click(screen.getByRole("button", { name: "Tabela" }));

    const linha = screen.getByText("Carla Ribeiro").closest("tr");
    if (!linha) throw new Error("linha de Carla não encontrada");
    const celula = within(linha).getByTitle("Sem senioridade");
    expect(celula.textContent).toBe("—");
  });

  it("na ficha da pessoa a senioridade ausente é o travessão, nunca 'null'", async () => {
    montarTime();
    renderWithApp(<ArchitectPage />);

    const cabecalho = await screen.findByText(/9 anos/);
    expect(cabecalho.textContent).toContain("—");
    expect(cabecalho.textContent).not.toContain("null");
  });

  it("a leitura POR NÍVEL deixa de fora quem não tem senioridade e continua contando a pessoa", async () => {
    montarTime();
    renderWithApp(<TeamPage />);
    await screen.findByText("Carla Ribeiro");

    await userEvent.click(screen.getByLabelText("Nível de carreira"));
    await userEvent.click(await screen.findByText("Todos os níveis"));

    await waitFor(() => expect(screen.queryByText("Carla Ribeiro")).toBeNull());
    expect(screen.getByText("Ana Martins")).toBeTruthy();
    expect(screen.getByText("2 de 3")).toBeTruthy();
  });

  it("'Mudar time ou nível' não oferece senioridade a quem não tem, e muda só o time", async () => {
    montarTime();
    renderWithApp(<TeamPage />);
    await screen.findByText("Carla Ribeiro");

    await userEvent.click(
      screen.getByRole("button", { name: "Mudar time ou nível de Carla Ribeiro" }),
    );
    const dialogo = within(await screen.findByRole("dialog"));
    expect(dialogo.queryByLabelText("Novo nível")).toBeNull();

    const time = (await dialogo.findByLabelText("Novo time")) as HTMLSelectElement;
    await waitFor(() => expect(time.options.length).toBe(3));
    await userEvent.selectOptions(time, "time-dados");
    await userEvent.type(dialogo.getByLabelText("Motivo da mudança"), "Assumiu o time de Dados");
    await userEvent.click(dialogo.getByRole("button", { name: "Confirmar mudança" }));

    await waitFor(() => expect(escritas).toEqual(["POST team-allocation"]));
  });
});
