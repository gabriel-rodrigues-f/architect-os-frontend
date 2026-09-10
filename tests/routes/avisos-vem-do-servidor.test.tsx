import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A Central de avisos chama `useRouter()` no render e desenha `<Link>`; ambos
 * exigem `RouterProvider` real. Mesmo motivo dos testes de `AppShell`.
 */
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
import { fixtureState, fixtureAssignedTechLeadUser } from "../helpers/fixtures";
import { jsonResponse, mockAppFetch, renderWithApp, type FetchRoute } from "../helpers/render-app";

/**
 * A caixa do lead era falha FECHADA: o mock recortava por ids de fixture que
 * nunca casavam com a sessão dele, e a caixa vivia vazia. Ligar o servidor
 * real não pode trocar isso por falha ABERTA — o lead vendo aviso de time
 * alheio.
 *
 * O VEÍCULO MUDOU em 2026-09-10: era o sino do cabeçalho, que o dono removeu.
 * É a Central de avisos que passa a responder por tudo o que ele respondia —
 * ela mostra a mesma caixa, marca o mesmo aviso por id e não soma nada por
 * conta própria. A contagem de não lidos, que o sino carregava no badge,
 * agora vive no item de menu e é prendida em
 * `tests/components/app/avisos-contam-no-menu.test.tsx`.
 *
 * O recorte de quem alcança o quê é do SERVIDOR (`NoticeInboxAuthorization`
 * compõe `visibleProfessionalIds` no backend). O que se prende aqui é o CONSUMO:
 * com o servidor devolvendo X, a tela mostra X e nada além — nada de fixture
 * residual, nada de item inventado, nada de contagem própria. E as duas
 * escritas endereçam SÓ a caixa de quem chama: `/notices/:id/read` e
 * `/notices/read-all` não carregam destinatário nenhum, então o navegador não
 * tem como mirar em outra caixa.
 */
const fetchMock = vi.fn();

const NoticesPage = NoticesRoute.options.component as () => ReactNode;

const AVISO_DO_TIME = {
  id: "aviso-do-time-do-lead",
  eventType: "mentoring.recorded",
  wording: { subjectName: "Bruno Almeida" },
  link: "/mentoring",
  occurredAt: "2026-08-29T12:00:00.000Z",
  readAt: null,
  professionalId: "demo-bruno-almeida",
  teamId: "time-do-lead",
};

/**
 * A frase que a TELA monta a partir do tipo e das peças (dono, 2026-09-08). O
 * servidor não a manda mais: é este teste que prova que ela nasce aqui.
 */
const FRASE_DO_AVISO = "Mentoria registrada para Bruno Almeida";

const caixaDoServidor = (notices: unknown[], unreadCount: number): FetchRoute => {
  const rota: FetchRoute = (href, init) =>
    href.includes(apiPath("/notices")) && (init?.method ?? "GET").toUpperCase() === "GET"
      ? jsonResponse({ notices, unreadCount })
      : undefined;
  return rota;
};

interface ChamadaDeEscrita {
  href: string;
  method: string;
  body: string | undefined;
}

const escritasDeAviso = (): ChamadaDeEscrita[] =>
  (fetchMock.mock.calls as [string | URL | Request, RequestInit | undefined][])
    .map(([input, init]) => ({
      href: String(input),
      method: (init?.method ?? "GET").toUpperCase(),
      body: typeof init?.body === "string" ? init.body : undefined,
    }))
    .filter((call) => call.method === "POST" && call.href.includes(apiPath("/notices")));

const montaSessaoDoLead = (rota: FetchRoute) => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAppFetch(fetchMock, {
    user: fixtureAssignedTechLeadUser,
    state: fixtureState,
    routes: [rota],
  });
};

describe("a Central de avisos do lead mostra a caixa que o servidor devolveu", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("mostra o aviso que o servidor devolveu", async () => {
    montaSessaoDoLead(caixaDoServidor([AVISO_DO_TIME], 1));
    renderWithApp(<NoticesPage />);
    expect(await screen.findByText(FRASE_DO_AVISO)).toBeTruthy();
  });

  it("não mostra nada além do que o servidor devolveu", async () => {
    montaSessaoDoLead(caixaDoServidor([AVISO_DO_TIME], 1));
    renderWithApp(<NoticesPage />);
    await screen.findByText(FRASE_DO_AVISO);
    expect(
      screen.getAllByText(/registrada|concluída|espera revisão|parada|rascunho/i),
    ).toHaveLength(1);
  });

  it("com a caixa vazia no servidor, diz que não há aviso em vez de inventar", async () => {
    montaSessaoDoLead(caixaDoServidor([], 0));
    renderWithApp(<NoticesPage />);
    expect(await screen.findByText(/nenhum aviso/i)).toBeTruthy();
  });
});

describe("as escritas de aviso endereçam só a caixa de quem chama", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("abrir um aviso não lido marca aquele aviso, por id, e mais nenhum", async () => {
    montaSessaoDoLead(caixaDoServidor([AVISO_DO_TIME], 1));
    renderWithApp(<NoticesPage />);
    await userEvent.click(await screen.findByText(FRASE_DO_AVISO));
    const escritas = escritasDeAviso();
    expect(escritas.map((call) => new URL(call.href).pathname)).toEqual([
      apiPath(`/notices/${AVISO_DO_TIME.id}/read`),
    ]);
  });

  it("marcar tudo como lido não carrega destinatário nenhum", async () => {
    montaSessaoDoLead(caixaDoServidor([AVISO_DO_TIME], 1));
    renderWithApp(<NoticesPage />);
    await screen.findByText(FRASE_DO_AVISO);
    await userEvent.click(screen.getByRole("button", { name: /marcar tod|mark all/i }));
    const escritas = escritasDeAviso().filter((call) => call.href.includes("read-all"));
    expect(escritas).toHaveLength(1);
    const [chamada] = escritas;
    const url = new URL(chamada!.href);
    expect(url.pathname).toBe(apiPath("/notices/read-all"));
    expect([...url.searchParams.keys()]).toEqual([]);
    expect(chamada!.body ?? "{}").not.toMatch(/professionalId|teamId|userId|readerId/);
  });
});
