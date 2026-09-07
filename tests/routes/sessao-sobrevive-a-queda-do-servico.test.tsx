import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGate } from "@/components/app/AuthGate";
import { Toaster } from "@/components/ui/sonner";
import { apiPath } from "@/lib/api-path";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { SessionBootstrapReader } from "@/lib/session-bootstrap";
import { fixtureAdminUser } from "../helpers/fixtures";
import { jsonResponse } from "../helpers/render-app";

/**
 * Dono (2026-09-07), literal: "eu estava logado, derrubei o backend
 * propositalmente e comecei a jogar o joguinho. quando atualizei a tela fui
 * deslogado. isso não pode ocorrer, somente se o token do frontend expirar".
 *
 * O portão tratava QUALQUER falha do `/auth/me` da montagem como "ninguém
 * logado" e desenhava o login. Queda do serviço não é 401: a sessão continua
 * no cookie, e a aplicação não tem como saber se ela vale — então não decide.
 * Fica na tela de serviço fora (a mesma de toda a aplicação, com a corrida),
 * insiste no `/auth/me`, e só quando o serviço responde é que escolhe: 200
 * abre a aplicação sem login; 401 abre o login.
 */

const fetchMock = vi.fn();

/**
 * O portão reavalia as guardas de rota quando a sessão abre (`router.invalidate`).
 * Aqui não há roteador — o objeto sob teste é o portão, não a navegação.
 */
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useRouter: () => ({ invalidate: () => Promise.resolve() }),
}));

class ServidorQueCaiu {
  /** O que o serviço está respondendo: `null` é rede sem resposta. */
  resposta: (() => Response) | null = null;

  leiturasDoMe = 0;

  responder = (input: string | URL | Request): Promise<Response> => {
    const href = input instanceof Request ? input.url : String(input);
    if (href.endsWith(apiPath("/auth/me"))) this.leiturasDoMe += 1;
    if (this.resposta === null) return Promise.reject(new TypeError("fetch failed"));
    return Promise.resolve(this.resposta());
  };

  static sessaoAberta(): () => Response {
    return () => jsonResponse({ data: fixtureAdminUser });
  }

  static semSessao(): () => Response {
    return () =>
      jsonResponse({ code: "AUTHENTICATION_REQUIRED", message: "Autenticação necessária." }, 401);
  }

  static portaSemServico(): () => Response {
    return () => new Response("Bad Gateway", { status: 502 });
  }
}

let servidor: ServidorQueCaiu;

function subirOPortao() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AuthGate>
            <p>APLICAÇÃO ABERTA</p>
          </AuthGate>
          <Toaster theme="light" position="bottom-right" duration={3000} />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

const AVISO_DE_SESSAO_EXPIRADA = "Sua sessão expirou. Faça login novamente.";

beforeEach(() => {
  window.localStorage.setItem("synapse:locale", "pt");
  // A corrida escolhe as palavras pelo navegador; o teste fala português.
  vi.stubGlobal("navigator", { ...window.navigator, languages: ["pt-BR"] });
  servidor = new ServidorQueCaiu();
  fetchMock.mockReset();
  fetchMock.mockImplementation(servidor.responder);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  toast.dismiss();
});

describe("a sessão sobrevive à queda do serviço", () => {
  it("rede sem resposta na montagem: a tela de serviço fora, NÃO o login, e nenhum aviso de sessão expirada", async () => {
    subirOPortao();

    expect(await screen.findByTestId("service-outage")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Corrida de carreira/ })).toBeTruthy();
    expect(screen.queryByLabelText("E-mail")).toBeNull();
    expect(screen.queryByRole("button", { name: "Entrar" })).toBeNull();
    expect(screen.queryByText(AVISO_DE_SESSAO_EXPIRADA)).toBeNull();
  });

  it("502 na porta é queda também — não é login", async () => {
    servidor.resposta = ServidorQueCaiu.portaSemServico();
    subirOPortao();

    expect(await screen.findByTestId("service-outage")).toBeTruthy();
    expect(screen.queryByLabelText("E-mail")).toBeNull();
  });

  it("quando a tentativa seguinte responde 200, a aplicação abre com o usuário — sem passar pelo login", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    subirOPortao();
    await screen.findByTestId("service-outage");
    expect(servidor.leiturasDoMe).toBe(1);

    servidor.resposta = ServidorQueCaiu.sessaoAberta();
    await act(() => vi.advanceTimersByTimeAsync(SessionBootstrapReader.RETRY_INTERVAL_MS));

    expect(await screen.findByText("APLICAÇÃO ABERTA")).toBeTruthy();
    expect(screen.queryByLabelText("E-mail")).toBeNull();
    expect(screen.queryByText(AVISO_DE_SESSAO_EXPIRADA)).toBeNull();
  });

  it("o Recarregar da tela de queda relê a sessão na hora", async () => {
    subirOPortao();
    await screen.findByTestId("service-outage");

    servidor.resposta = ServidorQueCaiu.sessaoAberta();
    await userEvent.click(screen.getByRole("button", { name: "Recarregar" }));

    expect(await screen.findByText("APLICAÇÃO ABERTA")).toBeTruthy();
  });

  it("o serviço que volta respondendo 401 leva ao login", async () => {
    subirOPortao();
    await screen.findByTestId("service-outage");

    servidor.resposta = ServidorQueCaiu.semSessao();
    await userEvent.click(screen.getByRole("button", { name: "Recarregar" }));

    await waitFor(() => expect(screen.getByLabelText("E-mail")).toBeTruthy());
    expect(screen.queryByTestId("service-outage")).toBeNull();
    expect(screen.queryByText(AVISO_DE_SESSAO_EXPIRADA)).toBeNull();
  });

  it("401 na montagem continua sendo login", async () => {
    servidor.resposta = ServidorQueCaiu.semSessao();
    subirOPortao();

    await waitFor(() => expect(screen.getByLabelText("E-mail")).toBeTruthy());
    expect(screen.queryByTestId("service-outage")).toBeNull();
    expect(screen.queryByText(AVISO_DE_SESSAO_EXPIRADA)).toBeNull();
  });
});
