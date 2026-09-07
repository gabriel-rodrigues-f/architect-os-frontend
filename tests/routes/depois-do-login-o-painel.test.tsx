import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGate } from "@/components/app/AuthGate";
import { apiPath } from "@/lib/api-path";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { fixtureAdminUser } from "../helpers/fixtures";
import { jsonResponse } from "../helpers/render-app";

/**
 * Dono (2026-09-08): "quando abro a aplicação pela primeira vez como
 * administrador, ele abre direto o forms de preenchimento de motivo. Isso não
 * deve ocorrer. Deve abrir normalmente a tela e apresentar o forms de motivo
 * apenas quando eu clicar em um membro."
 *
 * A URL sobrevive ao logout: quem saiu estando numa ficha e entra de novo cai
 * na MESMA ficha — e a ficha, para quem opera o sistema, começa pelo passe de
 * suporte. Depois de um login, o destino é sempre o Painel. Recarregar a
 * página com sessão viva NÃO é login: a URL fica.
 */
const navigate = vi.fn();
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useRouter: () => ({ invalidate: () => Promise.resolve(), navigate }),
}));

const fetchMock = vi.fn();
let sessao: "aberta" | "fechada";

function servidor(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const href = input instanceof Request ? input.url : String(input);
  if (href.endsWith(apiPath("/auth/login")) && init?.method === "POST") {
    sessao = "aberta";
    return Promise.resolve(jsonResponse({ data: { user: fixtureAdminUser } }));
  }
  if (href.endsWith(apiPath("/auth/me"))) {
    return Promise.resolve(
      sessao === "aberta"
        ? jsonResponse({ data: fixtureAdminUser })
        : jsonResponse(
            { code: "AUTHENTICATION_REQUIRED", message: "Autenticação necessária." },
            401,
          ),
    );
  }
  return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
}

function subirOPortao() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AuthGate>
            <p>APLICAÇÃO ABERTA</p>
          </AuthGate>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.setItem("synapse:locale", "pt");
  navigate.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(servidor);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("depois do login, o Painel", () => {
  it("quem entra pela tela de login vai para o Painel, seja qual for a URL que sobrou na aba", async () => {
    sessao = "fechada";
    subirOPortao();
    fireEvent.change(await screen.findByLabelText("E-mail"), {
      target: { value: "admin@synapse.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "Senha-forte-123!" } });
    fireEvent.submit(screen.getByLabelText("Senha").closest("form") as HTMLFormElement);
    expect(await screen.findByText("APLICAÇÃO ABERTA")).toBeTruthy();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
  });

  it("recarregar a página com sessão viva NÃO é login: a URL fica onde estava", async () => {
    sessao = "aberta";
    subirOPortao();
    expect(await screen.findByText("APLICAÇÃO ABERTA")).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(navigate).not.toHaveBeenCalled();
  });
});
