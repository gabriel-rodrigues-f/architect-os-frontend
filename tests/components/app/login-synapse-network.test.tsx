import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginScreen } from "@/components/app/LoginScreen";
import { apiPath } from "@/lib/api-path";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { jsonResponse } from "../../helpers/render-app";

/**
 * O login "Synapse Network" (direção 2026-09-06): a marca em hierarquia, o
 * cartão com a headline da casa, a senha com mostrar/ocultar acessível, o
 * botão que trava em "Entrando…" sem submissão dupla, e a rede ao fundo.
 */
const fetchMock = vi.fn();

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

function servicoQueSegura() {
  let soltar: (() => void) | undefined;
  let tentativas = 0;
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const href = String(url);
    if (href.endsWith(apiPath("/auth/status"))) {
      return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
    }
    if (href.endsWith(apiPath("/auth/login")) && init?.method === "POST") {
      tentativas += 1;
      return new Promise<Response>((resolve) => {
        soltar = () =>
          resolve(
            jsonResponse(
              { code: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos." },
              401,
            ),
          );
      });
    }
    return Promise.resolve(jsonResponse({ error: "Unauthorized" }, 401));
  });
  return { soltar: () => soltar?.(), tentativas: () => tentativas };
}

async function preencher() {
  render(
    <LoginWrapper>
      <LoginScreen />
    </LoginWrapper>,
  );
  fireEvent.change(await screen.findByLabelText("E-mail"), {
    target: { value: "ana@company.com" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo" } });
  return screen.findByRole("button", { name: "Entrar" });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LoginScreen — a composição Synapse Network", () => {
  it("mostra a marca em hierarquia: só o wordmark e o subtítulo (dono, 2026-09-07: sem a frase)", async () => {
    servicoQueSegura();
    await preencher();
    const marca = screen.getByRole("region", { name: "Synapse" });
    expect(marca.textContent).toContain("Synapse");
    expect(marca.textContent).toContain("Desenvolvimento de Capacidades");
    expect(marca.textContent).not.toContain("Conecte conhecimento.");
    expect(marca.querySelector("[data-testid='auth-brand-line']")).toBeNull();
  });

  it("o cartão traz a headline e o convite com as credenciais corporativas", async () => {
    servicoQueSegura();
    await preencher();
    const cartao = screen.getByTestId("auth-card");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Entrar");
    expect(cartao.textContent).toContain("Acesse o Synapse com suas credenciais corporativas.");
    expect(screen.getByLabelText("E-mail").getAttribute("autocomplete")).toBe("email");
    expect(screen.getByLabelText("Senha").getAttribute("autocomplete")).toBe("current-password");
  });

  it("a rede de sinapses está ao fundo, decorativa", async () => {
    servicoQueSegura();
    await preencher();
    expect(screen.getByTestId("synapse-network").getAttribute("aria-hidden")).toBe("true");
  });

  it("a senha tem mostrar/ocultar com nome, estado e teclado", async () => {
    servicoQueSegura();
    await preencher();
    const senha = screen.getByLabelText("Senha");
    expect(senha.getAttribute("type")).toBe("password");
    const mostrar = screen.getByRole("button", { name: "Mostrar senha" });
    expect(mostrar.getAttribute("type")).toBe("button");
    expect(mostrar.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(mostrar);
    expect(senha.getAttribute("type")).toBe("text");
    const ocultar = screen.getByRole("button", { name: "Ocultar senha" });
    expect(ocultar.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(ocultar);
    expect(senha.getAttribute("type")).toBe("password");
  });

  it("clicar em Entrar trava o botão em 'Entrando…' e não submete duas vezes", async () => {
    const servico = servicoQueSegura();
    const botao = await preencher();
    fireEvent.click(botao);
    const entrando = await screen.findByRole("button", { name: /Entrando/ });
    expect(entrando.hasAttribute("disabled")).toBe(true);
    expect(entrando.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(entrando);
    fireEvent.submit(entrando.closest("form")!);
    expect(servico.tentativas()).toBe(1);
    servico.soltar();
    expect((await screen.findByRole("alert")).textContent).toBe("E-mail ou senha inválidos.");
    expect(screen.getByRole("button", { name: "Entrar" }).hasAttribute("disabled")).toBe(false);
  });

  it("o erro marca os campos como inválidos, sem revelar contas", async () => {
    const servico = servicoQueSegura();
    fireEvent.click(await preencher());
    servico.soltar();
    await screen.findByRole("alert");
    expect(screen.getByLabelText("E-mail").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Senha").getAttribute("aria-invalid")).toBe("true");
  });

  it("'Esqueci minha senha' é um botão secundário que leva ao pedido de acesso", async () => {
    servicoQueSegura();
    await preencher();
    const esqueci = screen.getByRole("button", { name: "Esqueci minha senha" });
    esqueci.focus();
    expect(document.activeElement).toBe(esqueci);
    fireEvent.click(esqueci);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Recuperar o seu acesso");
  });
});

describe("Enter envia o formulário (dono, 2026-09-07)", () => {
  it("com e-mail e senha preenchidos, Enter no campo de senha dispara o login — mesmo antes da consulta da instância responder", async () => {
    let tentativas = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      // A consulta da instância nunca responde: é o backend fora do ar.
      if (href.endsWith(apiPath("/auth/status"))) return new Promise<Response>(() => undefined);
      if (href.endsWith(apiPath("/auth/login")) && init?.method === "POST") {
        tentativas += 1;
        return Promise.resolve(
          jsonResponse({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos." }, 401),
        );
      }
      return Promise.resolve(jsonResponse({ error: "Unauthorized" }, 401));
    });
    render(
      <LoginWrapper>
        <LoginScreen />
      </LoginWrapper>,
    );
    fireEvent.change(await screen.findByLabelText("E-mail"), {
      target: { value: "ana@company.com" },
    });
    const senha = screen.getByLabelText("Senha");
    fireEvent.change(senha, { target: { value: "Senha-forte-123!" } });
    // A TECLA, e não o evento `submit`: o jsdom não faz submissão implícita,
    // e o navegador do dono também não fez (2026-09-08). O Enter tem que
    // chegar ao login pelo caminho explícito do formulário.
    fireEvent.keyDown(senha, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(tentativas).toBe(1));
  });

  it("Enter no botão de mostrar senha só alterna a visibilidade — não envia", async () => {
    let tentativas = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith(apiPath("/auth/login")) && init?.method === "POST") tentativas += 1;
      return Promise.resolve(jsonResponse({ error: "Unauthorized" }, 401));
    });
    render(
      <LoginWrapper>
        <LoginScreen />
      </LoginWrapper>,
    );
    fireEvent.change(await screen.findByLabelText("E-mail"), {
      target: { value: "ana@company.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "Senha-forte-123!" } });
    fireEvent.keyDown(screen.getByRole("button", { name: /mostrar senha/i }), {
      key: "Enter",
      code: "Enter",
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(tentativas).toBe(0);
  });
});
