import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
 * Dono, 2026-09-09: *"ao se clicar em uma linha, todo o modal de notificações
 * é fechado. Isso não pode ocorrer. Se eu clicar em uma linha já lida, nada
 * acontece. Se eu clicar em uma linha ainda não lida, deve marcar como lido.
 * Só deve fechar o modal se eu clicar fora ou no ícone do sininho."*
 *
 * A causa era uma linha: **cada item da lista era embrulhado num "fechar o
 * popover"**. O gesto de marcar como lida e o gesto de sair da caixa eram o
 * mesmo, então ler um aviso custava perder a lista — e quem tinha quinze
 * precisava reabrir quinze vezes.
 *
 * A régua que fica: a LINHA marca como lida e não fecha; o LINK navega, e aí
 * fechar é consequência de sair, não de ler.
 */
const fetchMock = vi.fn();

const aviso = (indice: number, lido: boolean) => ({
  id: `aviso-${String(indice)}`,
  eventType: "mentoring.recorded",
  wording: { subjectName: `Pessoa ${String(indice)}` },
  link: "/mentoring",
  occurredAt: `2026-08-2${String(indice)}T12:00:00.000Z`,
  readAt: lido ? "2026-08-29T12:00:00.000Z" : null,
  professionalId: "demo-bruno-almeida",
  teamId: "time-do-lead",
});

const caixa: FetchRoute = (href, init) => {
  const url = new URL(String(href), "http://localhost");
  if (url.pathname !== apiPath("/notices") || (init?.method ?? "GET").toUpperCase() !== "GET") {
    return undefined;
  }
  return jsonResponse({ notices: [aviso(1, false), aviso(2, true)], unreadCount: 1 });
};

const marcacoes = () =>
  (fetchMock.mock.calls as [string | URL | Request, RequestInit | undefined][]).filter(
    ([input, init]) =>
      (init?.method ?? "GET").toUpperCase() === "POST" && String(input).includes("/read"),
  );

const abrirOSino = async () =>
  userEvent.click(await screen.findByRole("button", { name: /avisos/i }));

/** A linha inteira, não o link de dentro dela. */
const linhaDe = (frase: string) => screen.getByText(frase).closest("div[class*='cursor-pointer']")!;

describe("o sino não fecha quando a pessoa marca um aviso como lido", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    mockAppFetch(fetchMock, {
      user: fixtureAssignedTechLeadUser,
      state: fixtureState,
      routes: [caixa],
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("clicar numa linha NÃO LIDA marca como lida e a caixa continua aberta", async () => {
    renderWithApp(<NoticeBell />);
    await abrirOSino();
    await screen.findByText("Mentoria registrada para Pessoa 1");

    await userEvent.click(linhaDe("Mentoria registrada para Pessoa 1"));

    expect(marcacoes()).toHaveLength(1);
    expect(screen.queryByText("Mentoria registrada para Pessoa 2")).not.toBeNull();
  });

  it("clicar numa linha JÁ LIDA não marca nada, e a caixa continua aberta", async () => {
    renderWithApp(<NoticeBell />);
    await abrirOSino();
    await screen.findByText("Mentoria registrada para Pessoa 2");

    await userEvent.click(linhaDe("Mentoria registrada para Pessoa 2"));

    expect(marcacoes()).toHaveLength(0);
    expect(screen.queryByText("Mentoria registrada para Pessoa 1")).not.toBeNull();
  });
});
