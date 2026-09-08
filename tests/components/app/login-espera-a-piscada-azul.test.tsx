import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginScreen } from "@/components/app/LoginScreen";
import { apiPath } from "@/lib/api-path";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { SynapseNetwork, SynapseSignals } from "@/lib/synapse-network";
import { fixtureAssignedTechLeadUser } from "../../helpers/fixtures";
import { jsonResponse } from "../../helpers/render-app";

/**
 * Dono (2026-09-08): *"ao inserir a senha correta na tela de login eu quero
 * ver a rede de sinapse piscando em azul, assim como pisca em vermelho quando
 * erro a senha. Se necessário, atrase 1 segundo a entrada do usuário para que
 * seja possível ver a piscada em azul"*.
 *
 * O relógio aqui é falso, e é ele que prova o pedido: com movimento normal, a
 * sessão NÃO abre enquanto a onda não termina (o tempo é o do motor); com
 * movimento reduzido, abre na hora — não há onda para ver.
 */
const fetchMock = vi.fn();

/** Um sensor de sessão: diz, na tela, se a aplicação já abriu. */
function SensorDeSessao() {
  const { user } = useAuth();
  return <span data-testid="sessao">{user ? "aberta" : "fechada"}</span>;
}

function comMovimento(reduzido: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: reduzido && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    })),
  );
}

function Porta({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          {children}
          <SensorDeSessao />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function servicoQueAceita() {
  let sessionOpen = false;
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const href = String(url);
    if (href.endsWith(apiPath("/auth/status"))) {
      return Promise.resolve(jsonResponse({ data: { hasUsers: true } }));
    }
    if (href.endsWith(apiPath("/auth/login")) && init?.method === "POST") {
      sessionOpen = true;
      return Promise.resolve(jsonResponse({ data: { user: fixtureAssignedTechLeadUser } }));
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
}

/**
 * O relógio é falso: em vez de `waitFor` (que espera relógio de verdade), o
 * teste ANDA com o tempo e deixa o React aplicar o que estiver pendente.
 */
async function avancar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function entrar(signals: SynapseSignals) {
  render(
    <Porta>
      <LoginScreen signals={signals} />
    </Porta>,
  );
  await avancar(0);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@company.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo" } });
  fireEvent.submit(screen.getByRole("button", { name: "Entrar" }).closest("form")!);
  // O suficiente para a resposta do serviço chegar e a cerimônia começar —
  // sem nem chegar perto do tempo da onda.
  for (let volta = 0; volta < 5; volta += 1) {
    await avancar(1);
  }
}

const sessao = () => screen.getByTestId("sessao").textContent;

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("synapse:locale", "pt");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // O palco da rede não roda: o teste lê o que a TELA pediu, não o desenho.
  vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  /**
   * Só o `setTimeout` é falso — a espera da cerimônia. O resto do relógio
   * (microtarefas, leitura do corpo da resposta no jsdom) continua real: é o
   * mínimo para o teste controlar a onda sem congelar o navegador de mentira.
   */
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  servicoQueAceita();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a senha certa dá tempo de ver a rede piscar em azul", () => {
  it("com movimento normal, a sessão só abre DEPOIS de a onda azul terminar", async () => {
    comMovimento(false);
    const signals = new SynapseSignals();

    await entrar(signals);

    // A onda foi pedida assim que o serviço aceitou…
    expect(signals.drainPulses()).toEqual(["primary"]);
    // …e a aplicação continua fechada enquanto ela cruza a rede.
    await avancar(SynapseNetwork.COLLECTIVE_PULSE_DURATION_MS - 100);
    expect(sessao()).toBe("fechada");

    await avancar(200);
    expect(sessao()).toBe("aberta");
  });

  it("com movimento reduzido, entra na hora: sem onda, não há o que esperar", async () => {
    comMovimento(true);
    const signals = new SynapseSignals();

    await entrar(signals);

    expect(sessao()).toBe("aberta");
    expect(signals.drainPulses()).toEqual([]);
  });
});
