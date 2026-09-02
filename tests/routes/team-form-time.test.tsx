import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `<Link>` do TanStack Router precisa de um `RouterProvider` real; a tela de
 * Time usa `<Link>` nos cards. Troca por âncora comum — não é o que se testa.
 */
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
 * Onda 33 — achado (2) da revisão de PO (2026-09-02): "'Editar arquiteto' e
 * 'Novo arquiteto' (tela Time) não têm campo de time. Hoje um time só ganha
 * gente pelo import." O campo "Time" oferece os times ATIVOS e "Sem time", e
 * viaja como `teamId` no cadastro e na edição que já existem.
 */
const fetchMock = vi.fn();

const TeamPage = TeamRoute.options.component as () => ReactNode;

const times = [
  { id: fixtureTeamId, name: "Time Plataforma", active: true },
  { id: "time-dados", name: "Time Dados", active: true },
  { id: "time-legado", name: "Time Legado", active: false },
];

const rotaDeTimes: FetchRoute = (href, init) =>
  href.endsWith(apiPath("/teams")) && (init?.method ?? "GET") === "GET"
    ? jsonResponse(times)
    : undefined;

const rotaDeEscrita: FetchRoute = (href, init) => {
  if (init?.method === "POST" && href.endsWith(apiPath("/architects"))) {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    return jsonResponse({ ...body, id: "nova", active: true, version: 1 }, 201);
  }
  if (init?.method === "PATCH" && href.endsWith(apiPath("/architects/ana"))) {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    return jsonResponse({ ...fixtureState.architects[0], ...body });
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

const preencherObrigatorios = async (dialogo: HTMLElement) => {
  const campos = within(dialogo);
  await userEvent.type(campos.getByLabelText("Nome"), "Nova Pessoa");
  await userEvent.type(campos.getByLabelText("E-mail"), "nova.pessoa@company.com");
  await userEvent.type(campos.getByLabelText("Tempo como arquiteto (anos)"), "2");
};

describe("Time — o campo Time no cadastro e na edição do arquiteto", () => {
  beforeEach(() => {
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
    vi.unstubAllGlobals();
  });

  it("o cadastro oferece 'Sem time' e só os times ativos, e envia o escolhido como teamId", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");

    await userEvent.click(screen.getByRole("button", { name: "Cadastrar arquiteto" }));
    const dialogo = await screen.findByRole("dialog");
    const select = (await within(dialogo).findByLabelText("Time")) as HTMLSelectElement;
    await waitFor(() => expect(select.options.length).toBe(3));
    expect(Array.from(select.options).map((opcao) => opcao.textContent)).toEqual([
      "Sem time",
      "Time Plataforma",
      "Time Dados",
    ]);
    expect(select.value).toBe("");

    await preencherObrigatorios(dialogo);
    await userEvent.selectOptions(select, "time-dados");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(corpoDa("POST", apiPath("/architects"))["teamId"]).toBe("time-dados"),
    );
  });

  it("cadastrar sem time não inventa teamId no corpo", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");

    await userEvent.click(screen.getByRole("button", { name: "Cadastrar arquiteto" }));
    const dialogo = await screen.findByRole("dialog");
    await preencherObrigatorios(dialogo);
    await userEvent.click(within(dialogo).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(corpoDa("POST", apiPath("/architects"))).not.toHaveProperty("teamId"),
    );
  });

  /**
   * Onda 35 — achado 17 do dono (2026-09-02): "Depois de cadastrado, o time
   * não muda pelo lápis; só pelo diálogo da setinha, com motivo obrigatório."
   * O lápis (Editar) perde o campo Time e o PATCH não carrega `teamId`.
   */
  it("editar NÃO oferece o campo Time e o PATCH não carrega teamId — o time muda só por 'Mudar time ou nível'", async () => {
    renderWithApp(<TeamPage />);
    await screen.findByText("Ana Martins");

    await userEvent.click(screen.getByLabelText("Editar Ana Martins"));
    const dialogo = await screen.findByRole("dialog");
    await within(dialogo).findByLabelText("Nome");
    expect(within(dialogo).queryByLabelText("Time")).toBeNull();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(corpoDa("PATCH", apiPath("/architects/ana"))).not.toHaveProperty("teamId"),
    );
  });
});
