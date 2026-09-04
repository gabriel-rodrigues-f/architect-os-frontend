import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginScreen } from "@/components/app/LoginScreen";
import { apiPath } from "@/lib/api-path";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { jsonResponse } from "../../helpers/render-app";

/**
 * O CASO DO DONO (2026-09-03), com a captura que ele mandou junto: a tela de
 * login mostrando, em vermelho, dentro do formulário:
 *
 *     POST /api/v1/auth/login falhou (404)
 *
 * A ordem foi literal: *"o usuário final não pode ver erros técnicos em
 * nenhuma, absolutamente nenhuma parte da aplicação."*
 *
 * A resposta que produz isso é a mais crua possível — 404 SEM CORPO, que é o
 * que um proxy mal apontado devolve. Sem corpo não há `message` do serviço, e
 * o `api-client.ts` montava a frase com verbo, caminho e status. Agora a frase
 * vem da SITUAÇÃO (`ApiFailureReading`): 404 é "não encontrado", em português
 * paulistano, dizendo o que a pessoa pode fazer.
 *
 * O teste prende os dois lados: a frase humana APARECE, e nenhum dos quatro
 * pedaços técnicos da captura sobrevive na tela.
 */

const fetchMock = vi.fn();

const PEDACOS_TECNICOS = ["POST", "/api/v1", "404", "falhou"];

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

describe("Login — 404 sem corpo vira frase humana, nunca a linha técnica", () => {
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
        // A resposta da captura: 404, sem corpo nenhum para ler.
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function tentarEntrar() {
    render(
      <LoginWrapper>
        <LoginScreen />
      </LoginWrapper>,
    );
    fireEvent.change(await screen.findByLabelText("E-mail"), {
      target: { value: "ana@company.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "qualquer-uma" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    return screen.findByRole("alert");
  }

  it("desenha a frase da situação — 404 é 'não encontramos o que você pediu'", async () => {
    const alerta = await tentarEntrar();

    expect(alerta.textContent).toBe(
      "Não encontramos o que você pediu. Atualize a página e tente de novo.",
    );
  });

  it("não sobra NADA da linha técnica da captura: sem POST, sem /api/v1, sem 404, sem 'falhou'", async () => {
    await tentarEntrar();

    const telaInteira = document.body.textContent ?? "";
    for (const pedaco of PEDACOS_TECNICOS) {
      expect(telaInteira, `a tela de login ainda mostra "${pedaco}"`).not.toContain(pedaco);
    }
  });

  it("quando o SERVIÇO manda frase, a frase é a dele — a situação só cobre o silêncio", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith(apiPath("/auth/status"))) {
        return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
      }
      if (href.endsWith(apiPath("/auth/login")) && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ message: "E-mail ou senha inválidos." }, 401));
      }
      return Promise.resolve(jsonResponse({ error: "Unauthorized" }, 401));
    });

    const alerta = await tentarEntrar();

    expect(alerta.textContent).toBe("E-mail ou senha inválidos.");
  });
});
