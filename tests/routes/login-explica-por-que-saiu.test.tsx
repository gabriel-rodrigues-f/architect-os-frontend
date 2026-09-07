import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGate } from "@/components/app/AuthGate";
import { api } from "@/lib/api";
import { apiPath } from "@/lib/api-path";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { SessionEndMemory } from "@/lib/session-end-reason";
import { fixtureAdminUser } from "../helpers/fixtures";
import { jsonResponse } from "../helpers/render-app";

/**
 * PR 9 — a tela de login EXPLICA por que a pessoa saiu ([FA-01], [FA-02]).
 * Relatório do dono, itens 47–49: inatividade e expiração ganham uma frase
 * informativa (não é erro da pessoa, então não é vermelho) dentro do cartão,
 * acima dos campos; "Sair" não ganha nada; a frase sobrevive ao F5 e some ao
 * começar a digitar ou ao entrar. Primeiro acesso à aplicação não mostra nada.
 */

const fetchMock = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useRouter: () => ({ invalidate: () => Promise.resolve(), navigate: () => Promise.resolve() }),
}));

const INATIVIDADE = "Sua sessão expirou por inatividade. Entre novamente para continuar.";
const EXPIRADA = "Sua sessão expirou. Entre novamente para continuar.";

class ServidorDaPorta {
  sessao: (() => Response) | null = null;

  responder = (input: string | URL | Request): Promise<Response> => {
    const href = input instanceof Request ? input.url : String(input);
    if (href.endsWith(apiPath("/auth/me"))) {
      return Promise.resolve(this.sessao ? this.sessao() : ServidorDaPorta.semSessao());
    }
    if (href.endsWith(apiPath("/auth/status"))) {
      return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
    }
    if (href.endsWith(apiPath("/auth/logout"))) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    if (href.endsWith(apiPath("/settings/active-cycle"))) {
      return Promise.resolve(
        jsonResponse({ code: "SESSION_INVALID", message: "Sessão inválida." }, 401),
      );
    }
    return Promise.resolve(jsonResponse({ data: {} }));
  };

  static semSessao(): Response {
    return jsonResponse(
      { code: "AUTHENTICATION_REQUIRED", message: "Autenticação necessária." },
      401,
    );
  }

  static aberta(): () => Response {
    return () => jsonResponse({ data: fixtureAdminUser });
  }
}

function DentroDaAplicacao() {
  const { logout } = useAuth();
  return (
    <>
      <p>APLICAÇÃO ABERTA</p>
      <button type="button" onClick={() => void logout()}>
        Sair
      </button>
      <button type="button" onClick={() => void api.setActiveCycle("2026-h2").catch(() => {})}>
        Chamada que volta 401
      </button>
    </>
  );
}

function subirOPortao() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AuthGate>
            <DentroDaAplicacao />
          </AuthGate>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

let servidor: ServidorDaPorta;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem("synapse:locale", "pt");
  vi.stubGlobal("navigator", { ...window.navigator, languages: ["pt-BR"] });
  servidor = new ServidorDaPorta();
  fetchMock.mockReset();
  fetchMock.mockImplementation(servidor.responder);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const bannerInformativo = (texto: string) => {
  const aviso = screen.getByText(texto);
  const caixa = aviso.closest('[role="status"]');
  expect(caixa, "o aviso é informativo (status), não um alerta vermelho").not.toBeNull();
  expect(caixa?.className).toContain("bg-info");
  expect(caixa?.className).not.toContain("destructive");
  return caixa as HTMLElement;
};

describe("a tela de login explica por que você saiu", () => {
  it("primeiro acesso: sem memória, o login não explica nada", async () => {
    subirOPortao();
    expect(await screen.findByLabelText("E-mail")).toBeTruthy();
    expect(screen.queryByText(INATIVIDADE)).toBeNull();
    expect(screen.queryByText(EXPIRADA)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("sessão encerrada por inatividade: o login diz que foi por inatividade, em tom informativo, acima dos campos", async () => {
    window.sessionStorage.setItem(SessionEndMemory.STORAGE_KEY, "idle");
    subirOPortao();
    expect(await screen.findByLabelText("E-mail")).toBeTruthy();

    const caixa = bannerInformativo(INATIVIDADE);
    const campos = screen.getByTestId("auth-fields");
    expect(
      caixa.compareDocumentPosition(campos) & Node.DOCUMENT_POSITION_FOLLOWING,
      "o aviso vem antes dos campos",
    ).toBeTruthy();
  });

  it("sessão expirada por 401 no meio do uso: sai da aplicação e o login diz que expirou", async () => {
    servidor.sessao = ServidorDaPorta.aberta();
    subirOPortao();
    expect(await screen.findByText("APLICAÇÃO ABERTA")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Chamada que volta 401" }));

    expect(await screen.findByLabelText("E-mail")).toBeTruthy();
    bannerInformativo(EXPIRADA);
    expect(screen.queryByText(INATIVIDADE)).toBeNull();
  });

  it("'Sair': o login volta sem nenhum aviso", async () => {
    window.sessionStorage.setItem(SessionEndMemory.STORAGE_KEY, "idle");
    servidor.sessao = ServidorDaPorta.aberta();
    subirOPortao();
    expect(await screen.findByText("APLICAÇÃO ABERTA")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByLabelText("E-mail")).toBeTruthy();
    expect(screen.queryByText(INATIVIDADE)).toBeNull();
    expect(screen.queryByText(EXPIRADA)).toBeNull();
    expect(window.sessionStorage.getItem(SessionEndMemory.STORAGE_KEY)).toBeNull();
  });

  it("F5 depois de expirar mantém o aviso — a razão mora na aba, não na URL", async () => {
    servidor.sessao = ServidorDaPorta.aberta();
    const primeira = subirOPortao();
    expect(await screen.findByText("APLICAÇÃO ABERTA")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Chamada que volta 401" }));
    expect(await screen.findByText(EXPIRADA)).toBeTruthy();
    primeira.unmount();

    servidor.sessao = null;
    subirOPortao();
    expect(await screen.findByLabelText("E-mail")).toBeTruthy();
    expect(screen.getByText(EXPIRADA)).toBeTruthy();
    expect(window.location.search).toBe("");
  });

  it("começar a digitar apaga o aviso", async () => {
    window.sessionStorage.setItem(SessionEndMemory.STORAGE_KEY, "idle");
    subirOPortao();
    expect(await screen.findByText(INATIVIDADE)).toBeTruthy();

    await userEvent.type(screen.getByLabelText("E-mail"), "a");

    expect(screen.queryByText(INATIVIDADE)).toBeNull();
  });

  it("entrar de novo esquece a razão — a próxima abertura do login nasce limpa", async () => {
    window.sessionStorage.setItem(SessionEndMemory.STORAGE_KEY, "expired");
    servidor.sessao = ServidorDaPorta.aberta();
    subirOPortao();
    // Sessão aberta na montagem: a aplicação abre e a memória antiga da aba é esquecida.
    expect(await screen.findByText("APLICAÇÃO ABERTA")).toBeTruthy();
    await waitFor(() =>
      expect(window.sessionStorage.getItem(SessionEndMemory.STORAGE_KEY)).toBeNull(),
    );
  });

  it("fala inglês quando a pessoa fala inglês", async () => {
    window.localStorage.setItem("synapse:locale", "en");
    window.sessionStorage.setItem(SessionEndMemory.STORAGE_KEY, "idle");
    subirOPortao();
    expect(
      await screen.findByText("Your session expired due to inactivity. Sign in again to continue."),
    ).toBeTruthy();
    expect(screen.queryByText(INATIVIDADE)).toBeNull();
  });
});
