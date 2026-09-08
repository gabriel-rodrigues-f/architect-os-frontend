import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A tela usa `useRouter` para navegar pelo hiperlink da linha. */
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useRouter: () => ({ history: { push: () => {} } }),
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

import { apiPath } from "@/lib/api-path";
import { Route as NoticesRoute } from "@/routes/notices";
import { fixtureAssignedTechLeadUser, fixtureState } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * Dono (2026-09-08), a tela de Avisos em três decisões:
 *   1. SELEÇÃO MÚLTIPLA — caixa por linha e "Marcar selecionados como lidos"
 *      ao lado da ação que marca todos. A rede aqui é a que importa: marcar
 *      os selecionados escreve SÓ nos escolhidos;
 *   2. A DATA SAI DO AGRUPAMENTO e entra na linha (`título - dd/mm/aaaa`).
 *      Não há mais cabeçalho de data acima do grupo, e não nasceu filtro de
 *      data nenhum;
 *   3. o filtro "Mostrar" continua como estava.
 */
const fetchMock = vi.fn();

const NoticesPage = NoticesRoute.options.component as () => ReactNode;

const aviso = (id: string, title: string, occurredAt: string) => ({
  id,
  eventType: "mentoring.recorded",
  title,
  link: "/mentoring",
  occurredAt,
  readAt: null,
  professionalId: "demo-bruno-almeida",
  teamId: "time-do-lead",
});

const DE_ONTEM = aviso("aviso-de-ontem", "Mentoria de ontem", "2026-08-27T12:00:00.000Z");
const DE_HOJE = aviso("aviso-de-hoje", "Mentoria de hoje", "2026-08-28T12:00:00.000Z");

const caixaDoServidor: FetchRoute = (href, init) =>
  String(href).includes(apiPath("/notices")) && (init?.method ?? "GET").toUpperCase() === "GET"
    ? jsonResponse({ notices: [DE_ONTEM, DE_HOJE], unreadCount: 2 })
    : undefined;

const escritasDeLeitura = (): string[] =>
  (fetchMock.mock.calls as [string | URL | Request, RequestInit | undefined][])
    .filter(([, init]) => (init?.method ?? "GET").toUpperCase() === "POST")
    .map(([input]) => new URL(String(input), "http://localhost").pathname)
    .filter((pathname) => pathname.startsWith(apiPath("/notices")));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user: fixtureAssignedTechLeadUser,
    state: fixtureState,
    routes: [caixaDoServidor],
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("a seleção múltipla marca só os escolhidos", () => {
  it("cada linha tem a própria caixa, nomeada pelo aviso", async () => {
    renderWithApp(<NoticesPage />);
    await screen.findByText("Mentoria de hoje");
    expect(
      screen.getByRole("checkbox", { name: "Selecionar aviso: Mentoria de hoje" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "Selecionar aviso: Mentoria de ontem" }),
    ).toBeTruthy();
  });

  it("sem nada selecionado, a ação não age — e a contagem diz zero", async () => {
    renderWithApp(<NoticesPage />);
    await screen.findByText("Mentoria de hoje");
    const acao = screen.getByRole("button", { name: "Marcar selecionados como lidos" });
    expect(acao.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("0 selecionado(s)");
  });

  it("marcar os selecionados escreve SÓ nos escolhidos", async () => {
    renderWithApp(<NoticesPage />);
    await screen.findByText("Mentoria de hoje");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Selecionar aviso: Mentoria de hoje" }),
    );
    expect(screen.getByRole("status").textContent).toBe("1 selecionado(s)");
    await userEvent.click(screen.getByRole("button", { name: "Marcar selecionados como lidos" }));
    expect(escritasDeLeitura()).toEqual([apiPath(`/notices/${DE_HOJE.id}/read`)]);
  });

  it("a ação de marcar TODOS continua na tela, ao lado da de selecionados", async () => {
    renderWithApp(<NoticesPage />);
    await screen.findByText("Mentoria de hoje");
    await userEvent.click(screen.getByRole("button", { name: /marcar todos/i }));
    expect(escritasDeLeitura()).toEqual([apiPath("/notices/read-all")]);
  });
});

describe("a data entra na linha e some do agrupamento", () => {
  it("cada linha mostra `título - dd/mm/aaaa`", async () => {
    renderWithApp(<NoticesPage />);
    const linha = await screen.findByRole("button", { name: /Mentoria de hoje/ });
    expect(linha.textContent).toContain("Mentoria de hoje - 28/08/2026");
  });

  it("não há mais cabeçalho de data acima de grupo nenhum", async () => {
    renderWithApp(<NoticesPage />);
    await screen.findByText("Mentoria de hoje");
    for (const cabecalho of screen.queryAllByRole("heading")) {
      expect(cabecalho.textContent ?? "").not.toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }
  });

  it("o filtro 'Mostrar' continua, e não nasceu filtro de data", async () => {
    renderWithApp(<NoticesPage />);
    await screen.findByText("Mentoria de hoje");
    expect(screen.getByText("Mostrar")).toBeTruthy();
    expect(screen.queryByLabelText(/data/i)).toBeNull();
  });
});

describe("toda linha leva ao destino do aviso", () => {
  it("o hiperlink da linha aponta para a Mentoria filtrada naquela pessoa", async () => {
    renderWithApp(<NoticesPage />);
    await screen.findByText("Mentoria de hoje");
    const links = screen.getAllByRole("link", { name: "Clique para visualizar" });
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute("href")).toBe("/mentoring?menteeId=demo-bruno-almeida");
  });

  it("clicar na linha marca aquele aviso como lido, por id", async () => {
    renderWithApp(<NoticesPage />);
    await userEvent.click(await screen.findByText("Mentoria de hoje"));
    expect(escritasDeLeitura()).toEqual([apiPath(`/notices/${DE_HOJE.id}/read`)]);
  });

  it("clicar no hiperlink também marca — uma vez só", async () => {
    renderWithApp(<NoticesPage />);
    await screen.findByText("Mentoria de hoje");
    await userEvent.click(screen.getAllByRole("link", { name: "Clique para visualizar" })[0]!);
    expect(escritasDeLeitura()).toEqual([apiPath(`/notices/${DE_HOJE.id}/read`)]);
  });
});
