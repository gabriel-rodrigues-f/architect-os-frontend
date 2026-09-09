import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginScreen } from "@/components/app/LoginScreen";
import { apiPath } from "@/lib/api-path";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { SynapseSignals } from "@/lib/synapse-network";
import { fixtureAssignedTechLeadUser } from "../../helpers/fixtures";
import { jsonResponse } from "../../helpers/render-app";

/**
 * Dono (2026-09-08): "quando insiro a senha e clico em Enter, a sinapse da
 * tela de login é azul. A cor precisa acompanhar o resultado: se o login for
 * rejeitado, a sinapse deve ser vermelha, no mesmo tom do vermelho de erro do
 * contorno dos campos; só pode ser azul quando o usuário conseguir se logar
 * com sucesso". Logo: o pulso NÃO dispara no envio — dispara com a resposta.
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

function servico(loginResponse: () => Response) {
  let soltar: (() => void) | undefined;
  let sessionOpen = false;
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const href = String(url);
    if (href.endsWith(apiPath("/auth/status"))) {
      return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
    }
    if (href.endsWith(apiPath("/auth/login")) && init?.method === "POST") {
      return new Promise<Response>((resolve) => {
        soltar = () => {
          sessionOpen = true;
          resolve(loginResponse());
        };
      });
    }
    if (href.endsWith(apiPath("/auth/me"))) {
      return Promise.resolve(
        sessionOpen
          ? jsonResponse({ data: fixtureAssignedTechLeadUser })
          : jsonResponse({ error: "Unauthorized" }, 401),
      );
    }
    return Promise.resolve(jsonResponse({ error: "Unauthorized" }, 401));
  });
  return { soltar: () => soltar?.() };
}

async function enviar(signals: SynapseSignals) {
  render(
    <LoginWrapper>
      <LoginScreen signals={signals} />
    </LoginWrapper>,
  );
  fireEvent.change(await screen.findByLabelText("E-mail"), {
    target: { value: "ana@company.com" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo" } });
  fireEvent.submit(screen.getByRole("button", { name: "Entrar" }).closest("form")!);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // O relógio parado: o palco da rede não drena a fila, e o teste lê o que a tela pediu.
  vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LoginScreen — a cor do pulso acompanha o resultado", () => {
  it("o envio em si não pulsa; a recusa (401) pulsa vermelho depois da resposta", async () => {
    const signals = new SynapseSignals();
    const { soltar } = servico(() =>
      jsonResponse({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha inválidos." }, 401),
    );
    await enviar(signals);
    await screen.findByRole("button", { name: /Entrando/ });
    expect(signals.drainPulses()).toEqual([]);
    soltar();
    await screen.findByRole("alert");
    expect(signals.drainPulses()).toEqual(["danger"]);
  });

  it("o sucesso (200) pulsa azul", async () => {
    const signals = new SynapseSignals();
    const { soltar } = servico(() => jsonResponse({ data: { user: fixtureAssignedTechLeadUser } }));
    await enviar(signals);
    await screen.findByRole("button", { name: /Entrando/ });
    expect(signals.drainPulses()).toEqual([]);
    soltar();
    await waitFor(() => expect(signals.drainPulses()).toEqual(["primary"]));
  });

  it("o serviço fora do ar não pulsa nada — não é culpa do que foi digitado", async () => {
    const signals = new SynapseSignals();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith(apiPath("/auth/status"))) {
        return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
      }
      if (href.endsWith(apiPath("/auth/login")) && init?.method === "POST") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve(jsonResponse({ error: "Unauthorized" }, 401));
    });
    await enviar(signals);
    await screen.findByRole("alert");
    expect(signals.drainPulses()).toEqual([]);
  });
});
