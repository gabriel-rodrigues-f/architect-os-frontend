import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Mesmo motivo dos outros testes do sino: `useRouter`/`Link` exigem router real. */
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

import { NoticeBell } from "@/components/app/NoticeBell";
import { apiPath } from "@/lib/api-path";
import { fixtureAssignedTechLeadUser, fixtureState } from "../../helpers/fixtures";
import {
  jsonResponse,
  mockAppFetch,
  renderWithApp,
  type FetchRoute,
} from "../../helpers/render-app";

/**
 * Dono (2026-09-08): *"'Ver mais' passa a carregar +10 usando o cursor da
 * API, e o modal cresce até o fim da tela com respiro, rolando por dentro"*.
 *
 * O que se prende aqui é a PAGINAÇÃO: cada clique pede a PRÓXIMA fatia pelo
 * cursor `before`, e não a lista inteira de novo. A regressão que isto
 * impede é a mais barata de escrever e a mais cara de perceber — recarregar
 * tudo funciona na tela e só aparece na conta do servidor.
 */
const fetchMock = vi.fn();

const aviso = (indice: number, dia: string) => ({
  id: `aviso-${String(indice)}`,
  eventType: "mentoring.recorded",
  title: `Mentoria registrada número ${String(indice)}`,
  link: "/mentoring",
  occurredAt: `2026-08-${dia}T12:00:00.000Z`,
  readAt: null,
  professionalId: "demo-bruno-almeida",
  teamId: "time-do-lead",
});

/** Cinco na primeira página, dez na segunda — os tamanhos que o dono pediu. */
const PRIMEIRA = [aviso(1, "28"), aviso(2, "27"), aviso(3, "26"), aviso(4, "25"), aviso(5, "24")];
const SEGUNDA = Array.from({ length: 10 }, (_, indice) =>
  aviso(indice + 6, String(23 - indice).padStart(2, "0")),
);

interface Leitura {
  limit: string | null;
  before: string | null;
}

const leiturasDeAviso = (): Leitura[] =>
  (fetchMock.mock.calls as [string | URL | Request, RequestInit | undefined][])
    .map(([input, init]) => ({
      url: new URL(String(input), "http://localhost"),
      method: (init?.method ?? "GET").toUpperCase(),
    }))
    .filter((call) => call.method === "GET" && call.url.pathname === apiPath("/notices"))
    .map((call) => ({
      limit: call.url.searchParams.get("limit"),
      before: call.url.searchParams.get("before"),
    }));

const caixaPaginada: FetchRoute = (href, init) => {
  const url = new URL(String(href), "http://localhost");
  if (url.pathname !== apiPath("/notices") || (init?.method ?? "GET").toUpperCase() !== "GET") {
    return undefined;
  }
  const before = url.searchParams.get("before");
  return jsonResponse({ notices: before === null ? PRIMEIRA : SEGUNDA, unreadCount: 15 });
};

const abreOSino = async () =>
  userEvent.click(await screen.findByRole("button", { name: /avisos/i }));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user: fixtureAssignedTechLeadUser,
    state: fixtureState,
    routes: [caixaPaginada],
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("o sino pagina pelo cursor, sem recarregar o que já veio", () => {
  it("a primeira abertura pede cinco avisos, sem cursor", async () => {
    renderWithApp(<NoticeBell />);
    await abreOSino();
    await screen.findByText("Mentoria registrada número 1");
    expect(leiturasDeAviso()).toEqual([{ limit: "5", before: null }]);
  });

  it("'Ver mais' pede +10 A PARTIR do aviso mais antigo já recebido", async () => {
    renderWithApp(<NoticeBell />);
    await abreOSino();
    await screen.findByText("Mentoria registrada número 5");
    await userEvent.click(screen.getByRole("button", { name: "Ver mais" }));
    await screen.findByText("Mentoria registrada número 6");
    expect(leiturasDeAviso()).toEqual([
      { limit: "5", before: null },
      { limit: "10", before: PRIMEIRA[4]!.occurredAt },
    ]);
  });

  it("o que já estava na tela continua lá — a segunda página SOMA, não substitui", async () => {
    renderWithApp(<NoticeBell />);
    await abreOSino();
    await screen.findByText("Mentoria registrada número 1");
    await userEvent.click(screen.getByRole("button", { name: "Ver mais" }));
    await screen.findByText("Mentoria registrada número 15");
    expect(screen.getByText("Mentoria registrada número 1")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Clique para visualizar" })).toHaveLength(15);
  });

  it("página incompleta é o fim da caixa: o 'Ver mais' some", async () => {
    fetchMock.mockReset();
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state: fixtureState,
      routes: [
        (href, init) =>
          new URL(String(href), "http://localhost").pathname === apiPath("/notices") &&
          (init?.method ?? "GET").toUpperCase() === "GET"
            ? jsonResponse({ notices: PRIMEIRA.slice(0, 2), unreadCount: 2 })
            : undefined,
      ],
    });
    renderWithApp(<NoticeBell />);
    await abreOSino();
    await screen.findByText("Mentoria registrada número 1");
    expect(screen.queryByRole("button", { name: "Ver mais" })).toBeNull();
  });
});

describe("a caixa do sino cresce até o fim da tela e rola por dentro", () => {
  it("a altura máxima é a medida pelo navegador, não um número fixo", async () => {
    renderWithApp(<NoticeBell />);
    await abreOSino();
    const caixa = await screen.findByRole("dialog");
    expect(caixa.className).toContain("max-h-(--radix-popover-content-available-height)");
    expect(caixa.className).toContain("flex-col");
  });

  it("a lista rola por dentro, com a barra sempre visível", async () => {
    renderWithApp(<NoticeBell />);
    await abreOSino();
    const caixa = await screen.findByRole("dialog");
    const rolagem = within(caixa)
      .getByText("Mentoria registrada número 1")
      .closest(".overflow-y-auto");
    expect(rolagem).toBeTruthy();
    expect(rolagem?.className).toContain("scroll-visible");
  });
});
