import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginScreen } from "@/components/app/LoginScreen";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { jsonResponse } from "../../helpers/render-app";
import { apiPath } from "@/lib/api-path";

/**
 * F3/Grupo 2, item 2 — credencial recusada no login.
 *
 * A mensagem de erro aparecia num `<p>` comum: o foco continua no formulário e
 * nada é anunciado, então quem usa leitor de tela clica em "Entrar" e não fica
 * sabendo que a credencial foi rejeitada. O erro precisa ser uma live region
 * (`role="alert"`) para ser lido no momento em que surge.
 *
 * O padrão já é o da casa em outros pontos do app (`CheckinTimeline` e
 * `NewPlanItemDialog`, em `development-plans.tsx`, e o `errorRole="alert"` do
 * `CommandWithReasonDialog`) — o login era a exceção.
 */

const fetchMock = vi.fn();
const CREDENCIAL_RECUSADA = "E-mail ou senha inválidos.";

function LoginWrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>{children}</AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe("Login — credencial recusada é anunciada", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith(apiPath("/auth/status"))) {
        return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
      }
      if (href.endsWith(apiPath("/auth/me"))) {
        return Promise.resolve(jsonResponse({ error: "Unauthorized" }, 401));
      }
      if (href.endsWith(apiPath("/auth/login")) && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({ error: "Unauthorized", message: CREDENCIAL_RECUSADA }, 401),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("anuncia o erro de credencial como alerta, não como parágrafo mudo", async () => {
    render(
      <LoginWrapper>
        <LoginScreen />
      </LoginWrapper>,
    );

    fireEvent.change(await screen.findByLabelText("E-mail"), {
      target: { value: "ana@company.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-errada" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toBe(CREDENCIAL_RECUSADA);
  });
});

/**
 * Dono (2026-09-05): "quando eu clico algumas vezes no botão de Entrar a tela
 * toda treme, como se estivesse tentando carregar. A tela inteira não deve se
 * mover, apenas o campo vermelho de erro." A causa: o aviso era apagado no
 * instante do clique e só voltava com a resposta — e, como o cartão é centrado
 * verticalmente, ele subia e descia a cada tentativa. O aviso anterior fica
 * até a resposta nova dizer outra coisa.
 */
describe("Login — o aviso de erro não some enquanto a nova tentativa está em voo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("clicar de novo mantém o alerta anterior no lugar, sem tirar e devolver o cartão", async () => {
    let soltar: (() => void) | undefined;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith(apiPath("/auth/status"))) {
        return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
      }
      if (href.endsWith(apiPath("/auth/me"))) {
        return Promise.resolve(jsonResponse({ error: "Unauthorized" }, 401));
      }
      if (href.endsWith(apiPath("/auth/login")) && init?.method === "POST") {
        if (soltar) return Promise.reject(new TypeError("Failed to fetch"));
        return new Promise<Response>((resolve) => {
          soltar = () =>
            resolve(jsonResponse({ error: "Unauthorized", message: CREDENCIAL_RECUSADA }, 401));
        });
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    render(
      <LoginWrapper>
        <LoginScreen />
      </LoginWrapper>,
    );
    fireEvent.change(await screen.findByLabelText("E-mail"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-errada" } });

    const botao = await screen.findByRole("button", { name: "Entrar" });
    fireEvent.click(botao);
    soltar?.();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(CREDENCIAL_RECUSADA);

    // Segunda tentativa: enquanto ela está em voo, o alerta anterior continua lá.
    fireEvent.click(await screen.findByRole("button", { name: "Entrar" }));
    expect(screen.getByRole("alert").textContent).toBe(CREDENCIAL_RECUSADA);

    // A resposta nova troca o texto — sem nunca ter tirado o bloco da tela.
    expect(
      (await screen.findByText(/Não foi possível falar com o serviço/)).getAttribute("role"),
    ).toBe("alert");
  });
});
