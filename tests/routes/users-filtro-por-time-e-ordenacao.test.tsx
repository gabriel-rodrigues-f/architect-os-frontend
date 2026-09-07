import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiPath } from "@/lib/api-path";
import type { SessionUser } from "@/lib/api";
import { Route as UsersRoute } from "@/routes/users";
import {
  fixtureAdminUser,
  fixtureAssignedManagerUser,
  fixtureMemberUser,
  fixtureState,
  scopedFixtureStateFor,
} from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Dono (2026-09-06): "Em Usuários > Contas cadastradas deve ser possível
 * filtrar por time. Cada título (Nome, E-mail, Cargo, Status) deve ter uma
 * setinha para asc/desc." O time da conta é o do VÍNCULO; sem vínculo, "Sem
 * time". Para o gerente, o filtro oferece só os times dele.
 */
const fetchMock = vi.fn();
const UsersPage = UsersRoute.options.component as () => ReactNode;

const TIMES = [
  { id: "time-plataforma", name: "Plataforma", active: true },
  { id: "time-dados", name: "Dados", active: true },
];

const conta = (id: string, name: string, extra: Partial<SessionUser> = {}): SessionUser => ({
  ...fixtureMemberUser,
  id,
  name,
  email: `${id}@empresa.com`,
  ...extra,
});

const contas: SessionUser[] = [
  conta("carla", "Carla Souza", {
    role: "tech_lead",
    status: "disabled",
    memberships: [{ teamId: "time-dados", role: "tech_lead" }],
  }),
  conta("ana", "Ana Martins", { memberships: [{ teamId: "time-plataforma", role: "member" }] }),
  { ...fixtureAdminUser, id: "bruno", name: "Bruno Admin", email: "bruno@empresa.com" },
];

const rotaDeContas: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/auth/users")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(contas)
    : undefined;

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(TIMES)
    : undefined;

function renderAs(user: SessionUser) {
  mockAppFetch(fetchMock, {
    user,
    state: user === fixtureAdminUser ? fixtureState : scopedFixtureStateFor(user),
    routes: [rotaDeContas, rotaDeTimes],
  });
  return renderWithApp(<UsersPage />);
}

const nomesNaTabela = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent?.trim());

const cabecalho = (coluna: string) =>
  screen.getByRole("button", { name: `Ordenar por ${coluna}` }).closest("th") as HTMLElement;

const filtroDeTime = () => screen.findByLabelText("Time", { selector: "button" });

async function escolherTime(nome: string) {
  await userEvent.click(await filtroDeTime());
  await userEvent.click(screen.getByRole("option", { name: nome }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Usuários — filtro por time", () => {
  it("mostra o time de cada conta pelo vínculo, e 'Sem time' para quem não tem", async () => {
    renderAs(fixtureAdminUser);
    const linhaDaAna = (await screen.findByText("Ana Martins")).closest("tr") as HTMLElement;
    const linhaDoBruno = screen.getByText("Bruno Admin").closest("tr") as HTMLElement;
    expect(within(linhaDaAna).getByText("Plataforma")).toBeTruthy();
    expect(within(linhaDoBruno).getByText("Sem time")).toBeTruthy();
  });

  it("o admin filtra por qualquer time e por 'Sem time'", async () => {
    renderAs(fixtureAdminUser);
    await screen.findByText("Ana Martins");

    await escolherTime("Dados");
    expect(nomesNaTabela()).toEqual(["Carla Souza"]);

    await escolherTime("Sem time");
    expect(nomesNaTabela()).toEqual(["Bruno Admin"]);

    await escolherTime("Todos os times");
    expect(nomesNaTabela()).toHaveLength(3);
  });

  it("para o gerente, o filtro oferece só os times dele", async () => {
    renderAs(fixtureAssignedManagerUser);
    await screen.findByText("Ana Martins");

    await userEvent.click(await filtroDeTime());
    expect(screen.getByRole("option", { name: "Todos os times" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Plataforma" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Dados" })).toBeNull();
  });
});

describe("Usuários — cada título ordena nos dois sentidos, com aria-sort", () => {
  it("nasce por nome ascendente; clicar em Nome inverte", async () => {
    renderAs(fixtureAdminUser);
    await screen.findByText("Ana Martins");
    expect(cabecalho("Nome").getAttribute("aria-sort")).toBe("ascending");
    expect(nomesNaTabela()).toEqual(["Ana Martins", "Bruno Admin", "Carla Souza"]);

    await userEvent.click(screen.getByRole("button", { name: "Ordenar por Nome" }));
    expect(cabecalho("Nome").getAttribute("aria-sort")).toBe("descending");
    expect(nomesNaTabela()).toEqual(["Carla Souza", "Bruno Admin", "Ana Martins"]);
  });

  // Empate (duas contas ativas) desempata pelo nome nos DOIS sentidos.
  it.each([
    [
      "E-mail",
      ["Ana Martins", "Bruno Admin", "Carla Souza"],
      ["Carla Souza", "Bruno Admin", "Ana Martins"],
    ],
    [
      "Cargo",
      ["Bruno Admin", "Ana Martins", "Carla Souza"],
      ["Carla Souza", "Ana Martins", "Bruno Admin"],
    ],
    [
      "Status",
      ["Ana Martins", "Bruno Admin", "Carla Souza"],
      ["Carla Souza", "Ana Martins", "Bruno Admin"],
    ],
    [
      "Time",
      ["Carla Souza", "Ana Martins", "Bruno Admin"],
      ["Bruno Admin", "Ana Martins", "Carla Souza"],
    ],
  ])("por %s: ascendente, depois descendente", async (coluna, ascendente, descendente) => {
    renderAs(fixtureAdminUser);
    await screen.findByText("Ana Martins");

    await userEvent.click(screen.getByRole("button", { name: `Ordenar por ${coluna}` }));
    expect(cabecalho(coluna).getAttribute("aria-sort")).toBe("ascending");
    expect(cabecalho("Nome").getAttribute("aria-sort")).toBe("none");
    expect(nomesNaTabela()).toEqual(ascendente);

    await userEvent.click(screen.getByRole("button", { name: `Ordenar por ${coluna}` }));
    expect(cabecalho(coluna).getAttribute("aria-sort")).toBe("descending");
    expect(nomesNaTabela()).toEqual(descendente);
  });
});
